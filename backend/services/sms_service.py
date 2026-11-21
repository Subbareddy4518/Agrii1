"""
AgriConnect SMS Provider Integration Layer & Abuse Protection Engine.

Provides:
1. Provider abstraction (BaseSmsProvider, Msg91SmsProvider, DevelopmentSmsProvider, MockSmsProvider).
2. MSG91 Send OTP (v5) and Verify OTP integration.
3. Server-side sliding-window rate limiting & 60-second cooldown protection.
4. Security sanitization: sensitive phone masking and zero credential/OTP logging.
"""

import ipaddress
import json
import os
import re
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Union


# Standard 10-digit Indian mobile pattern (must begin with 6, 7, 8, or 9)
INDIAN_MOBILE_REGEX = re.compile(r"^[6-9]\d{9}$")


def validate_indian_mobile(mobile: Optional[str]) -> Tuple[bool, str, Optional[str]]:
    """
    Validates Indian mobile numbers and extracts the 10-digit national number.
    Accepts:
    - Standard 10 digits: 9848011223 (must start with 6, 7, 8, or 9)
    - With country code: +919848011223, 919848011223, +91-98480-11223, +91 98480 11223
    - With trunk prefix: 09848011223

    Returns (is_valid, national_10_digits, error_message).
    """
    if not mobile:
        return False, "", "Mobile number is required"

    # Strip formatting characters (spaces, hyphens, dots, parens, plus)
    cleaned = re.sub(r"[\s\-\.\(\)\+]", "", str(mobile).strip())
    if not cleaned.isdigit():
        return False, "", "Mobile number must contain digits only"

    if len(cleaned) == 10:
        national = cleaned
    elif len(cleaned) == 11 and cleaned.startswith("0"):
        national = cleaned[1:]
    elif len(cleaned) == 12 and cleaned.startswith("91"):
        national = cleaned[2:]
    else:
        return (
            False,
            "",
            "Please enter a valid 10-digit Indian mobile number (e.g. 9848012345 or +91 98480 12345)",
        )

    if not INDIAN_MOBILE_REGEX.match(national):
        return (
            False,
            national,
            "Invalid Indian mobile number: must begin with 6, 7, 8, or 9",
        )

    return True, national, None


def mask_phone(mobile: Optional[str]) -> str:
    """Masks a phone number for safe user-facing responses and logs (e.g. XXXXXX1234)."""
    if not mobile:
        return "XXXXXX0000"
    digits = re.sub(r"\D", "", str(mobile))
    if len(digits) >= 10:
        return "X" * (len(digits) - 4) + digits[-4:]
    elif len(digits) >= 4:
        return "X" * (len(digits) - 2) + digits[-2:]
    return "XXXXXX"


def normalize_indian_mobile(mobile: str) -> str:
    """
    Normalizes an Indian phone number to E.164 digits without leading plus.
    Output format: 91XXXXXXXXXX (12 digits required by MSG91).
    Raises ValueError if number is not a valid Indian mobile number.
    """
    is_valid, national_number, err_msg = validate_indian_mobile(mobile)
    if not is_valid:
        raise ValueError(err_msg or "Mobile number must be a valid 10-digit Indian number starting with 6-9")
    return f"91{national_number}"


# ==============================================================================
# SECURE PROXY & IP RESOLUTION ENGINE (SEC-01)
# ==============================================================================

DEFAULT_TRUSTED_PROXIES = ["127.0.0.1", "::1", "testclient"]


def is_ip_trusted(ip_str: Optional[str], trusted_list: Optional[List[str]] = None) -> bool:
    """
    Determines if an immediate peer IP is an explicitly trusted proxy.
    Supports loopback ('127.0.0.1', '::1', 'testclient'), exact IP match, and CIDR blocks.
    """
    if not ip_str:
        return False
    if ip_str == "testclient":
        return True

    if trusted_list is None:
        env_proxies = os.getenv("TRUSTED_PROXIES", "").strip()
        if env_proxies:
            trusted_list = [p.strip() for p in env_proxies.split(",") if p.strip()]
        else:
            trusted_list = DEFAULT_TRUSTED_PROXIES

    if "*" in trusted_list:
        return True

    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return False

    for entry in trusted_list:
        if entry == "testclient":
            continue
        try:
            if "/" in entry:
                if addr in ipaddress.ip_network(entry, strict=False):
                    return True
            else:
                if addr == ipaddress.ip_address(entry):
                    return True
        except ValueError:
            continue
    return False


def extract_client_ip(request, trusted_proxies: Optional[List[str]] = None) -> str:
    """
    Securely extracts the true client IP from an incoming Request.
    Security Rules:
    1. If the direct peer (request.client.host) is NOT an explicitly trusted proxy,
       do NOT trust X-Forwarded-For, X-Real-IP, or CF-Connecting-IP (prevents header spoofing).
    2. If the peer IS a trusted proxy:
       - Prefers CF-Connecting-IP if valid.
       - Prefers X-Real-IP if valid.
       - Otherwise takes the rightmost IP in X-Forwarded-For appended by the trusted proxy.
    3. Returns direct client address if proxy trust cannot be established.
    """
    if not request:
        return "127.0.0.1"

    peer_host = None
    if getattr(request, "client", None) and request.client.host:
        peer_host = str(request.client.host).strip()

    if not peer_host:
        return "127.0.0.1"

    # If direct peer is NOT a trusted proxy, ignore all forwarding headers completely
    if not is_ip_trusted(peer_host, trusted_proxies):
        return peer_host

    headers = getattr(request, "headers", {})

    # Cloudflare connecting IP
    cf_ip = headers.get("cf-connecting-ip")
    if cf_ip:
        clean_cf = cf_ip.strip()
        try:
            ipaddress.ip_address(clean_cf)
            return clean_cf
        except ValueError:
            pass

    # X-Real-IP
    real_ip = headers.get("x-real-ip")
    if real_ip:
        clean_real = real_ip.strip()
        try:
            ipaddress.ip_address(clean_real)
            return clean_real
        except ValueError:
            pass

    # X-Forwarded-For: trust the rightmost hop appended by the trusted proxy
    forwarded = headers.get("x-forwarded-for")
    if forwarded:
        hops = [h.strip() for h in forwarded.split(",") if h.strip()]
        if hops:
            candidate = hops[-1]
            try:
                ipaddress.ip_address(candidate)
                return candidate
            except ValueError:
                pass

    return peer_host


# ==============================================================================
# RATE LIMITING & ABUSE PROTECTION ENGINE
# ==============================================================================

class OtpRateLimiter:
    """
    Thread-safe in-memory sliding-window rate limiter for mobile OTP requests and verifications.
    Enforces:
    1. Maximum 3 OTP send requests per mobile number per 10 minutes (600s).
    2. Minimum 60-second cooldown between consecutive send requests for the same mobile.
    3. Maximum 10 OTP send requests per IP per 10 minutes (prevents bot scraping/mass SMS exhaustion).
    4. Maximum 5 OTP verification attempts per mobile number and IP per 10 minutes (SEC-03).
    """

    def __init__(
        self,
        max_requests_per_window: int = 3,
        window_seconds: int = 600,
        cooldown_seconds: int = 60,
        max_ip_requests_per_window: int = 10,
        max_verify_attempts_per_window: int = 5,
    ):
        self.max_requests_per_window = max_requests_per_window
        self.window_seconds = window_seconds
        self.cooldown_seconds = cooldown_seconds
        self.max_ip_requests_per_window = max_ip_requests_per_window
        self.max_verify_attempts_per_window = max_verify_attempts_per_window

        self._mobile_history: Dict[str, List[float]] = {}
        self._ip_history: Dict[str, List[float]] = {}
        self._verify_mobile_history: Dict[str, List[float]] = {}
        self._verify_ip_history: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def check_limit(
        self, mobile: str, ip: Optional[str] = None, is_production: bool = True
    ) -> Tuple[bool, Optional[str], Optional[int]]:
        """
        Validates whether a new OTP dispatch is permitted without recording it.
        Returns (is_allowed, error_message, retry_after_seconds).
        """
        now = time.time()
        digits = re.sub(r"\D", "", mobile)[-10:]

        with self._lock:
            # 1. IP check
            if ip:
                ip_times = [t for t in self._ip_history.get(ip, []) if now - t < self.window_seconds]
                if len(ip_times) >= self.max_ip_requests_per_window:
                    oldest = ip_times[0]
                    retry_after = max(1, int(self.window_seconds - (now - oldest)))
                    return (
                        False,
                        "Too many OTP requests from this network. Please wait before trying again.",
                        retry_after,
                    )

            # 2. Mobile history check
            mobile_times = [
                t for t in self._mobile_history.get(digits, []) if now - t < self.window_seconds
            ]

            if is_production:
                # Max 3 requests per 10-minute window check (takes precedence over cooldown)
                if len(mobile_times) >= self.max_requests_per_window:
                    oldest = mobile_times[0]
                    retry_after = max(1, int(self.window_seconds - (now - oldest)))
                    minutes = max(1, (retry_after + 59) // 60)
                    return (
                        False,
                        f"Maximum OTP limit reached for this number. Please try again in {minutes} minutes.",
                        retry_after,
                    )

                # 60-second cooldown check
                if mobile_times:
                    last_time = mobile_times[-1]
                    time_since_last = now - last_time
                    if time_since_last < self.cooldown_seconds:
                        retry_after = max(1, int(self.cooldown_seconds - time_since_last))
                        return (
                            False,
                            f"Please wait {retry_after} seconds before requesting a new verification code.",
                            retry_after,
                        )

            return True, None, None

    def record_send(self, mobile: str, ip: Optional[str] = None):
        """Records a successful dispatch timestamp."""
        now = time.time()
        digits = re.sub(r"\D", "", mobile)[-10:]
        with self._lock:
            mobile_times = [
                t for t in self._mobile_history.get(digits, []) if now - t < self.window_seconds
            ]
            mobile_times.append(now)
            self._mobile_history[digits] = mobile_times
            if ip:
                ip_times = [t for t in self._ip_history.get(ip, []) if now - t < self.window_seconds]
                ip_times.append(now)
                self._ip_history[ip] = ip_times

    def check_and_record_send(
        self, mobile: str, ip: Optional[str] = None, is_production: bool = True
    ) -> Tuple[bool, Optional[str], Optional[int]]:
        """
        Validates whether a new OTP dispatch is permitted and records it if allowed.
        Returns (is_allowed, error_message, retry_after_seconds).
        """
        allowed, err_msg, retry_after = self.check_limit(mobile, ip, is_production=is_production)
        if allowed:
            self.record_send(mobile, ip)
        return allowed, err_msg, retry_after

    def check_verify_limit(
        self, mobile: str, ip: Optional[str] = None, is_production: bool = True
    ) -> Tuple[bool, Optional[str], Optional[int]]:
        """
        Enforces a maximum of 5 OTP verification attempts per mobile number and IP within 10 minutes (SEC-03).
        Returns (is_allowed, error_message, retry_after_seconds).
        """
        now = time.time()
        digits = re.sub(r"\D", "", mobile)[-10:]

        with self._lock:
            # 1. Mobile history check (max 5 verification attempts per 10 minutes)
            mobile_times = [
                t for t in self._verify_mobile_history.get(digits, []) if now - t < self.window_seconds
            ]
            if len(mobile_times) >= self.max_verify_attempts_per_window:
                oldest = mobile_times[0]
                retry_after = max(1, int(self.window_seconds - (now - oldest)))
                minutes = max(1, (retry_after + 59) // 60)
                return (
                    False,
                    f"Maximum verification attempts exceeded for this number. Please wait {minutes} minutes.",
                    retry_after,
                )

            # 2. IP check (max 5 verification attempts per 10 minutes across network)
            if ip:
                ip_times = [
                    t for t in self._verify_ip_history.get(ip, []) if now - t < self.window_seconds
                ]
                if len(ip_times) >= self.max_verify_attempts_per_window:
                    oldest = ip_times[0]
                    retry_after = max(1, int(self.window_seconds - (now - oldest)))
                    minutes = max(1, (retry_after + 59) // 60)
                    return (
                        False,
                        f"Too many verification attempts from this network. Please wait {minutes} minutes.",
                        retry_after,
                    )

            return True, None, None

    def record_verify_attempt(self, mobile: str, ip: Optional[str] = None):
        """Records a verification attempt timestamp."""
        now = time.time()
        digits = re.sub(r"\D", "", mobile)[-10:]
        with self._lock:
            mobile_times = [
                t for t in self._verify_mobile_history.get(digits, []) if now - t < self.window_seconds
            ]
            mobile_times.append(now)
            self._verify_mobile_history[digits] = mobile_times
            if ip:
                ip_times = [
                    t for t in self._verify_ip_history.get(ip, []) if now - t < self.window_seconds
                ]
                ip_times.append(now)
                self._verify_ip_history[ip] = ip_times

    def record_verify_success(self, mobile: str):
        """Clears failed verification history for the mobile upon successful verification."""
        digits = re.sub(r"\D", "", mobile)[-10:]
        with self._lock:
            self._verify_mobile_history.pop(digits, None)

    def reset(self):
        """Clears all tracking histories (used for unit test isolation)."""
        with self._lock:
            self._mobile_history.clear()
            self._ip_history.clear()
            self._verify_mobile_history.clear()
            self._verify_ip_history.clear()


otp_rate_limiter = OtpRateLimiter()


# ==============================================================================
# PROVIDER ABSTRACTION LAYER
# ==============================================================================

@dataclass
class SmsDeliveryResult:
    success: bool
    message: str
    otp: Optional[str] = None
    error_code: Optional[str] = None
    retry_after: Optional[int] = None


class BaseSmsProvider(ABC):
    """Abstract SMS & OTP Provider interface."""

    @abstractmethod
    def is_configured(self) -> bool:
        """Returns True if the provider has necessary API credentials configured."""
        pass

    @abstractmethod
    def send_otp(self, mobile: str) -> SmsDeliveryResult:
        """Dispatches an OTP to the given 10-digit mobile number."""
        pass

    @abstractmethod
    def verify_otp(self, mobile: str, otp: str) -> Tuple[bool, str]:
        """Verifies the given OTP for the mobile number. Returns (is_valid, user_message)."""
        pass


class DevelopmentSmsProvider(BaseSmsProvider):
    """
    Development and local test provider.
    Returns test code '1234' without hitting real SMS carriers.
    """

    def is_configured(self) -> bool:
        return True

    def send_otp(self, mobile: str) -> SmsDeliveryResult:
        digits = re.sub(r"\D", "", mobile)[-10:]
        return SmsDeliveryResult(
            success=True,
            message=f"OTP sent successfully to {digits}",
            otp="1234",
        )

    def verify_otp(self, mobile: str, otp: str) -> Tuple[bool, str]:
        if otp.strip() == "1234":
            return True, "Mobile number verified successfully"
        return False, "Invalid OTP code. Please enter 1234."


class Msg91SmsProvider(BaseSmsProvider):
    """
    Production MSG91 SendOTP v5 Integration.
    Connects to MSG91 managed OTP endpoints.
    DLT compliant; OTP generation, rate limits, and verification are managed securely on MSG91.
    """

    DEFAULT_BASE_URL = "https://control.msg91.com/api/v5/otp"

    def __init__(
        self,
        auth_key: Optional[str] = None,
        template_id: Optional[str] = None,
        base_url: Optional[str] = None,
        otp_expiry_minutes: int = 10,
        otp_length: int = 4,
        timeout_seconds: float = 5.0,
    ):
        self.auth_key = auth_key or os.getenv("MSG91_AUTH_KEY") or os.getenv("SMS_PROVIDER_API_KEY")
        self.template_id = template_id or os.getenv("MSG91_TEMPLATE_ID")
        self.base_url = (
            base_url
            or os.getenv("MSG91_BASE_URL")
            or os.getenv("SMS_GATEWAY_URL")
            or self.DEFAULT_BASE_URL
        ).rstrip("/")
        self.otp_expiry_minutes = int(os.getenv("MSG91_OTP_EXPIRY_MINUTES", str(otp_expiry_minutes)))
        self.otp_length = int(os.getenv("MSG91_OTP_LENGTH", str(otp_length)))
        self.timeout_seconds = float(os.getenv("SMS_TIMEOUT_SECONDS", str(timeout_seconds)))

    def is_configured(self) -> bool:
        auth_key = self.auth_key or os.getenv("MSG91_AUTH_KEY") or os.getenv("SMS_PROVIDER_API_KEY")
        return bool(auth_key and auth_key.strip())

    def send_otp(self, mobile: str) -> SmsDeliveryResult:
        """
        Dispatches OTP via MSG91 SendOTP API:
        POST https://control.msg91.com/api/v5/otp
        """
        auth_key = self.auth_key or os.getenv("MSG91_AUTH_KEY") or os.getenv("SMS_PROVIDER_API_KEY")
        if not auth_key:
            return SmsDeliveryResult(
                success=False,
                message="SMS service is currently unavailable. No production SMS provider is configured.",
                error_code="PROVIDER_NOT_CONFIGURED",
            )

        try:
            formatted_mobile = normalize_indian_mobile(mobile)
        except ValueError:
            return SmsDeliveryResult(
                success=False,
                message="Please enter a valid 10-digit mobile number.",
                error_code="INVALID_MOBILE",
            )

        # Support simulated testing with dummy keys only in non-production environments (SEC-04)
        is_dummy_key = bool(
            auth_key
            and (
                auth_key in ("dummy_provider_key", "test_provider_key")
                or auth_key.startswith("dummy_")
                or auth_key.startswith("test_")
            )
        )
        if is_dummy_key:
            is_prod = (
                os.getenv("ENVIRONMENT", "").lower() in ("production", "prod")
                or os.getenv("FASTAPI_ENV", "").lower() in ("production", "prod")
            )
            if is_prod:
                return SmsDeliveryResult(
                    success=False,
                    message="SMS service configuration error: dummy credentials rejected in production environment.",
                    error_code="INVALID_CREDENTIALS",
                )
            masked = mask_phone(mobile)
            return SmsDeliveryResult(
                success=True,
                message=f"OTP sent successfully via SMS to {masked}",
                otp=None,
            )

        query_params = {
            "template_id": self.template_id or "",
            "mobile": formatted_mobile,
            "otp_expiry": str(self.otp_expiry_minutes),
            "otp_length": str(self.otp_length),
        }
        # Filter out empty template_id if not configured
        if not query_params["template_id"]:
            del query_params["template_id"]

        url = f"{self.base_url}?{urllib.parse.urlencode(query_params)}"

        headers = {
            "authkey": auth_key,
            "Content-Type": "application/json",
            "User-Agent": "AgriConnect-Backend/2.0",
        }

        req = urllib.request.Request(url, data=b"{}", headers=headers, method="POST")
        ssl_ctx = ssl.create_default_context()

        try:
            with urllib.request.urlopen(req, timeout=self.timeout_seconds, context=ssl_ctx) as resp:
                resp_data = resp.read().decode("utf-8")
                try:
                    data = json.loads(resp_data)
                except Exception:
                    data = {}

                resp_type = str(data.get("type", "")).lower()
                resp_msg = str(data.get("message", ""))

                if resp_type == "success" or "success" in resp_msg.lower() or "sent" in resp_msg.lower():
                    masked = mask_phone(mobile)
                    return SmsDeliveryResult(
                        success=True,
                        message=f"OTP sent successfully via SMS to {masked}",
                        otp=None,  # Never expose OTP in production!
                    )
                else:
                    return SmsDeliveryResult(
                        success=False,
                        message=resp_msg or "Failed to dispatch verification code via SMS.",
                        error_code="DISPATCH_REJECTED",
                    )

        except urllib.error.HTTPError as http_err:
            code = http_err.code
            try:
                err_body = http_err.read().decode("utf-8")
                err_json = json.loads(err_body)
                err_msg = err_json.get("message") or str(err_json)
            except Exception:
                err_msg = "SMS provider request failed"

            if code in (401, 403):
                return SmsDeliveryResult(
                    success=False,
                    message="SMS service authentication error. Check provider credentials.",
                    error_code="AUTH_ERROR",
                )
            elif code == 429:
                return SmsDeliveryResult(
                    success=False,
                    message="SMS provider rate limit reached. Please wait before retrying.",
                    error_code="PROVIDER_RATE_LIMIT",
                )
            else:
                return SmsDeliveryResult(
                    success=False,
                    message=f"SMS provider error ({code}): {err_msg}",
                    error_code=f"HTTP_{code}",
                )

        except (urllib.error.URLError, TimeoutError) as net_err:
            return SmsDeliveryResult(
                success=False,
                message="SMS provider service unreachable or timed out.",
                error_code="NETWORK_ERROR",
            )
        except Exception as ex:
            return SmsDeliveryResult(
                success=False,
                message="Unexpected error during SMS dispatch.",
                error_code="UNEXPECTED_ERROR",
            )

    def verify_otp(self, mobile: str, otp: str) -> Tuple[bool, str]:
        """
        Verifies OTP via MSG91 Verify OTP API:
        GET https://control.msg91.com/api/v5/otp/verify?mobile=...&otp=...
        """
        auth_key = self.auth_key or os.getenv("MSG91_AUTH_KEY") or os.getenv("SMS_PROVIDER_API_KEY")
        if not auth_key:
            return False, "OTP verification is currently unavailable. No production SMS provider is configured."

        clean_otp = otp.strip()
        if not clean_otp:
            return False, "Please enter verification code."

        try:
            formatted_mobile = normalize_indian_mobile(mobile)
        except ValueError:
            return False, "Please enter a valid 10-digit mobile number."

        # Support simulated testing with dummy keys only in non-production environments (SEC-04)
        is_dummy_key = bool(
            auth_key
            and (
                auth_key in ("dummy_provider_key", "test_provider_key")
                or auth_key.startswith("dummy_")
                or auth_key.startswith("test_")
            )
        )
        if is_dummy_key:
            is_prod = (
                os.getenv("ENVIRONMENT", "").lower() in ("production", "prod")
                or os.getenv("FASTAPI_ENV", "").lower() in ("production", "prod")
            )
            if is_prod:
                return False, "SMS service configuration error: dummy credentials rejected in production environment."
            if clean_otp == "8899":
                return True, "Mobile number verified successfully"
            return False, "Invalid or expired OTP code"

        query_params = {
            "mobile": formatted_mobile,
            "otp": clean_otp,
        }
        url = f"{self.base_url}/verify?{urllib.parse.urlencode(query_params)}"

        headers = {
            "authkey": auth_key,
            "User-Agent": "AgriConnect-Backend/2.0",
        }

        req = urllib.request.Request(url, headers=headers, method="GET")
        ssl_ctx = ssl.create_default_context()

        try:
            with urllib.request.urlopen(req, timeout=self.timeout_seconds, context=ssl_ctx) as resp:
                resp_data = resp.read().decode("utf-8")
                try:
                    data = json.loads(resp_data)
                except Exception:
                    data = {}

                resp_type = str(data.get("type", "")).lower()
                resp_msg = str(data.get("message", "")).lower()

                if resp_type == "success" or "success" in resp_msg or "verified" in resp_msg:
                    return True, "Mobile number verified successfully"
                elif "expired" in resp_msg:
                    return False, "Verification code has expired. Please request a new code."
                elif "not match" in resp_msg or "invalid" in resp_msg or "wrong" in resp_msg:
                    return False, "Invalid verification code. Please check and try again."
                else:
                    return False, "Invalid or expired OTP code."

        except urllib.error.HTTPError as http_err:
            try:
                err_body = http_err.read().decode("utf-8")
                err_json = json.loads(err_body)
                err_msg = str(err_json.get("message", "")).lower()
            except Exception:
                err_msg = ""

            if "expired" in err_msg:
                return False, "Verification code has expired. Please request a new code."
            elif "not match" in err_msg or "invalid" in err_msg or "wrong" in err_msg:
                return False, "Invalid verification code. Please check and try again."
            elif http_err.code in (401, 403):
                return False, "SMS service configuration error."
            else:
                return False, "Invalid or expired OTP code."

        except (urllib.error.URLError, TimeoutError):
            return False, "Verification service unreachable. Please try again."
        except Exception:
            return False, "Verification failed due to an unexpected error."


class MockSmsProvider(BaseSmsProvider):
    """
    Mock Provider for automated test suites.
    Simulates successful dispatch, verification, rejection, and network errors
    without requiring real network requests or credentials.
    """

    def __init__(
        self,
        is_configured: bool = True,
        send_success: bool = True,
        send_error_code: Optional[str] = None,
        send_message: str = "OTP sent successfully via SMS",
        verify_success: bool = True,
        verify_message: str = "Mobile number verified successfully",
    ):
        self._is_configured = is_configured
        self.send_success = send_success
        self.send_error_code = send_error_code
        self.send_message = send_message
        self.verify_success = verify_success
        self.verify_message = verify_message

        self.dispatched_mobiles: List[str] = []
        self.verified_attempts: List[Tuple[str, str]] = []

    def is_configured(self) -> bool:
        return self._is_configured

    def send_otp(self, mobile: str) -> SmsDeliveryResult:
        self.dispatched_mobiles.append(mobile)
        if not self._is_configured:
            return SmsDeliveryResult(
                success=False,
                message="SMS service is currently unavailable. No production SMS provider is configured.",
                error_code="PROVIDER_NOT_CONFIGURED",
            )
        if not self.send_success:
            return SmsDeliveryResult(
                success=False,
                message=self.send_message,
                error_code=self.send_error_code or "DISPATCH_FAILED",
            )
        return SmsDeliveryResult(
            success=True,
            message=f"{self.send_message} to {mask_phone(mobile)}",
            otp=None,
        )

    def verify_otp(self, mobile: str, otp: str) -> Tuple[bool, str]:
        self.verified_attempts.append((mobile, otp))
        if not self._is_configured:
            return False, "OTP verification is currently unavailable. No production SMS provider is configured."
        return self.verify_success, self.verify_message


# Global provider instance override (for testing)
_MOCK_PROVIDER: Optional[BaseSmsProvider] = None


def set_mock_provider(provider: Optional[BaseSmsProvider]):
    """Injects or resets a mock provider for automated unit tests."""
    global _MOCK_PROVIDER
    _MOCK_PROVIDER = provider


def get_sms_provider(is_production: Optional[bool] = None) -> BaseSmsProvider:
    """Returns the active SMS provider based on configuration and runtime environment."""
    if _MOCK_PROVIDER is not None:
        return _MOCK_PROVIDER

    if is_production is None:
        is_production = (
            os.getenv("ENVIRONMENT", "").lower() in ("production", "prod")
            or os.getenv("FASTAPI_ENV", "").lower() in ("production", "prod")
        )

    if is_production:
        return Msg91SmsProvider()
    return DevelopmentSmsProvider()
