// src/components/RoutePanel.jsx
import React, { useContext } from "react";
import { FiList, FiBook } from "react-icons/fi";
import { ProjectContext } from "../context/ProjectContext";

export default function RoutePanel({ onSelectRoute }) {
  const { routes } = useContext(ProjectContext);

  const handleGenerateDocs = () => {
    // Placeholder for parserService.js
    console.log("Generating API docs from routes:", routes);
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiList size={20} className="text-blue-400" />
          <h2 className="text-lg font-semibold font-['Inter'] text-slate-100">
            Routes
          </h2>
        </div>
        <button
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium py-1 px-3 rounded-lg transition-all duration-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
          onClick={handleGenerateDocs}
          aria-label="Generate API Docs"
        >
          <FiBook size={16} />
          <span>Generate Docs</span>
        </button>
      </div>
      <ul className="text-sm text-slate-200 font-mono space-y-2">
        {routes.length ? (
          routes.map((route, index) => (
            <li
              key={index}
              className="p-2 rounded-lg hover:bg-slate-700 cursor-pointer transition-all duration-200"
              onClick={() => onSelectRoute(route)}
            >
              <span className="text-green-400">{route.method}</span>{" "}
              {route.path}
              <p className="text-slate-400 text-xs">
                {route.description || "No description"}
              </p>
            </li>
          ))
        ) : (
          <li className="text-slate-400">No routes detected</li>
        )}
      </ul>
    </div>
  );
}
