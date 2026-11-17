"""
CORS Preflight and Configuration Tests for AgriConnect API.

Verifies:
1. Allowed origins include the production origin (https://agrii-subbu8.vercel.app).
2. Existing localhost and other Vercel deployment origins are preserved.
3. allow_credentials remains True.
4. Wildcard origins are not used when credentials are enabled.
5. OPTIONS preflight requests return correct CORS headers for the production origin and other allowed origins.
6. Unauthorized origins are rejected without Access-Control-Allow-Origin header.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from starlette.datastructures import Headers
from starlette.middleware.cors import CORSMiddleware
from main import app


class TestCORSPreflight(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Locate CORSMiddleware configuration from the FastAPI app
        cors_middlewares = [m for m in app.user_middleware if m.cls == CORSMiddleware]
        if not cors_middlewares:
            raise RuntimeError("CORSMiddleware not configured on FastAPI application")
        
        cls.cors_config = cors_middlewares[0].kwargs
        cls.cors_handler = CORSMiddleware(app, **cls.cors_config)
        cls.prod_origin = "https://agrii-subbu8.vercel.app"
        cls.existing_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://agrii-git-main-subbu8.vercel.app",
            "https://agrii-woad.vercel.app",
            "https://agrii-33v0ykdl0-subbu8.vercel.app",
        ]

    def test_01_cors_configuration_parameters(self):
        """Verify middleware configuration options."""
        origins = self.cors_config.get("allow_origins", [])
        
        # Production origin must be present
        self.assertIn(self.prod_origin, origins, f"Production origin {self.prod_origin} missing from allow_origins")
        
        # Existing origins must be preserved
        for origin in self.existing_origins:
            self.assertIn(origin, origins, f"Existing origin {origin} missing from allow_origins")
            
        # allow_credentials must remain True
        self.assertTrue(self.cors_config.get("allow_credentials"), "allow_credentials must be True")
        
        # Wildcard origin MUST NOT be used with credentials
        self.assertNotIn("*", origins, "Wildcard '*' origin must not be used when allow_credentials is True")

    def test_02_production_origin_options_preflight(self):
        """Verify OPTIONS preflight request to /api/auth/register from production origin."""
        headers = Headers({
            "origin": self.prod_origin,
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
        })
        response = self.cors_handler.preflight_response(headers)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), self.prod_origin)
        self.assertEqual(response.headers.get("access-control-allow-credentials"), "true")
        self.assertIn("POST", response.headers.get("access-control-allow-methods", ""))
        self.assertIn("content-type", response.headers.get("access-control-allow-headers", "").lower())

    def test_03_existing_origins_options_preflight(self):
        """Verify OPTIONS preflight request from each existing origin."""
        for origin in self.existing_origins:
            headers = Headers({
                "origin": origin,
                "access-control-request-method": "POST",
                "access-control-request-headers": "content-type",
            })
            response = self.cors_handler.preflight_response(headers)

            self.assertEqual(response.status_code, 200, f"Failed preflight for origin: {origin}")
            self.assertEqual(
                response.headers.get("access-control-allow-origin"),
                origin,
                f"Origin header mismatch for: {origin}"
            )
            self.assertEqual(response.headers.get("access-control-allow-credentials"), "true")

    def test_04_unauthorized_origin_preflight_rejected(self):
        """Verify unauthorized origin receives 400 and no Access-Control-Allow-Origin."""
        unauthorized = "https://malicious-website.example.com"
        headers = Headers({
            "origin": unauthorized,
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
        })
        response = self.cors_handler.preflight_response(headers)

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access-control-allow-origin", response.headers)

    def test_05_options_preflight_various_auth_methods(self):
        """Verify preflight for standard allowed methods."""
        for method in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
            headers = Headers({
                "origin": self.prod_origin,
                "access-control-request-method": method,
                "access-control-request-headers": "authorization, content-type",
            })
            response = self.cors_handler.preflight_response(headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers.get("access-control-allow-origin"), self.prod_origin)
            self.assertIn(method, response.headers.get("access-control-allow-methods", ""))


if __name__ == "__main__":
    unittest.main()
