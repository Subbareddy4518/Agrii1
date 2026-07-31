import { useEffect, useState } from "react";
import SplashScreen from "./SplashScreen";
import WelcomeScreen from "./WelcomeScreen";
import LanguageSelection from "./LanguageSelection";
import VoiceSetup from "./VoiceSetup";

export default function Onboarding({ onFinish }) {
  const [step, setStep] = useState("splash");

  const [preferences, setPreferences] = useState({
    language: localStorage.getItem("agriconnect_language") || "en",
    voice: localStorage.getItem("agriconnect_voice") === "true",
    completed: false,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setStep("welcome");
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  const next = () => {
    switch (step) {
      case "welcome":
        setStep("language");
        break;

      case "language":
        setStep("voice");
        break;

      case "voice":
        const finalPreferences = {
          ...preferences,
          completed: true,
        };

        localStorage.setItem(
          "agriconnect_preferences",
          JSON.stringify(finalPreferences)
        );

        onFinish();
        break;

      default:
        break;
    }
  };

  const back = () => {
    switch (step) {
      case "language":
        setStep("welcome");
        break;

      case "voice":
        setStep("language");
        break;

      default:
        break;
    }
  };

  if (step === "splash") return <SplashScreen />;

  if (step === "welcome")
    return <WelcomeScreen onNext={next} />;

  if (step === "language")
    return (
      <LanguageSelection
        onNext={next}
        onBack={back}
        preferences={preferences}
        setPreferences={setPreferences}
      />
    );

  if (step === "voice")
    return (
      <VoiceSetup
        onNext={next}
        onBack={back}
        preferences={preferences}
        setPreferences={setPreferences}
      />
    );

  return null;
}