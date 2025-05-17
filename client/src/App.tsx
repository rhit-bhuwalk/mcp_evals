import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./Landing";
import Eval from "./Eval";

const App = () => {
  return (
    <div className="bg-gray-100 min-h-screen">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/eval" element={<Eval />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;
