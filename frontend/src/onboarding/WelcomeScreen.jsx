import { motion } from "framer-motion";

export default function WelcomeScreen({ onNext }) {
  const features = [
    {
      icon: "💰",
      title: "Fair Prices",
      desc: "Sell crops directly without middlemen.",
    },
    {
      icon: "🤝",
      title: "Direct Communication",
      desc: "Connect with industries instantly.",
    },
    {
      icon: "🛡️",
      title: "Trusted Platform",
      desc: "Secure and transparent transactions.",
    },
    {
      icon: "📈",
      title: "Better Opportunities",
      desc: "Reach more buyers across regions.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 text-white flex flex-col items-center justify-center px-6">

      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7 }}
        className="text-center"
      >
        <div className="text-7xl mb-4">🌾</div>

        <h1 className="text-4xl font-bold">
          Welcome to AgriConnect
        </h1>

        <p className="mt-4 text-green-100 max-w-xl mx-auto">
          Connecting Farmers directly with Industries for
          transparent pricing, trusted communication,
          and smarter agriculture.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10 w-full max-w-4xl"
      >
        {features.map((item) => (
          <div
            key={item.title}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 hover:bg-white/20 transition"
          >
            <div className="text-3xl mb-2">{item.icon}</div>

            <h2 className="text-xl font-semibold">
              {item.title}
            </h2>

            <p className="text-green-100 mt-2 text-sm">
              {item.desc}
            </p>
          </div>
        ))}
      </motion.div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        onClick={onNext}
        className="mt-12 bg-white text-green-800 font-semibold px-10 py-4 rounded-full shadow-xl hover:bg-green-100 transition"
      >
        Get Started →
      </motion.button>
    </div>
  );
}