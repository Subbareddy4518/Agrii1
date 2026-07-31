import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const languages = [
  {
    code: "en",
    name: "English",
    native: "English",
    flag: "🇬🇧",
    message: "English has been selected.",
    success: "Language Selected",
    lang: "en-US",
  },
  {
    code: "te",
    name: "Telugu",
    native: "తెలుగు",
    flag: "🇮🇳",
    message: "తెలుగు భాష ఎంపిక చేయబడింది.",
    success: "భాష ఎంపిక చేయబడింది",
    lang: "te-IN",
  },
  {
    code: "hi",
    name: "Hindi",
    native: "हिन्दी",
    flag: "🇮🇳",
    message: "हिन्दी भाषा चुनी गई है।",
    success: "भाषा चुन ली गई",
    lang: "hi-IN",
  },
];

export default function LanguageSelection({ onNext }) {
  const [selected, setSelected] = useState(
    localStorage.getItem("agriconnect_language") || "en"
  );

  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [loading, setLoading] = useState(false);

  const speak = (text, lang) => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  };

  const handleSelect = (lang) => {
    if (loading) return;

    setLoading(true);
    setSelected(lang.code);
    setSelectedLanguage(lang);
    setShowSuccess(true);

    localStorage.setItem("agriconnect_language", lang.code);

    speak(lang.message, lang.lang);

    setTimeout(() => {
      onNext();
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 flex flex-col justify-center items-center px-6 text-white relative">

      <motion.h1
        initial={{ opacity: 0, y: -25 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold mb-3"
      >
        🌍 Choose Your Language
      </motion.h1>

      <p className="text-green-100 mb-10 text-center max-w-md">
        Select your preferred language. You can change it later in Settings.
      </p>

      <div className="w-full max-w-md space-y-4">

        {languages.map((lang) => (
          <motion.button
            key={lang.code}
            whileHover={{ scale: loading ? 1 : 1.03 }}
            whileTap={{ scale: loading ? 1 : 0.97 }}
            disabled={loading}
            onClick={() => handleSelect(lang)}
            className={`w-full p-5 rounded-2xl border transition text-left ${
              selected === lang.code
                ? "bg-white text-green-800 border-white shadow-xl"
                : "bg-white/10 border-white/20 text-white"
            } ${loading ? "opacity-80 cursor-not-allowed" : ""}`}
          >
            <div className="flex justify-between items-center">

              <div>
                <div className="text-xl font-semibold">
                  {lang.flag} {lang.native}
                </div>

                <div className="text-sm opacity-80">
                  {lang.name}
                </div>
              </div>

              {selected === lang.code && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-2xl"
                >
                  ✅
                </motion.div>
              )}

            </div>
          </motion.button>
        ))}

      </div>

      <AnimatePresence>
        {showSuccess && selectedLanguage && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-10 bg-white text-green-800 rounded-2xl shadow-2xl px-8 py-5 text-center"
          >
            <div className="text-4xl mb-2">✅</div>

            <h2 className="font-bold text-xl">
              {selectedLanguage.success}
            </h2>

            <p className="mt-2 text-lg">
              {selectedLanguage.flag} {selectedLanguage.native}
            </p>

            <p className="text-sm text-gray-500 mt-2">
              Moving to the next step...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}