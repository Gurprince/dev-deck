// frontend/src/components/TestPanel.jsx
import React, { useState } from "react";
import { runRequest } from "../services/testService";

const TestPanel = ({ selectedRoute }) => {
  const [method, setMethod] = useState(selectedRoute?.method || "GET");
  const [url, setUrl] = useState(selectedRoute?.path || "");
  const [headers, setHeaders] = useState(
    '{\n  "Content-Type": "application/json"\n}'
  );
  const [body, setBody] = useState("");
  const [response, setResponse] = useState(null);

  // Update form when selectedRoute changes
  React.useEffect(() => {
    if (selectedRoute) {
      setMethod(selectedRoute.method);
      setUrl(`http://localhost:3000${selectedRoute.path}`); // Use backend URL
    }
  }, [selectedRoute]);

  const handleRunRequest = async () => {
    try {
      console.log("Running request:", { method, url, headers, body });
      const result = await runRequest({ method, url, headers, body });
      setResponse(result);
    } catch (error) {
      console.error("Run request error:", error);
      setResponse({
        status: error.response?.status || 500,
        data: { message: error.message },
      });
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
      <h2 className="text-lg font-semibold font-['Inter'] text-slate-100 mb-4">
        Test API
      </h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full bg-slate-700 text-slate-100 rounded-lg p-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200">
            URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-slate-700 text-slate-100 rounded-lg p-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="http://localhost:3000/api/users"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Headers (JSON)
          </label>
          <textarea
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            className="w-full bg-slate-700 text-slate-100 rounded-lg p-2 border border-slate-600 font-mono text-sm h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='{\n  "Content-Type": "application/json"\n}'
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Body (JSON)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full bg-slate-700 text-slate-100 rounded-lg p-2 border border-slate-600 font-mono text-sm h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='{\n  "key": "value"\n}'
          />
        </div>
        <button
          onClick={handleRunRequest}
          className="bg-green-500 hover:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
        >
          Run Request
        </button>
        {response && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-200">Response</h3>
            <pre className="bg-slate-900 p-3 rounded-lg text-sm text-slate-200 font-mono overflow-auto">
              Status: {response.status}
              <br />
              {JSON.stringify(response.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestPanel;
