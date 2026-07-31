import { motion } from "framer-motion";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 flex flex-col items-center justify-center text-white overflow-hidden">

      {/* Animated Logo */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="text-7xl"
      >
        🌾
      </motion.div>

      {/* App Name */}
      <motion.h1
        initial={{ y: 25, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6 text-5xl font-extrabold tracking-wide"
      >
        AgriConnect
      </motion.h1>

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-4 text-green-100 text-lg text-center max-w-md"
      >
        Connecting Farmers Directly with Industries
      </motion.p>

      {/* Loading Bar */}
      <div className="w-64 h-2 bg-green-700 rounded-full mt-12 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 2 }}
          className="h-full bg-white rounded-full"
        />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-5 text-green-100"
      >
        Loading...
      </motion.p>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 text-sm text-green-200"
      >
        Empowering Farmers with Technology 🌱
      </motion.p>
    </div>
  );
}