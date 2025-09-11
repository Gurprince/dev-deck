// frontend/src/components/LogsPanel.jsx
import React, { useState, useEffect, useContext } from "react";
import { ProjectContext } from "../context/ProjectContext";
import axios from "axios";

const LogsPanel = () => {
  const { projectId } = useContext(ProjectContext);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!projectId) return;
    const fetchLogs = async () => {
      try {
        const response = await axios.get(
          `http://localhost:3000/api/events/${projectId}`
        );
        setLogs(response.data.logs || []);
      } catch (error) {
        console.error("Fetch logs error:", error);
      }
    };
    fetchLogs();
  }, [projectId]);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
      <h2 className="text-lg font-semibold font-['Inter'] text-slate-100 mb-4">
        Logs
      </h2>
      <div className="bg-slate-900 p-3 rounded-lg text-sm text-slate-200 font-mono overflow-auto h-48">
        {logs.length ? (
          logs.map((log, index) => <div key={index}>{log}</div>)
        ) : (
          <p className="text-slate-400">No logs available</p>
        )}
      </div>
    </div>
  );
};

export default LogsPanel;
