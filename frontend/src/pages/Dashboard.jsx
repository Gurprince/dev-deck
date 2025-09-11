// frontend/src/pages/Dashboard.jsx
import React, { useState, useContext, useRef, useEffect } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import Navbar from "../components/Navbar";
import CodeEditor from "../components/Editor";
import RoutePanel from "../components/RoutePanel";
import TestPanel from "../components/TestPanel";
import LogsPanel from "../components/LogsPanel";
import { FiBookOpen, FiUsers, FiGitBranch, FiTool } from "react-icons/fi";
import { ProjectContext } from "../context/ProjectContext";
import { getVersions, rollbackVersion } from "../services/projectService";
import { generateSwaggerSpec } from "../services/parserService";

const Dashboard = () => {
  const { code, routes, setCode, setRoutes, projectId } =
    useContext(ProjectContext);
  const [activeTab, setActiveTab] = useState("editor");
  const [collaborators, setCollaborators] = useState([
    { id: 1, name: "Dev1", status: "online" },
    { id: 2, name: "Dev2", status: "offline" },
  ]);
  const [panelWidth, setPanelWidth] = useState(33.33);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [versions, setVersions] = useState([]);
  const containerRef = useRef(null);
  const isDragging = useRef(false);

  // SSE for collaboration and logs
  useEffect(() => {
    if (!projectId) return; // Skip if no projectId
    const eventSource = new EventSource(
      `http://localhost:3000/api/events/${projectId}`
    );
    eventSource.addEventListener("collaborator-update", (event) => {
      setCollaborators(JSON.parse(event.data));
    });
    eventSource.addEventListener("logs", (event) => {
      console.log("Logs:", JSON.parse(event.data));
    });
    eventSource.addEventListener("error", (event) => {
      console.error("SSE error:", event.data);
      // Optionally display error to user
      // alert("SSE connection failed: " + (event.data || "Unknown error"));
    });
    eventSource.onerror = () => {
      console.error("SSE connection error, retrying in 5 seconds...");
      eventSource.close();
      setTimeout(() => {
        // Retry connection
        setCollaborators([...collaborators]); // Trigger re-render to restart useEffect
      }, 5000);
    };
    return () => eventSource.close();
  }, [projectId, collaborators]);

  // Load versions
  useEffect(() => {
    const fetchVersions = async () => {
      if (!projectId) {
        console.log("No project ID, skipping version fetch");
        return;
      }
      try {
        const versions = await getVersions(projectId);
        setVersions(versions);
      } catch (error) {
        console.error("Fetch versions error:", error);
      }
    };
    fetchVersions();
  }, [projectId]);

  // Handle panel resizing
  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseMove = (e) => {
    if (isDragging.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth =
        ((containerRect.right - e.clientX) / containerRect.width) * 100;
      if (newWidth >= 20 && newWidth <= 50) {
        setPanelWidth(newWidth);
      }
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleRollback = async (versionId) => {
    if (!projectId) return;
    try {
      const project = await rollbackVersion(projectId, versionId);
      setCode(project.code);
      setRoutes(project.routes);
    } catch (error) {
      console.error("Rollback error:", error);
    }
  };

  const handleTogglePlugin = (pluginId) => {
    setPlugins(
      plugins.map((plugin) =>
        plugin.id === pluginId
          ? { ...plugin, enabled: !plugin.enabled }
          : plugin
      )
    );
    console.log("Toggled plugin:", pluginId);
  };

  const [plugins, setPlugins] = useState([
    { id: "mock-db", name: "Mock DB", enabled: true },
    { id: "auth-middleware", name: "Auth Middleware", enabled: false },
  ]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <Navbar />
      <main className="container mx-auto px-6 py-8" ref={containerRef}>
        <div className="flex gap-6" style={{ position: "relative" }}>
          <section style={{ width: `${100 - panelWidth}%` }}>
            <div className="flex items-center justify-between mb-4 bg-slate-800 rounded-xl p-2 shadow-md">
              <div className="flex gap-2">
                <button
                  className={`px-4 py-2 rounded-lg font-medium font-['Inter'] transition-all duration-300 hover:animate-pulse-slow ${
                    activeTab === "editor"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-100 hover:bg-slate-600"
                  }`}
                  onClick={() => setActiveTab("editor")}
                >
                  Editor
                </button>
                <button
                  className={`px-4 py-2 rounded-lg font-medium font-['Inter'] transition-all duration-300 hover:animate-pulse-slow ${
                    activeTab === "docs"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-100 hover:bg-slate-600"
                  }`}
                  onClick={() => setActiveTab("docs")}
                >
                  <FiBookOpen className="inline mr-1" /> API Docs
                </button>
                <button
                  className={`px-4 py-2 rounded-lg font-medium font-['Inter'] transition-all duration-300 hover:animate-pulse-slow ${
                    activeTab === "versions"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-100 hover:bg-slate-600"
                  }`}
                  onClick={() => setActiveTab("versions")}
                >
                  <FiGitBranch className="inline mr-1" /> Versions
                </button>
                <button
                  className={`px-4 py-2 rounded-lg font-medium font-['Inter'] transition-all duration-300 hover:animate-pulse-slow ${
                    activeTab === "plugins"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-100 hover:bg-slate-600"
                  }`}
                  onClick={() => setActiveTab("plugins")}
                >
                  <FiTool className="inline mr-1" /> Plugins
                </button>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-200">
                <FiUsers size={18} />
                <div className="flex -space-x-2">
                  {collaborators.map((collab) => (
                    <div
                      key={collab.id}
                      className="relative w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-100 border border-slate-600 transition-all duration-200 hover:scale-110"
                      title={`${collab.name} (${collab.status})`}
                    >
                      {collab.name[0]}
                      <span
                        className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
                          collab.status === "online"
                            ? "bg-green-500"
                            : "bg-slate-500"
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <span>{collaborators.length} collaborators</span>
              </div>
            </div>
            {activeTab === "editor" && <CodeEditor />}
            {activeTab === "docs" && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
                <h2 className="text-lg font-semibold font-['Inter']  text-slate-100 mb-4">
                  API Documentation
                </h2>
                {routes.length ? (
                  <SwaggerUI spec={generateSwaggerSpec(routes)} />
                ) : (
                  <p className="text-slate-400 font-mono">No routes defined</p>
                )}
              </div>
            )}
            {activeTab === "versions" && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
                <h2 className="text-lg font-semibold font-['Inter'] text-slate-100 mb-4">
                  Version History
                </h2>
                {projectId ? (
                  <ul className="text-sm text-slate-200 font-mono space-y-2">
                    {versions.length ? (
                      versions.map((version) => (
                        <li
                          key={version._id}
                          className="p-2 rounded-lg hover:bg-slate-700 cursor-pointer transition-all duration-200 flex justify-between items-center"
                        >
                          <span>
                            {version.name} -{" "}
                            {new Date(version.timestamp).toLocaleString()}
                          </span>
                          <button
                            className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-1 px-3 rounded-lg transition-all duration-300"
                            onClick={() => handleRollback(version._id)}
                          >
                            Rollback
                          </button>
                        </li>
                      ))
                    ) : (
                      <p className="text-slate-400">No versions available</p>
                    )}
                  </ul>
                ) : (
                  <p className="text-slate-400">
                    Save a project to view versions
                  </p>
                )}
              </div>
            )}
            {activeTab === "plugins" && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
                <h2 className="text-lg font-semibold font-['Inter'] text-slate-100 mb-4">
                  Plugins
                </h2>
                <ul className="text-sm text-slate-200 space-y-2">
                  {plugins.map((plugin) => (
                    <li
                      key={plugin.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700 transition-all duration-200"
                    >
                      <span>{plugin.name}</span>
                      <button
                        className={`font-medium py-1 px-3 rounded-lg transition-all duration-300 ${
                          plugin.enabled
                            ? "bg-green-500 hover:bg-green-400 text-white"
                            : "bg-slate-700 hover:bg-slate-600 text-slate-100"
                        }`}
                        onClick={() => handleTogglePlugin(plugin.id)}
                        aria-label={`${plugin.enabled ? "Disable" : "Enable"} ${
                          plugin.name
                        }`}
                      >
                        {plugin.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          <div
            className="w-1 bg-slate-700 hover:bg-blue-500 cursor-col-resize transition-colors duration-200"
            onMouseDown={handleMouseDown}
          />
          <section
            style={{ width: `${panelWidth}%` }}
            className="flex flex-col gap-6"
          >
            <RoutePanel onSelectRoute={setSelectedRoute} />
            <TestPanel selectedRoute={selectedRoute} />
            <LogsPanel />
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
