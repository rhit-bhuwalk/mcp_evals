import React, { useState } from "react";
import { kushApi, arianApi } from "./lib/api";
import { File, TestTubeDiagonal } from "lucide-react";
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
    mcp_json: "",
  });
  const [apiJsonFile, setApiJsonFile] = useState<File | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setApiJsonFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const response = await kushApi.post("/eval", {
      package_name: form.package_name,
    });

    let specDataJson = null;
    if (apiJsonFile) {
      const fileText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(apiJsonFile);
      });
      try {
        specDataJson = JSON.parse(fileText);
      } catch (err) {
        alert("Uploaded file is not valid JSON.");
        setLoading(false);
        return;
      }
    }

    let specConfigJson = {};
    if (form.mcp_json && form.mcp_json.trim() !== "") {
      try {
        specConfigJson = JSON.parse(form.mcp_json.trim());
      } catch (err) {
        alert("MCP JSON is not valid JSON.");
        setLoading(false);
        return;
      }
    }

    const spec = {
      spec_name: form.package_name,
      spec_data: specDataJson,
      spec_config: specConfigJson,
    };

    const arianResponse = await arianApi.post("/spec", spec, {
      headers: { "Content-Type": "application/json" },
    });
    console.log(arianResponse);
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
            <motion.input
              type="text"
              name="mcp_json"
              placeholder="MCP JSON (string)"
              className="p-2 text-lg w-3/4 min-w-[300px] border border-gray-300 rounded"
              value={form.mcp_json}
              onChange={handleChange}
              // required
              variants={fieldVariants}
            />
            <motion.div
              className="w-3/4 min-w-[300px] flex flex-col items-start"
              variants={fieldVariants}
            >
              <div className="relative w-full">
                <input
                  id="api_json_upload"
                  type="file"
                  name="api_json"
                  accept="application/json"
                  className="hidden"
                  onChange={handleFileChange}
                  // required
                />
                <label
                  htmlFor="api_json_upload"
                  className="cursor-pointer px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors shadow text-center block w-full"
                >
                  {apiJsonFile ? "Change File" : "Upload API JSON"}
                </label>
                {apiJsonFile && (
                  <span className="block mt-2 text-sm text-gray-600 truncate">
                    {apiJsonFile.name}
                  </span>
                )}
              </div>
            </motion.div>
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
