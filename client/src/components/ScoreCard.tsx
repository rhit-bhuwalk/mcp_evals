import React, { useState } from "react";
import { motion } from "framer-motion";
import { Info } from "lucide-react";

type Props = {
  title: string;
  score: number | string;
  fullWidth?: boolean;
  index?: number;
};

const scoreDescriptions: Record<string, string> = {
  Security:
    "Security: Assesses the MCP implementation for vulnerabilities and ensures the protocol is followed securely.",
  Spec: "Spec: Measures how closely the MCP implementation adheres to the official Model Context Protocol specification.",
  Runtime:
    "Runtime: Evaluates the MCP server's ability to run, respond, and maintain protocol compliance during operation.",
};

export function getScoreTextGradient(score: number | string) {
  if (typeof score !== "number" || score < 50) {
    // Red to orange-pink gradient
    return "bg-gradient-to-b from-[#FF3D3D] to-[#FFB88C] text-transparent bg-clip-text";
  } else if (score < 80) {
    // Orange to purple gradient
    return "bg-gradient-to-b from-[#FF8C37] to-[#E0237E] text-transparent bg-clip-text";
  } else {
    // Cyan to deep blue gradient
    return "bg-gradient-to-b from-[#00E5B3] to-[#005C97] text-transparent bg-clip-text";
  }
}

const ScoreCard = ({ title, score, fullWidth = false, index = 0 }: Props) => {
  const scoreTextGradient = getScoreTextGradient(score);
  const [showTooltip, setShowTooltip] = useState(false);
  const hasTooltip = title !== "Total" && scoreDescriptions[title];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className={
        fullWidth
          ? "flex flex-col items-center justify-between w-full min-w-[16rem] bg-white rounded-2xl shadow-lg p-4 border border-gray-200"
          : "flex flex-col items-center justify-between w-full aspect-square max-w-xs min-w-[10rem] bg-white rounded-2xl shadow-lg p-4 border border-gray-200"
      }
    >
      <div className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
        {title}
        {hasTooltip && (
          <span
            className="ml-2 relative flex items-center"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            tabIndex={0}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
          >
            <Info className="w-5 h-5 cursor-pointer" />
            {showTooltip && (
              <span className="absolute left-1/2 top-full z-10 mt-2 w-48 -translate-x-1/2 rounded bg-gray-800 text-white text-xs px-3 py-2 shadow-lg whitespace-pre-line">
                {scoreDescriptions[title]}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span className={`text-5xl font-bold ${scoreTextGradient}`}>
          {score}
        </span>
      </div>
    </motion.div>
  );
};

export default ScoreCard;
