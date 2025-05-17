import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import ScoreCard, { getScoreTextGradient } from "./components/ScoreCard";
import { TestTubeDiagonal, TestTubeDiagonalIcon } from "lucide-react";

const getRating = (score: number) => {
  if (score >= 80) return "Great";
  if (score >= 50) return "Good";
  return "Poor";
};

const Eval = () => {
  const { state: data } = useLocation();
  const navigate = useNavigate();
  const mcpName = data.package_name || "MCP";
  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-8 w-full px-4 overflow-hidden">
      <h1 className="text-2xl font-bold mb-2">{mcpName}</h1>
      <h2 className="text-3xl font-semibold">
        is{" "}
        <span className={getScoreTextGradient(data.score.total)}>
          {getRating(data.score.total)}
        </span>
      </h2>
      <div className="flex flex-row space-x-8 w-full max-w-4xl">
        <ScoreCard title="Security" score={data.score.security} index={0} />
        <ScoreCard title="Spec" score={data.score.spec} index={1} />
        <ScoreCard title="Runtime" score={data.score.runtime} index={2} />
      </div>
      <div className="w-full max-w-4xl">
        <ScoreCard title="Total" score={data.score.total} fullWidth index={3} />
      </div>
      <motion.button
        className="cursor-pointer mt-8 px-6 py-3 bg-purple-500 text-white rounded-lg shadow hover:bg-purple-600 transition-colors flex flex-row gap-2 items-center"
        onClick={() => navigate("/")}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.75 }}
      >
        <TestTubeDiagonal className="w-4 h-4" />
        Evaluate another MCP Server
      </motion.button>
    </div>
  );
};

export default Eval;
