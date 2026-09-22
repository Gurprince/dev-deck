import {
  ArrowDownTrayIcon,
  BoltIcon,
  BookOpenIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';
import { executionApi, projectsApi } from '../../services/api';
import CodeEditor from './CodeEditor';
import EditorToolbar from './EditorToolbar';
import OutputPanel, { LogLevels } from './OutputPanel';
import EditorTabs from './EditorTabs';
import TestRunner from './TestRunner';
import CollaboratorsBar from './CollaboratorsBar';
import ChatPanel from './ChatPanel';
import OpenFileTabs from '../workspace/OpenFileTabs';
import { useRef } from 'react';
import { useEffect, useCallback, useState } from 'react';

export const DEFAULT_CODE = `// Welcome to DevDeck!
// Write your JavaScript/TypeScript code here

// Example: A simple Express.js server
const express = require('express');
const app = express();

app.use(express.json());

// Example endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from DevDeck!' });
});

// Start the server (PORT comes from DevDeck; 0 = free port — avoid hardcoding to prevent EADDRINUSE)
const raw = process.env.PORT;
const PORT =
  raw !== undefined && raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : 0;
const server = app.listen(PORT, () => {
  const addr = server.address();
  const p = typeof addr === 'object' && addr ? addr.port : PORT;
  console.log(\`Server running on http://127.0.0.1:\${p}\`);
});`;

const CodePlayground = ({
  initialCode = DEFAULT_CODE,
  language = 'javascript',
  projectId,
  onSave,
  onCodeChange,
  readOnly = false,
  className = '',
  activeFilePath,
  openFilePaths = [],
  workspaceFiles = [],
  entryFilePath,
  onOpenFile,
  onCloseFile,
  /** Controlled team chat panel (for IDE activity bar) */
  chatOpen: chatOpenControlled,
  onChatOpenChange,
  /** 'ide' = Cursor-style dark chrome regardless of global theme */
  surface = 'default',
}) => {
  const { theme } = useTheme();
  const [code, setCode] = useState(initialCode);
  const [activeTab, setActiveTab] = useState('editor');
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef(null);
  const [endpoints, setEndpoints] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [internalChatOpen, setInternalChatOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium');
  const [snippetTitle, setSnippetTitle] = useState('');
  const [snippets, setSnippets] = useState([]);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [editingSnippetId, setEditingSnippetId] = useState(null);
  const [editingSnippetTitle, setEditingSnippetTitle] = useState('');
  const [workflowLoaded, setWorkflowLoaded] = useState(false);
  const [workflowSaveState, setWorkflowSaveState] = useState('idle');
  const [openApiDownloadState, setOpenApiDownloadState] = useState('idle');
  const isChatOpen = chatOpenControlled !== undefined ? chatOpenControlled : internalChatOpen;
  const setChatOpen = useCallback(
    (next) => {
      const val = typeof next === 'function' ? next(isChatOpen) : next;
      if (onChatOpenChange) onChatOpenChange(val);
      else setInternalChatOpen(val);
    },
    [isChatOpen, onChatOpenChange]
  );

  // Reset editor content when initialCode prop changes (e.g., navigating to New Project)
  useEffect(() => {
    setCode(initialCode);
    setActiveTab('editor');
    // For a new project (no projectId), allow immediate save of boilerplate
    setHasUnsavedChanges(!projectId);
  }, [initialCode, projectId]);

  useEffect(() => {
    const storageKey = `devdeck-workflow-${projectId || 'draft'}`;
    const saved = localStorage.getItem(storageKey);
    setWorkflowLoaded(false);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTasks(Array.isArray(parsed.tasks) ? parsed.tasks : []);
        setSnippets(Array.isArray(parsed.snippets) ? parsed.snippets : []);
      } catch (error) {
        console.error('Could not load workflow data:', error);
      }
    }

    if (!saved) {
      setTasks([
      {
        id: 'task-plan-api',
        title: 'Document API routes after each backend change',
        status: 'todo',
        priority: 'High',
      },
      {
        id: 'task-review-code',
        title: 'Run code and review console output before saving',
        status: 'doing',
        priority: 'High',
      },
      {
        id: 'task-save-version',
        title: 'Save a stable project version',
        status: 'done',
        priority: 'Medium',
      },
      ]);
      setSnippets([]);
    }

    if (!projectId || projectId === 'new') {
      setWorkflowLoaded(true);
      return;
    }

    let cancelled = false;
    projectsApi.getWorkflow(projectId)
      .then((response) => {
        if (cancelled) return;
        setTasks(Array.isArray(response.data?.tasks) ? response.data.tasks : []);
        setSnippets(Array.isArray(response.data?.snippets) ? response.data.snippets : []);
      })
      .catch((error) => {
        console.error('Could not load project workflow:', error);
      })
      .finally(() => {
        if (!cancelled) setWorkflowLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!workflowLoaded) return;

    const storageKey = `devdeck-workflow-${projectId || 'draft'}`;
    localStorage.setItem(storageKey, JSON.stringify({ tasks, snippets }));

    if (!projectId || projectId === 'new') return;

    const timeout = window.setTimeout(async () => {
      setWorkflowSaveState('saving');
      try {
        await Promise.all([
          projectsApi.updateTasks(projectId, tasks),
          projectsApi.updateSnippets(projectId, snippets),
        ]);
        setWorkflowSaveState('saved');
      } catch (error) {
        console.error('Could not save project workflow:', error);
        setWorkflowSaveState('error');
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [projectId, snippets, tasks, workflowLoaded]);

  // Track code changes
  useEffect(() => {
    if (code !== initialCode) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [code, initialCode]);

  // Handle code execution (run + parse in parallel after shared prep on server)
  const handleRunCode = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    const wallStart = performance.now();
    let serverDurationMs = null;
    
    try {
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          message: '\n▸ Run — executing code and scanning routes in parallel…\n',
          level: LogLevels.INFO,
          timestamp: new Date().toISOString(),
        },
      ]);

      const [execSettled, parseSettled] = await Promise.allSettled([
        executionApi.executeCode(
          {
            code,
            files: workspaceFiles,
            entryFilePath,
          },
          projectId
        ),
        executionApi.parseCode({
          code,
          files: workspaceFiles,
          entryFilePath,
        }),
      ]);

      if (parseSettled.status === 'fulfilled') {
        const parseData = parseSettled.value?.data;
        if (parseData?.endpoints?.length) {
          setEndpoints(parseData.endpoints);
        }
      } else {
        const err = parseSettled.reason;
        console.error('Parse error:', err);
        setLogs((prevLogs) => [
          ...prevLogs,
          {
            message: `\n⚠ Could not parse routes: ${err?.message || 'Unknown error'}\n`,
            level: LogLevels.WARNING,
            timestamp: new Date().toISOString(),
          },
        ]);
      }

      if (execSettled.status === 'fulfilled') {
        const response = execSettled.value;
        if (response?.data) {
          const { success, output, stderr, durationMs } = response.data;
          if (typeof durationMs === 'number') {
            serverDurationMs = durationMs;
          }

          if (success && output) {
            setLogs((prevLogs) => [
              ...prevLogs,
              {
                message: '\n── Server output ──\n' + output,
                level: LogLevels.INFO,
                timestamp: new Date().toISOString(),
              },
            ]);
          }

          if (stderr) {
            setLogs((prevLogs) => [
              ...prevLogs,
              {
                message: '\n── stderr ──\n' + stderr,
                level: LogLevels.ERROR,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        }
      } else {
        const error = execSettled.reason;
        console.error('Execution error:', error);
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          'An error occurred during execution';
        const errorDetails =
          error?.response?.data?.stderr || error?.response?.data?.error || '';

        setLogs((prevLogs) => [
          ...prevLogs,
          {
            message: '\n── Execution failed ──\n' + errorMessage,
            level: LogLevels.ERROR,
            timestamp: new Date().toISOString(),
          },
          ...(errorDetails
            ? [
                {
                  message: '\n── Details ──\n' + errorDetails,
                  level: LogLevels.ERROR,
                  timestamp: new Date().toISOString(),
                },
              ]
            : []),
        ]);
      }
    } catch (error) {
      console.error('Execution error:', error);
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          message: '\n── Request failed ──\n' + (error?.message || 'Unknown error'),
          level: LogLevels.ERROR,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsRunning(false);
      const totalSec = ((performance.now() - wallStart) / 1000).toFixed(2);
      const serverPart =
        serverDurationMs != null ? ` · server run ${Math.round(serverDurationMs)}ms` : '';
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          message: `\n✓ Done in ${totalSec}s (browser)${serverPart}\n`,
          level: LogLevels.SUCCESS,
          timestamp: new Date().toISOString(),
        },
      ]);
      setActiveTab('console');
    }
  }, [code, entryFilePath, isRunning, projectId, workspaceFiles]);

  // Handle code formatting
  const handleFormatCode = useCallback(() => {
    if (!editorRef.current) return;
    
    editorRef.current.getAction('editor.action.formatDocument').run();
  }, []);

  // Handle saving code
  const handleSave = useCallback(async () => {
    if (isSaving || !onSave) return;
    
    setIsSaving(true);
    try {
      await onSave({
        code,
        files: workspaceFiles,
        entryFilePath,
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving code:', error);
      setLogs(prevLogs => [
        ...prevLogs,
        { 
          message: `Error saving code: ${error.message}`,
          level: LogLevels.ERROR,
          timestamp: new Date().toISOString() 
        }
      ]);
    } finally {
      setIsSaving(false);
    }
  }, [code, entryFilePath, isSaving, onSave, workspaceFiles]);

  // Handle resetting code
  const handleReset = useCallback(() => {
    if (window.confirm('Are you sure you want to reset the code to its initial state? Any unsaved changes will be lost.')) {
      setCode(initialCode);
      onCodeChange?.(initialCode);
      setHasUnsavedChanges(false);
    }
  }, [initialCode, onCodeChange]);

  // Handle editor mount
  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    
    // Configure monaco editor
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      typeRoots: ['node_modules/@types'],
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
    });
    
    // Add custom theme
    monaco.editor.defineTheme('devdeck-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'custom-info', foreground: '808080' },
        { token: 'custom-error', foreground: 'ff0000', fontStyle: 'bold' },
        { token: 'custom-notice', foreground: 'FFA500' },
        { token: 'custom-date', foreground: '008800' },
      ],
      colors: {
        'editor.background': '#111113',
        'editor.foreground': '#e4e4e7',
        'editor.lineHighlightBackground': '#1f293730',
        'editorLineNumber.foreground': '#6b7280',
        'editorLineNumber.activeForeground': '#e4e4e7',
        'editorCursor.foreground': '#38bdf8',
        'editor.selectionBackground': '#0e749033',
      },
    });
    
    monaco.editor.setTheme(theme === 'dark' ? 'devdeck-dark' : 'vs');
  }, [theme]);

  // Handle editor validation
  const handleEditorValidation = useCallback((markers) => {
    // You can handle validation markers here if needed
    console.log('Validation markers:', markers);
  }, []);

  // Handle code change
  const handleCodeChange = useCallback((newCode) => {
    setCode(newCode);
    onCodeChange?.(newCode);
  }, [onCodeChange]);

  // Handle console clear
  const handleClearConsole = useCallback(() => {
    setLogs([]);
  }, []);

  // Handle tab change
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  const handleAddTask = useCallback(() => {
    const title = newTaskTitle.trim();
    if (!title) return;

    setTasks((currentTasks) => [
      {
        id: `task-${Date.now()}`,
        title,
        status: 'todo',
        priority: newTaskPriority,
      },
      ...currentTasks,
    ]);
    setNewTaskTitle('');
  }, [newTaskPriority, newTaskTitle]);

  const handleMoveTask = useCallback((taskId, nextStatus) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        (task.id || task._id) === taskId ? { ...task, status: nextStatus } : task
      )
    );
  }, []);

  const handleUpdateTaskPriority = useCallback((taskId, priority) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        (task.id || task._id) === taskId ? { ...task, priority } : task
      )
    );
  }, []);

  const handleStartEditTask = useCallback((task) => {
    setEditingTaskId(task.id || task._id);
    setEditingTaskTitle(task.title);
  }, []);

  const handleCommitTaskEdit = useCallback(() => {
    const title = editingTaskTitle.trim();
    if (!editingTaskId || !title) {
      setEditingTaskId(null);
      setEditingTaskTitle('');
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        (task.id || task._id) === editingTaskId ? { ...task, title } : task
      )
    );
    setEditingTaskId(null);
    setEditingTaskTitle('');
  }, [editingTaskId, editingTaskTitle]);

  const handleDeleteTask = useCallback((taskId) => {
    setTasks((currentTasks) => currentTasks.filter((task) => (task.id || task._id) !== taskId));
  }, []);

  const handleSaveSnippet = useCallback(() => {
    const title = snippetTitle.trim() || `Snippet ${snippets.length + 1}`;
    let selectedCode = '';

    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      const model = editorRef.current.getModel();
      if (selection && model && !selection.isEmpty()) {
        selectedCode = model.getValueInRange(selection);
      }
    }

    setSnippets((currentSnippets) => [
      {
        id: `snippet-${Date.now()}`,
        title,
        language,
        code: selectedCode || code,
        createdAt: new Date().toISOString(),
      },
      ...currentSnippets,
    ]);
    setSnippetTitle('');
  }, [code, language, snippetTitle, snippets.length]);

  const handleCopySnippet = useCallback(async (snippetCode) => {
    try {
      await navigator.clipboard.writeText(snippetCode);
    } catch (error) {
      console.error('Could not copy snippet:', error);
    }
  }, []);

  const handleStartEditSnippet = useCallback((snippet) => {
    setEditingSnippetId(snippet.id || snippet._id);
    setEditingSnippetTitle(snippet.title);
  }, []);

  const handleCommitSnippetEdit = useCallback(() => {
    const title = editingSnippetTitle.trim();
    if (!editingSnippetId || !title) {
      setEditingSnippetId(null);
      setEditingSnippetTitle('');
      return;
    }

    setSnippets((currentSnippets) =>
      currentSnippets.map((snippet) =>
        (snippet.id || snippet._id) === editingSnippetId ? { ...snippet, title } : snippet
      )
    );
    setEditingSnippetId(null);
    setEditingSnippetTitle('');
  }, [editingSnippetId, editingSnippetTitle]);

  const handleDeleteSnippet = useCallback((snippetId) => {
    setSnippets((currentSnippets) => currentSnippets.filter((snippet) => (snippet.id || snippet._id) !== snippetId));
  }, []);

  const handleDownloadOpenApi = useCallback(async (source) => {
    setOpenApiDownloadState(source);

    try {
      const token = localStorage.getItem('token');
      const request =
        source === 'saved'
          ? fetch(`/api/openapi/${projectId}`, {
              headers: { Authorization: `Bearer ${token}` },
              credentials: 'include',
            })
          : fetch('/api/openapi', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({ code, files: workspaceFiles, entryFilePath }),
            });

      const res = await request;
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = source === 'saved' ? `openapi-${projectId}.json` : 'openapi-current.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('OpenAPI download failed', err);
    } finally {
      setOpenApiDownloadState('idle');
    }
  }, [code, entryFilePath, projectId, workspaceFiles]);

  const ideChrome = surface === 'ide';
  const workflowStatusText =
    !projectId || projectId === 'new'
      ? 'Saved locally until project is created'
      : workflowSaveState === 'saving'
        ? 'Saving workflow...'
        : workflowSaveState === 'saved'
          ? 'Workflow saved'
          : workflowSaveState === 'error'
            ? 'Workflow save failed'
            : workflowLoaded
              ? 'Workflow synced'
              : 'Loading workflow...';

  // Render the active tab content
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'console':
        return (
          <OutputPanel 
            logs={logs} 
            isRunning={isRunning} 
            onClear={handleClearConsole}
            surface={surface}
          />
        );
      case 'tasks': {
        const columns = [
          { id: 'todo', title: 'To do' },
          { id: 'doing', title: 'In progress' },
          { id: 'done', title: 'Done' },
        ];

        return (
          <div className="h-full overflow-auto bg-[#141418] p-5 text-[#e4e4e7]">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#202024]/80 pb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400">Task Board</h3>
                <p className="text-xs text-[#a1a1aa] mt-0.5">Plan tasks, track progress, and manage project execution directly beside the code.</p>
                <p className="mt-1 text-[10px] font-bold text-[#808088] uppercase tracking-wide">{workflowStatusText}</p>
              </div>
              <div className="flex min-w-0 gap-2 items-center">
                <input
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleAddTask();
                  }}
                  className="min-w-[180px] rounded-lg border border-[#2b2b30]/80 bg-[#1e1e24] px-3.5 py-1.5 text-xs text-[#f4f4f5] placeholder-[#71717a] focus:border-sky-500 focus:outline-none transition-all duration-200"
                  placeholder="Task description..."
                />
                <select
                  value={newTaskPriority}
                  onChange={(event) => setNewTaskPriority(event.target.value)}
                  className="rounded-lg border border-[#2b2b30]/80 bg-[#1e1e24] px-2.5 py-1.5 text-xs text-[#f4f4f5] focus:border-sky-500 focus:outline-none transition-all duration-200 cursor-pointer"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddTask}
                  className="inline-flex items-center rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sky-600 shadow-sm shadow-sky-500/10 active:scale-97 transition-all duration-200"
                >
                  <PlusIcon className="mr-1 h-3.5 w-3.5 stroke-[2.5]" />
                  Add
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {columns.map((column) => {
                const columnTasks = tasks.filter((task) => task.status === column.id);

                return (
                  <section key={column.id} className="min-h-72 rounded-xl border border-[#202024]/80 bg-[#0f0f13]/60 flex flex-col">
                    <div className="flex items-center justify-between border-b border-[#202024]/80 px-4 py-3 bg-[#0f0f13]/85 rounded-t-xl">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#a0a0a8]">{column.title}</h4>
                      <span className="rounded-lg bg-[#202025] px-2.5 py-0.5 text-[10px] font-bold text-[#808088]">{columnTasks.length}</span>
                    </div>
                    <div className="space-y-3 p-3 flex-1 overflow-y-auto max-h-[50vh]">
                      {columnTasks.length ? (
                        columnTasks.map((task) => (
                          <article key={task.id || task._id} className="rounded-xl border border-[#2b2b30]/60 bg-[#1a1a20]/90 p-4 transition-all duration-200 hover:border-sky-500/25 hover:shadow-sm">
                            <div className="flex items-start justify-between gap-2.5">
                              {editingTaskId === (task.id || task._id) ? (
                                <input
                                  value={editingTaskTitle}
                                  onChange={(event) => setEditingTaskTitle(event.target.value)}
                                  onBlur={handleCommitTaskEdit}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleCommitTaskEdit();
                                    if (event.key === 'Escape') setEditingTaskId(null);
                                  }}
                                  className="min-w-0 flex-1 rounded border border-sky-500 bg-[#111113] px-2 py-1 text-xs text-[#f4f4f5] outline-none"
                                  autoFocus
                                />
                              ) : (
                                <p className="min-w-0 flex-1 text-xs font-semibold leading-relaxed text-[#e4e4e7]">{task.title}</p>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const currentPriority = task.priority || 'Medium';
                                  const nextPriority = currentPriority === 'High' ? 'Low' : currentPriority === 'Medium' ? 'High' : 'Medium';
                                  handleUpdateTaskPriority(task.id || task._id, nextPriority);
                                }}
                                className={`shrink-0 rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer hover:scale-105 active:scale-95 transition-all duration-150 ${
                                  (task.priority || 'Medium') === 'High' 
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15 hover:bg-rose-500/20'
                                    : (task.priority || 'Medium') === 'Medium'
                                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/15 hover:bg-sky-500/20'
                                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/20'
                                }`}
                                title="Click to cycle priority"
                              >
                                {task.priority || 'Medium'}
                              </button>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-1.5 items-center">
                              {columns.map((targetColumn) => (
                                <button
                                  key={targetColumn.id}
                                  type="button"
                                  onClick={() => handleMoveTask(task.id || task._id, targetColumn.id)}
                                  disabled={task.status === targetColumn.id}
                                  className="rounded-lg border border-[#2b2b30]/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#a0a0a8] hover:border-sky-500 hover:text-white disabled:cursor-default disabled:border-sky-500/30 disabled:text-sky-400 disabled:bg-sky-500/5 transition-all duration-200"
                                >
                                  {targetColumn.id}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => handleStartEditTask(task)}
                                className="ml-auto rounded-lg border border-[#2b2b30]/80 p-1.5 text-xs text-[#a0a0a8] hover:border-sky-500 hover:text-sky-400 transition-all duration-200"
                                title="Edit task"
                              >
                                <PencilSquareIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id || task._id)}
                                className="rounded-lg border border-rose-500/20 p-1.5 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-450 transition-all duration-200"
                                title="Delete task"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#2b2b30]/80 p-6 text-center text-xs text-[#808088]">
                          No tasks in this column.
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        );
      }
      case 'snippets':
        return (
          <div className="h-full overflow-auto bg-[#111113] p-4 text-[#e4e4e7]">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-semibold">Snippet Vault</h3>
                <p className="text-sm text-[#a1a1aa]">Save reusable code from the editor. Select code first, or save the full file.</p>
                <p className="mt-1 text-xs text-[#858585]">{workflowStatusText}</p>
              </div>
              <div className="flex min-w-0 gap-2">
                <input
                  value={snippetTitle}
                  onChange={(event) => setSnippetTitle(event.target.value)}
                  className="min-w-0 rounded-md border border-[#3c3c3c] bg-[#1e1e1e] px-3 py-2 text-sm text-[#f4f4f5] placeholder-[#71717a] focus:border-[#38bdf8] focus:outline-none"
                  placeholder="Snippet name"
                />
                <button
                  type="button"
                  onClick={handleSaveSnippet}
                  className="inline-flex items-center rounded-md bg-[#0ea5e9] px-3 py-2 text-sm font-medium text-white hover:bg-[#0284c7]"
                >
                  <PlusIcon className="mr-1.5 h-4 w-4" />
                  Save
                </button>
              </div>
            </div>

            {snippets.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {snippets.map((snippet) => (
                  <article key={snippet.id || snippet._id} className="overflow-hidden rounded-xl border border-[#2b2b30]/65 bg-[#1a1a20]/90 transition-all duration-250 hover:border-sky-500/20">
                    <div className="flex items-center justify-between gap-3 border-b border-[#202024]/85 px-4 py-3 bg-[#0f0f13]/60">
                      <div className="min-w-0">
                        {editingSnippetId === (snippet.id || snippet._id) ? (
                          <input
                            value={editingSnippetTitle}
                            onChange={(event) => setEditingSnippetTitle(event.target.value)}
                            onBlur={handleCommitSnippetEdit}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') handleCommitSnippetEdit();
                              if (event.key === 'Escape') setEditingSnippetId(null);
                            }}
                            className="w-full rounded-lg border border-sky-500 bg-[#111113] px-2.5 py-1 text-xs text-[#f4f4f5] outline-none"
                            autoFocus
                          />
                        ) : (
                          <h4 className="truncate text-xs font-bold text-[#f4f4f5] tracking-wide">{snippet.title}</h4>
                        )}
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#808088] mt-0.5">{snippet.language} · {new Date(snippet.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopySnippet(snippet.code)}
                          className="rounded-lg border border-[#2b2b30]/85 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#c0c0c8] hover:border-sky-500 hover:text-white transition-all duration-200"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditSnippet(snippet)}
                          className="rounded-lg border border-[#2b2b30]/85 p-1.5 text-xs text-[#c0c0c8] hover:border-sky-500 hover:text-sky-400 transition-all duration-200"
                          title="Rename snippet"
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSnippet(snippet.id || snippet._id)}
                          className="rounded-lg border border-rose-500/20 p-1.5 text-xs text-rose-450 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-200"
                          title="Delete snippet"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <pre className="max-h-56 overflow-auto bg-[#0c0c0f]/90 p-4 font-mono text-[11px] leading-relaxed text-[#c0c0c8]">{snippet.code}</pre>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[#2b2b30]/80 bg-[#0f0f13]/40 text-center p-6">
                <p className="text-xs font-semibold text-[#f4f4f5]">No snippets saved yet</p>
                <p className="mt-1.5 max-w-xs text-xs text-[#808088] leading-relaxed">Highlight reusable code in the editor, name it, and save it here to build your personal library.</p>
              </div>
            )}
          </div>
        );
      case 'documentation': {
        const methodCounts = endpoints.reduce((acc, endpoint) => {
          const next = { ...acc };
          next[endpoint.method] = (next[endpoint.method] || 0) + 1;
          return next;
        }, {});
        const totalParameters = endpoints.reduce(
          (count, endpoint) => count + (endpoint.parameters?.length || 0),
          0
        );

        return (
          <div className="h-full overflow-auto bg-[#111113] p-4 text-[#e4e4e7]">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-base font-semibold">API Documentation</h3>
                <p className="text-sm text-[#a1a1aa]">
                  Review the route map detected from the current code and export OpenAPI specs for saved or in-progress work.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadOpenApi('saved')}
                  disabled={!projectId || projectId === 'new' || openApiDownloadState !== 'idle'}
                  className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-300 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                  {openApiDownloadState === 'saved' ? 'Preparing saved spec...' : 'Download saved OpenAPI'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadOpenApi('current')}
                  disabled={openApiDownloadState !== 'idle'}
                  className="inline-flex items-center rounded-md bg-[#0ea5e9] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#0284c7] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <BookOpenIcon className="mr-2 h-4 w-4" />
                  {openApiDownloadState === 'current' ? 'Preparing current spec...' : 'Download current OpenAPI'}
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-3 lg:grid-cols-4">
              <div className="rounded-md border border-[#2b2b30] bg-[#18181b] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#858585]">Endpoints</p>
                <p className="mt-2 text-2xl font-semibold text-[#f4f4f5]">{endpoints.length}</p>
              </div>
              <div className="rounded-md border border-[#2b2b30] bg-[#18181b] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#858585]">Parameters</p>
                <p className="mt-2 text-2xl font-semibold text-[#f4f4f5]">{totalParameters}</p>
              </div>
              <div className="rounded-md border border-[#2b2b30] bg-[#18181b] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#858585]">Methods</p>
                <p className="mt-2 text-2xl font-semibold text-[#f4f4f5]">{Object.keys(methodCounts).length}</p>
              </div>
              <div className="rounded-md border border-[#2b2b30] bg-[#18181b] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#858585]">Coverage</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((methodName) => (
                    <span
                      key={methodName}
                      className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                        methodCounts[methodName]
                          ? methodName === 'GET'
                            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                            : methodName === 'POST'
                              ? 'border-sky-500/30 bg-sky-500/15 text-sky-300'
                              : methodName === 'PUT'
                                ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                                : methodName === 'PATCH'
                                  ? 'border-violet-500/30 bg-violet-500/15 text-violet-300'
                                  : 'border-red-500/30 bg-red-500/15 text-red-300'
                          : 'border-[#3c3c3c] bg-[#111113] text-[#71717a]'
                      }`}
                    >
                      {methodName} {methodCounts[methodName] || 0}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {endpoints.length > 0 ? (
              <div className="space-y-4">
                {endpoints.map((endpoint, index) => (
                  <article key={`${endpoint.method}-${endpoint.path}-${index}`} className="overflow-hidden rounded-md border border-[#2b2b30] bg-[#18181b]">
                    <div className="border-b border-[#2b2b30] px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                            endpoint.method === 'GET'
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                              : endpoint.method === 'POST'
                                ? 'border-sky-500/30 bg-sky-500/15 text-sky-300'
                                : endpoint.method === 'PUT'
                                  ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                                  : endpoint.method === 'DELETE'
                                    ? 'border-red-500/30 bg-red-500/15 text-red-300'
                                    : 'border-violet-500/30 bg-violet-500/15 text-violet-300'
                          }`}
                        >
                          {endpoint.method}
                        </span>
                        <code className="font-mono text-sm text-[#f4f4f5]">{endpoint.path}</code>
                      </div>
                      <p className="mt-2 text-sm text-[#a1a1aa]">
                        {endpoint.description || 'No route description detected yet. Add comments or richer handler naming if you want more context here.'}
                      </p>
                    </div>

                    <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-[#f4f4f5]">Parameters</h4>
                        {endpoint.parameters && endpoint.parameters.length > 0 ? (
                          <div className="overflow-x-auto rounded-md border border-[#2b2b30]">
                            <table className="min-w-full divide-y divide-[#2b2b30]">
                              <thead className="bg-[#111113]">
                                <tr>
                                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-[#858585]">Name</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-[#858585]">Type</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-[#858585]">Required</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-[#858585]">Description</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#2b2b30]">
                                {endpoint.parameters.map((param, i) => (
                                  <tr key={`${param.name}-${i}`}>
                                    <td className="px-3 py-2 whitespace-nowrap font-mono text-sm text-[#f4f4f5]">{param.name}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-[#a1a1aa]">{param.type || 'string'}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-[#a1a1aa]">
                                      {param.required ? 'Required' : 'Optional'}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-[#a1a1aa]">{param.description || 'No description yet'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed border-[#3c3c3c] p-3 text-sm text-[#858585]">
                            No path or body parameters detected for this route.
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-md border border-[#2b2b30] bg-[#111113] p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#858585]">Suggested test path</p>
                          <p className="mt-2 font-mono text-sm text-[#d4d4d8]">{endpoint.path}</p>
                        </div>
                        <div className="rounded-md border border-[#2b2b30] bg-[#111113] p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#858585]">Route shape</p>
                          <p className="mt-2 text-sm text-[#a1a1aa]">
                            {endpoint.parameters?.length
                              ? `${endpoint.parameters.length} parameter${endpoint.parameters.length === 1 ? '' : 's'} detected`
                              : 'No explicit parameters detected'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-md border border-dashed border-[#3c3c3c] text-center">
                <BookOpenIcon className="h-10 w-10 text-[#52525b]" />
                <p className="mt-4 text-sm font-medium text-[#f4f4f5]">No API endpoints detected yet</p>
                <p className="mt-1 max-w-md text-sm text-[#858585]">
                  Run your code after adding Express route handlers and Dev Deck will document the endpoints here automatically.
                </p>
              </div>
            )}
          </div>
        );
      }
      case 'test':
        return (
          <TestRunner endpoints={endpoints} projectId={projectId} />
        );
      case 'insights': {
        const lineCount = code.split('\n').length;
        const qualityScore = Math.max(
          58,
          92 -
            (code.length > 1800 ? 10 : 0) -
            (code.includes('var ') ? 6 : 0) -
            (code.includes('eval(') ? 12 : 0) -
            (code.includes('innerHTML') ? 8 : 0)
        );
        const qualitySummary =
          code.length > 1000
            ? 'The file is growing into shared-workspace territory. Breaking route helpers or validators into smaller units would make reviews easier.'
            : 'The file is still at a manageable size and reads like one focused unit of work.';
        const performanceItems = [
          ...(code.includes('setTimeout') || code.includes('setInterval')
            ? ['Consider using requestAnimationFrame for UI animation work instead of timer loops.']
            : ['No obvious timing or animation issues stand out in the current code.']),
          ...(code.includes('JSON.parse') && !code.includes('try')
            ? ['Wrap JSON.parse in error handling so malformed input does not crash the flow.']
            : []),
        ];
        const securityItems = [
          ...(code.includes('eval(') ? ['Avoid eval(); it introduces a serious code-injection risk.'] : []),
          ...(code.includes('localStorage') && code.includes('sensitive')
            ? ['Avoid keeping sensitive data in localStorage where browser scripts can reach it.']
            : []),
          ...(code.includes('innerHTML') ? ['Treat innerHTML carefully to avoid accidental XSS exposure.'] : []),
        ];
        const practiceItems = [
          ...(!code.includes('use strict') ? ["Consider adding 'use strict' to make accidental globals less likely."] : []),
          ...(code.includes('var ') ? ['Prefer const or let over var so scope stays predictable.'] : []),
          ...(code.includes('==') && !code.includes('===') ? ['Prefer strict equality checks unless coercion is truly intended.'] : []),
        ];
        const totalRecommendations =
          performanceItems.length + securityItems.length + practiceItems.length;

        return (
          <div className="h-full overflow-auto bg-[#141418] p-5 text-[#e4e4e7]">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#202024]/80 pb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400">Code Insights</h3>
                <p className="text-xs text-[#a1a1aa] mt-0.5">
                  Analyze file maintainability, performance safety, and clean coding best practices dynamically.
                </p>
              </div>
              <div className="rounded-lg border border-sky-500/15 bg-sky-500/10 px-3.5 py-1.5 text-xs font-bold text-sky-400">
                {totalRecommendations} recommendation{totalRecommendations === 1 ? '' : 's'} pending
              </div>
            </div>

            <div className="mb-5 grid gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-[#2b2b30]/65 bg-[#1a1a20]/90 p-5 shadow-sm relative overflow-hidden group">
                <div className={`absolute top-0 left-0 bottom-0 w-1 ${qualityScore >= 80 ? 'bg-emerald-500' : qualityScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#808088]">Health score</p>
                <p className={`mt-3 text-3xl font-extrabold tracking-tight ${qualityScore >= 80 ? 'text-emerald-400' : qualityScore >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>{qualityScore}<span className="text-sm font-normal text-[#808088]">/100</span></p>
              </div>
              <div className="rounded-xl border border-[#2b2b30]/65 bg-[#1a1a20]/90 p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-violet-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#808088]">Lines of Code</p>
                <p className="mt-3 text-3xl font-extrabold text-[#f4f4f5] tracking-tight">{lineCount}</p>
              </div>
              <div className="rounded-xl border border-[#2b2b30]/65 bg-[#1a1a20]/90 p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-sky-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#808088]">Active Endpoints</p>
                <p className="mt-3 text-3xl font-extrabold text-[#f4f4f5] tracking-tight">{endpoints.length}</p>
              </div>
              <div className="rounded-xl border border-[#2b2b30]/65 bg-[#1a1a20]/90 p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#808088]">Workflow State</p>
                <p className="mt-3.5 text-xs font-bold text-[#f4f4f5] uppercase tracking-wide">{workflowStatusText}</p>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-[#2b2b30]/65 bg-[#1a1a20]/90 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <ChartBarIcon className="mt-0.5 h-5 w-5 text-sky-400" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#f4f4f5]">Quality Summary</h4>
                  <p className="mt-2 text-xs text-[#a1a1aa] leading-relaxed font-normal">{qualitySummary}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <section className="rounded-xl border border-[#2b2b30]/65 bg-[#1a1a20]/90 overflow-hidden shadow-sm flex flex-col">
                <div className="flex items-center gap-2 border-b border-[#202024]/85 px-4 py-3 bg-[#0f0f13]/60">
                  <BoltIcon className="h-4 w-4 text-violet-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#f4f4f5]">Performance</h4>
                </div>
                <div className="space-y-3 p-4 flex-1 overflow-y-auto max-h-[40vh]">
                  {performanceItems.map((item) => (
                    <div key={item} className="rounded-lg border border-violet-500/15 bg-violet-500/8 p-3 text-xs leading-relaxed text-[#c0c0c8] border-l-2 border-l-violet-500">
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-[#2b2b30]/65 bg-[#1a1a20]/90 overflow-hidden shadow-sm flex flex-col">
                <div className="flex items-center gap-2 border-b border-[#202024]/85 px-4 py-3 bg-[#0f0f13]/60">
                  <ShieldCheckIcon className="h-4 w-4 text-emerald-405 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#f4f4f5]">Security</h4>
                </div>
                <div className="space-y-3 p-4 flex-1 overflow-y-auto max-h-[40vh]">
                  {securityItems.length ? (
                    securityItems.map((item) => (
                      <div key={item} className="rounded-lg border border-emerald-500/15 bg-emerald-500/8 p-3 text-xs leading-relaxed text-[#c0c0c8] border-l-2 border-l-emerald-500">
                        {item}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/8 p-3 text-xs leading-relaxed text-[#c0c0c8] border-l-2 border-l-emerald-500">
                      No obvious security vulnerabilities were detected in this code.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-[#2b2b30]/65 bg-[#1a1a20]/90 overflow-hidden shadow-sm flex flex-col">
                <div className="flex items-center gap-2 border-b border-[#202024]/85 px-4 py-3 bg-[#0f0f13]/60">
                  <CheckCircleIcon className="h-4 w-4 text-amber-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#f4f4f5]">Best Practices</h4>
                </div>
                <div className="space-y-3 p-4 flex-1 overflow-y-auto max-h-[40vh]">
                  {practiceItems.length ? (
                    practiceItems.map((item) => (
                      <div key={item} className="rounded-lg border border-amber-500/15 bg-amber-500/8 p-3 text-xs leading-relaxed text-[#c0c0c8] border-l-2 border-l-amber-500">
                        {item}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-amber-500/15 bg-amber-500/8 p-3 text-xs leading-relaxed text-[#c0c0c8] border-l-2 border-l-amber-500">
                      Code is aligned with current standard linting conventions.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="mt-5 rounded-xl border border-amber-500/15 bg-amber-500/8 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-amber-400" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#f4f4f5]">Suggested Next Move</h4>
                  <p className="mt-2 text-xs text-[#a1a1aa] leading-relaxed font-normal">
                    {code.length > 1000
                      ? 'Consider breaking down larger functions and routing components into helper submodules for easier review cycles.'
                      : 'You have comfortable headroom in this file. Take this moment to document route shapes while the codebase is clean.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      }
      case 'editor':
      default:
        return (
          <CodeEditor
            value={code}
            onChange={handleCodeChange}
            language={language}
            fileName={activeFilePath?.split('/').pop()}
            activeFilePath={activeFilePath}
            onMount={handleEditorMount}
            onValidate={handleEditorValidation}
            projectId={projectId}
            isReadOnly={readOnly}
            showInlineActions={false}
            className="h-full"
          />
        );
    }
  };

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      {/* Toolbar */}
      <EditorToolbar
        surface={surface}
        onRun={handleRunCode}
        onFormat={handleFormatCode}
        onSave={handleSave}
        onReset={handleReset}
        isRunning={isRunning}
        isSaving={isSaving}
        canSave={hasUnsavedChanges || !projectId}
      >
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setChatOpen((o) => !o)}
            className={`inline-flex items-center px-3.5 py-1.5 border border-transparent text-xs font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 active:scale-97 ${
              ideChrome
                ? `text-[#e4e4e7] ${isChatOpen ? 'bg-[#0ea5e9] text-white shadow-sm ring-1 ring-sky-500/20' : 'bg-[#1e1e24] hover:bg-[#282830] hover:text-white border-[#202024]/60'}`
                : theme === 'dark'
                  ? `text-white ${isChatOpen ? 'bg-indigo-650' : 'bg-gray-700'} hover:bg-gray-655`
                  : `text-gray-700 ${isChatOpen ? 'bg-indigo-100' : 'bg-white'} border-gray-300 hover:bg-gray-50`
            }`}
            aria-label="Toggle chat"
          >
            <ChatBubbleLeftRightIcon className="h-4.5 w-4.5 mr-1.5" />
            Chat
          </button>
          <CollaboratorsBar projectId={projectId} />
        </div>
      </EditorToolbar>

      <OpenFileTabs
        files={workspaceFiles}
        activeFilePath={activeFilePath}
        openFilePaths={openFilePaths}
        onSelect={onOpenFile}
        onClose={onCloseFile}
        surface={surface}
      />
      
      {/* Tabs */}
      <EditorTabs
        surface={surface}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabCounts={{
          console: logs.length > 0 ? logs.length : 0,
          tasks: tasks.length,
          snippets: snippets.length,
          documentation: endpoints.length > 0 ? endpoints.length : 0,
        }}
      />
      
      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {renderActiveTab()}
      </div>
      
      {/* Chat Panel */}
      <ChatPanel 
        projectId={projectId} 
        isOpen={isChatOpen} 
        onClose={() => setChatOpen(false)} 
      />
    </div>
  );
};

export default CodePlayground;
