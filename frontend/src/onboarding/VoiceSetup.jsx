import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function VoiceSetup({ onNext }) {
  const [voiceChoice, setVoiceChoice] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const language =
    localStorage.getItem("agriconnect_language") || "en";

  const speak = (text) => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    if (language === "te") utterance.lang = "te-IN";
    else if (language === "hi") utterance.lang = "hi-IN";
    else utterance.lang = "en-US";

    utterance.rate = 0.95;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  };

  const finish = (enabled) => {
    if (loading) return;

    setLoading(true);
    setVoiceChoice(enabled);

    localStorage.setItem(
      "agriconnect_voice",
      enabled ? "true" : "false"
    );

    if (enabled) {
      if (language === "te") {
        speak("అగ్రికనెక్ట్‌కు స్వాగతం. వాయిస్ గైడెన్స్ ప్రారంభించబడింది.");
      } else if (language === "hi") {
        speak("एग्रीकनेक्ट में आपका स्वागत है। वॉइस गाइडेंस सक्षम कर दिया गया है।");
      } else {
        speak(
          "Welcome to AgriConnect. Voice guidance has been enabled."
        );
      }
    }

    setShowSuccess(true);

    setTimeout(() => {
      onNext();
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 flex items-center justify-center px-6">

      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center relative"
      >

        <div className="text-6xl mb-5">
          🔊
        </div>

        <h1 className="text-3xl font-bold text-green-900">
          Voice Guidance
        </h1>

        <p className="mt-4 text-gray-600">
          Enable voice assistance to hear important labels,
          buttons and information throughout the app.
        </p>

        <button
          disabled={loading}
          onClick={() => finish(true)}
          className={`mt-8 w-full py-4 rounded-xl font-semibold transition ${
            voiceChoice === true
              ? "bg-green-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          } ${loading ? "cursor-not-allowed opacity-80" : ""}`}
        >
          🔊 Enable Voice Guidance
        </button>

        <button
          disabled={loading}
          onClick={() => finish(false)}
          className={`mt-4 w-full py-4 rounded-xl transition ${
            voiceChoice === false
              ? "bg-gray-300"
              : "bg-gray-100 hover:bg-gray-200"
          } ${loading ? "cursor-not-allowed opacity-80" : ""}`}
        >
          Skip
        </button>

        <motion.button
          whileHover={{ scale: voiceChoice !== null ? 1.04 : 1 }}
          whileTap={{ scale: voiceChoice !== null ? 0.96 : 1 }}
          disabled={voiceChoice === null}
          className={`mt-8 px-10 py-3 rounded-full font-semibold transition ${
            voiceChoice === null
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-green-700 hover:bg-green-800 text-white"
          }`}
        >
          Continue →
        </motion.button>

        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute left-1/2 -translate-x-1/2 bottom-6 bg-green-100 text-green-800 rounded-xl px-6 py-4 shadow-lg"
            >
              <div className="text-2xl mb-1">✅</div>

              <div className="font-semibold">
                {voiceChoice
                  ? "Voice Guidance Enabled"
                  : "Voice Guidance Skipped"}
              </div>

              <div className="text-sm mt-1">
                Moving to Login...
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}