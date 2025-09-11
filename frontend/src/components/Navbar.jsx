// frontend/src/components/Navbar.jsx
import React, { useContext, useState } from "react";
import {
  FiSave,
  FiFolder,
  FiPlay,
  FiUpload,
  FiBook,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import { ProjectContext } from "../context/ProjectContext";
import AIModal from "./AIModal";
import {
  saveProject,
  loadProject,
  deployProject,
} from "../services/projectService";
import { parseRoutes } from "../services/parserService";

const Navbar = () => {
  const { code, setCode, routes, setRoutes, projectId, setProjectId } =
    useContext(ProjectContext);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  const handleLoadProject = async () => {
    try {
      // Use saved projectId or prompt for ID (e.g., via input or dropdown)
      const id =
        projectId ||
        prompt("Enter Project ID (e.g., 68bee2faf42199d7e0ec422a):");
      if (!id) {
        console.log("No project ID provided");
        return;
      }
      const project = await loadProject(id);
      setCode(project.versions[0].code);
      setRoutes(project.versions[0].routes);
      setProjectId(project._id);
      console.log("Project loaded:", project);
    } catch (error) {
      console.error("Load project error:", error);
    }
  };

  const handleSaveProject = async () => {
    try {
      const project = await saveProject(code, routes);
      setProjectId(project._id);
      console.log("Project saved:", project);
    } catch (error) {
      console.error("Save project error:", error);
    }
  };

  const handleDeploy = async () => {
    try {
      if (!projectId) throw new Error("No project selected");
      const result = await deployProject(projectId);
      console.log("Deployment:", result);
    } catch (error) {
      console.error("Deploy error:", error);
    }
  };

  const handleShowDocs = async () => {
    try {
      const newRoutes = await parseRoutes(code); // Send editor code to backend
      setRoutes(newRoutes);
    } catch (error) {
      console.error("Parse routes error:", error);
    }
  };

  const handleAIAssist = () => {
    setIsAIModalOpen(true);
  };

  const handleAISubmit = (prompt) => {
    // Placeholder: Call xAI API[](https://x.ai/api)
    console.log("AI Prompt:", prompt);
    setCode(code + "\n// AI suggestion: Add error handling");
  };

  const handleToggleCollab = () => {
    // Placeholder for toggling collaboration mode
    console.log("Toggling collaboration...");
  };

  return (
    <nav className="bg-gradient-to-r from-slate-900 to-slate-800 text-slate-50 shadow-lg sticky top-0 z-50 border-b border-slate-700">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="text-3xl font-extrabold font-['Inter',_sans-serif] tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300 hover:animate-pulse-slow">
            Dev
          </span>
          <span className="text-slate-100">Deck</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium py-2 px-4 rounded-xl transition-all duration-300 ease-in-out hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 group"
            aria-label="Load Project"
            onClick={handleLoadProject}
          >
            <FiFolder className="text-blue-400" size={18} />
            <span>Load</span>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-slate-700 text-slate-100 text-xs font-medium px-2 py-1 rounded-md shadow-md">
              Open a saved project
            </span>
          </button>
          <button
            className="relative flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-xl transition-all duration-300 ease-in-out hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 group"
            aria-label="Save Project"
            onClick={handleSaveProject}
          >
            <FiSave size={18} />
            <span>Save</span>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-slate-700 text-slate-100 text-xs font-medium px-2 py-1 rounded-md shadow-md">
              Save current project
            </span>
          </button>
          <button
            className="relative flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white font-medium py-2 px-4 rounded-xl transition-all duration-300 ease-in-out hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 group"
            aria-label="Run Request"
          >
            <FiPlay size={18} />
            <span>Run</span>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-slate-700 text-slate-100 text-xs font-medium px-2 py-1 rounded-md shadow-md">
              Execute API request
            </span>
          </button>
          <button
            className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium py-2 px-4 rounded-xl transition-all duration-300 ease-in-out hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 group"
            aria-label="Deploy Project"
            onClick={handleDeploy}
          >
            <FiUpload size={18} />
            <span>Deploy</span>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-slate-700 text-slate-100 text-xs font-medium px-2 py-1 rounded-md shadow-md">
              Deploy to sandbox
            </span>
          </button>
          <button
            className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium py-2 px-4 rounded-xl transition-all duration-300 ease-in-out hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 group"
            aria-label="Show API Docs"
            onClick={handleShowDocs}
          >
            <FiBook size={18} />
            <span>Docs</span>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-slate-700 text-slate-100 text-xs font-medium px-2 py-1 rounded-md shadow-md">
              View API documentation
            </span>
          </button>
          <button
            className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium py-2 px-4 rounded-xl transition-all duration-300 ease-in-out hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 group"
            aria-label="AI Assistant"
            onClick={handleAIAssist}
          >
            <FiZap size={18} />
            <span>AI</span>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-slate-700 text-slate-100 text-xs font-medium px-2 py-1 rounded-md shadow-md">
              Get AI suggestions
            </span>
          </button>
          <button
            className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-xl transition-all duration-300 ease-in-out hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 group"
            aria-label="Toggle Collaboration"
            onClick={handleToggleCollab}
          >
            <FiUsers size={18} />
            <span>Collab</span>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-slate-700 text-slate-100 text-xs font-medium px-2 py-1 rounded-md shadow-md">
              Toggle collaborative mode
            </span>
          </button>
        </div>
      </div>
      <AIModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onSubmit={handleAISubmit}
      />
    </nav>
  );
};

export default Navbar;
