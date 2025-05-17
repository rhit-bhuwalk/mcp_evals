import React, { useState } from "react";
import api from "./lib/api";
import { TestTubeDiagonal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const spinnerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const Spinner = () => (
  <motion.div
    className="flex flex-col items-center justify-center min-h-screen"
    initial="hidden"
    animate="visible"
    variants={spinnerVariants}
  >
    <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6"></div>
    <div className="flex flex-row items-center">
      <span className="text-lg font-semibold text-gray-700 mb-1">
        Evaluating
      </span>
      <span className="flex text-lg">
        <span
          className="inline-block animate-bounce"
          style={{ animationDelay: "0ms" }}
        >
          .
        </span>
        <span
          className="inline-block animate-bounce"
          style={{ animationDelay: "150ms" }}
        >
          .
        </span>
        <span
          className="inline-block animate-bounce"
          style={{ animationDelay: "300ms" }}
        >
          .
        </span>
      </span>
    </div>
  </motion.div>
);

const formVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

const fieldVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const Landing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    package_name: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "port" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const response = await api.post("/eval", form);
    setLoading(false);
    navigate("/eval", {
      state: {
        ...response.data,
        security: response.data.score,
        package_name: form.package_name,
      },
    });
  };

  return (
    <AnimatePresence>
      {loading ? (
        <Spinner key="spinner" />
      ) : (
        <motion.div
          className="flex flex-col items-center justify-center min-h-screen w-full max-w-3xl mx-auto px-4"
          initial="hidden"
          animate="visible"
        >
          <motion.h1
            className="text-7xl font-bold mb-8 text-purple-700"
            variants={fieldVariants}
          >
            MCP Eval
          </motion.h1>
          <motion.p
            className="text-xl text-gray-600 mb-8"
            variants={fieldVariants}
          >
            Your go-to solution for evaluating and refining MCP servers
          </motion.p>
          <motion.form
            className="flex flex-col items-center space-y-4 w-full"
            onSubmit={handleSubmit}
            variants={formVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.input
              type="text"
              name="package_name"
              placeholder="Package Name"
              className="p-2 text-lg w-3/4 min-w-[300px] border border-gray-300 rounded"
              value={form.package_name}
              onChange={handleChange}
              required
              variants={fieldVariants}
            />
            <motion.button
              type="submit"
              className="items-center flex flex-row gap-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 cursor-pointer"
              variants={fieldVariants}
            >
              <TestTubeDiagonal className="h-4 w-4" />
              Evaluate
            </motion.button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Landing;
