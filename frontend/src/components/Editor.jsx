// src/components/Editor.jsx
import { useContext, useState } from "react";
import { FiCode, FiGitBranch } from "react-icons/fi";
import Editor from "@monaco-editor/react";
import { ProjectContext } from "../context/ProjectContext";

export default function CodeEditor() {
  const { code, setCode } = useContext(ProjectContext);
  const [language, setLanguage] = useState("javascript");
  const [framework, setFramework] = useState("express");

  const languages = [
    { value: "javascript", label: "JavaScript" },
    { value: "python", label: "Python" },
    { value: "typescript", label: "TypeScript" },
    { value: "json", label: "JSON" },
  ];

  const frameworks = [
    { value: "express", label: "Express.js" },
    // Add more later: Flask, FastAPI, Spring Boot
  ];

  return (
    <div className="w-full rounded-lg bg-slate-900 border border-slate-700 shadow-lg">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 rounded-lg">
        <div className="flex items-center gap-2 text-slate-100">
          <FiCode size={20} className="text-blue-400" />
          <span className="font-medium font-['Inter']">Code Editor</span>
        </div>
        <div className="flex gap-2">
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            className="bg-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            aria-label="Select Framework"
          >
            {frameworks.map((fw) => (
              <option key={fw.value} value={fw.value}>
                {fw.label}
              </option>
            ))}
          </select>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            aria-label="Select Language"
          >
            {languages.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Monaco Editor */}
      <Editor
        height="calc(80vh - 72px)" 
        language={language}
        value={code}
        theme="vs-dark"
        onChange={(value) => setCode(value)}
        options={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          glyphMargin: true,
          folding: true,
          renderLineHighlight: "all",
          scrollbar: {
            vertical: "visible",
            horizontal: "visible",
          },
        }}
      />

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-slate-800 border-t border-slate-700 text-sm text-slate-200 rounded-lg">
        <span>
          Ln {code.split("\n").length}, Col {code.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1 text-blue-400 hover:text-blue-500"
            aria-label="View Version History"
          >
            <FiGitBranch size={16} />
            <span>Version History</span>
          </button>
          <span>
            {language.toUpperCase()} ({framework})
          </span>
        </div>
      </div>
    </div>
  );
}
