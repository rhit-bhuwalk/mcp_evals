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
      <span className="flex">
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
    start_cmd: "",
    port: 3333,
    spec_url: "",
    auth_env: "",
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
    const formData = Object.entries(form).reduce<typeof form>(
      (acc, [key, value]) => {
        if (value !== "") {
          acc[key as keyof typeof form] = value as never;
        }
        return acc;
      },
      {} as typeof form
    );
    setLoading(true);
    const response = await api.post("/eval", formData);
    setLoading(false);
    navigate("/eval", {
      state: { ...response.data, package_name: form.package_name },
    });
  };

  return (
    <AnimatePresence>
      {loading ? (
        <Spinner key="spinner" />
      ) : (
        <motion.div
          className="flex flex-col items-center justify-center min-h-screen"
          initial="hidden"
          animate="visible"
        >
          <motion.h1
            className="text-7xl font-bold mb-8 text-purple-700"
            variants={fieldVariants}
          >
            MCP Eval
          </motion.h1>
          <motion.form
            className="flex flex-col items-center space-y-4"
            onSubmit={handleSubmit}
            variants={formVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.input
              type="text"
              name="package_name"
              placeholder="Package Name"
              className="p-2 text-lg w-full max-w-md border border-gray-300 rounded"
              value={form.package_name}
              onChange={handleChange}
              required
              variants={fieldVariants}
            />
            <motion.input
              type="text"
              name="start_cmd"
              placeholder="Start Command"
              className="p-2 text-lg w-full max-w-md border border-gray-300 rounded"
              value={form.start_cmd}
              onChange={handleChange}
              variants={fieldVariants}
            />
            <motion.input
              type="number"
              name="port"
              placeholder="Port (default: 3333)"
              className="p-2 text-lg w-full max-w-md border border-gray-300 rounded"
              value={form.port}
              onChange={handleChange}
              variants={fieldVariants}
            />
            <motion.input
              type="text"
              name="spec_url"
              placeholder="Spec URL (optional)"
              className="p-2 text-lg w-full max-w-md border border-gray-300 rounded"
              value={form.spec_url}
              onChange={handleChange}
              variants={fieldVariants}
            />
            <motion.input
              type="text"
              name="auth_env"
              placeholder="Auth Env (optional)"
              className="p-2 text-lg w-full max-w-md border border-gray-300 rounded"
              value={form.auth_env}
              onChange={handleChange}
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
