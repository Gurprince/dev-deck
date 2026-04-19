// src/components/Editor.jsx
import { useContext, useState } from "react";
import { FiCode, FiGitBranch } from "react-icons/fi";
import Editor from "@monaco-editor/react";
import { ProjectContext } from "../context/ProjectContext";

export default function CodeEditor() {
  const { code, setCode } = useContext(ProjectContext);
  const [language, setLanguage] = useState("javascript");
  const [framework, setFramework] = useState("express");
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });

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
    <div className="flex h-full min-h-[70vh] w-full flex-col overflow-hidden rounded-lg border border-[#2b2b30] bg-[#111113] shadow-lg">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-[#2b2b30] bg-[#18181b] px-4 py-2">
        <div className="flex min-w-0 items-center gap-2 text-slate-100">
          <FiCode size={20} className="shrink-0 text-sky-400" />
          <div className="min-w-0">
            <span className="block truncate font-medium font-['Inter']">Code Editor</span>
            <span className="block text-xs text-[#a1a1aa]">Format on type - Word wrap - Route ready</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            className="rounded-md border border-[#3c3c3c] bg-[#2d2d30] px-3 py-1.5 text-sm font-medium text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
            className="rounded-md border border-[#3c3c3c] bg-[#2d2d30] px-3 py-1.5 text-sm font-medium text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
      <div className="min-h-0 flex-1">
        <Editor
        height="100%"
        language={language}
        value={code}
        theme="vs-dark"
        onChange={(value) => setCode(value)}
        onMount={(editor, monaco) => {
          monaco.editor.defineTheme("devdeck-editor-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [
              { token: "comment", foreground: "7a869a" },
              { token: "keyword", foreground: "7dd3fc" },
              { token: "string", foreground: "86efac" },
              { token: "number", foreground: "fbbf24" },
            ],
            colors: {
              "editor.background": "#111113",
              "editor.foreground": "#e4e4e7",
              "editor.lineHighlightBackground": "#1f293730",
              "editorLineNumber.foreground": "#6b7280",
              "editorLineNumber.activeForeground": "#e4e4e7",
              "editorCursor.foreground": "#38bdf8",
              "editor.selectionBackground": "#0e749033",
            },
          });
          monaco.editor.setTheme("devdeck-editor-dark");
          editor.onDidChangeCursorPosition((event) => {
            setCursorPosition(event.position);
          });
        }}
        options={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 14,
          lineHeight: 22,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          glyphMargin: true,
          folding: true,
          formatOnPaste: true,
          formatOnType: true,
          bracketPairColorization: { enabled: true },
          guides: { indentation: true, bracketPairs: true },
          padding: { top: 14, bottom: 14 },
          smoothScrolling: true,
          renderLineHighlight: "all",
          scrollbar: {
            vertical: "visible",
            horizontal: "visible",
          },
        }}
      />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between gap-3 border-t border-[#2b2b30] bg-[#18181b] px-4 py-1.5 text-xs text-[#a1a1aa]">
        <span>
          Ln {cursorPosition.lineNumber}, Col {cursorPosition.column} - {code.split("\n").length} lines - {code.length} chars
        </span>
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
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
