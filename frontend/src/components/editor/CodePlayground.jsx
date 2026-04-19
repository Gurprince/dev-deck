import {
  ChatBubbleLeftRightIcon,
  PencilSquareIcon,
  PlusIcon,
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
  readOnly = false,
  className = '',
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
    setEndpoints([]);
    setLogs([]);
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
        executionApi.executeCode(code, projectId),
        executionApi.parseCode(code),
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
  }, [code, isRunning, projectId]);

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
      await onSave(code);
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
  }, [code, isSaving, onSave]);

  // Handle resetting code
  const handleReset = useCallback(() => {
    if (window.confirm('Are you sure you want to reset the code to its initial state? Any unsaved changes will be lost.')) {
      setCode(initialCode);
      setHasUnsavedChanges(false);
    }
  }, [initialCode]);

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
  }, []);

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
          <div className="h-full overflow-auto bg-[#111113] p-4 text-[#e4e4e7]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold">Task Board</h3>
                <p className="text-sm text-[#a1a1aa]">Plan the coding work, track progress, and keep project execution close to the editor.</p>
                <p className="mt-1 text-xs text-[#858585]">{workflowStatusText}</p>
              </div>
              <div className="flex min-w-0 gap-2">
                <input
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleAddTask();
                  }}
                  className="min-w-0 rounded-md border border-[#3c3c3c] bg-[#1e1e1e] px-3 py-2 text-sm text-[#f4f4f5] placeholder-[#71717a] focus:border-[#38bdf8] focus:outline-none"
                  placeholder="Add a task"
                />
                <select
                  value={newTaskPriority}
                  onChange={(event) => setNewTaskPriority(event.target.value)}
                  className="rounded-md border border-[#3c3c3c] bg-[#1e1e1e] px-3 py-2 text-sm text-[#f4f4f5] focus:border-[#38bdf8] focus:outline-none"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddTask}
                  className="inline-flex items-center rounded-md bg-[#0ea5e9] px-3 py-2 text-sm font-medium text-white hover:bg-[#0284c7]"
                >
                  <PlusIcon className="mr-1.5 h-4 w-4" />
                  Add
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {columns.map((column) => {
                const columnTasks = tasks.filter((task) => task.status === column.id);

                return (
                  <section key={column.id} className="min-h-72 rounded-md border border-[#2b2b30] bg-[#18181b]">
                    <div className="flex items-center justify-between border-b border-[#2b2b30] px-3 py-2">
                      <h4 className="text-sm font-semibold">{column.title}</h4>
                      <span className="rounded bg-[#2d2d30] px-2 py-0.5 text-xs text-[#a1a1aa]">{columnTasks.length}</span>
                    </div>
                    <div className="space-y-2 p-3">
                      {columnTasks.length ? (
                        columnTasks.map((task) => (
                          <article key={task.id || task._id} className="rounded-md border border-[#3c3c3c] bg-[#1f1f23] p-3">
                            <div className="flex items-start justify-between gap-2">
                              {editingTaskId === (task.id || task._id) ? (
                                <input
                                  value={editingTaskTitle}
                                  onChange={(event) => setEditingTaskTitle(event.target.value)}
                                  onBlur={handleCommitTaskEdit}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleCommitTaskEdit();
                                    if (event.key === 'Escape') setEditingTaskId(null);
                                  }}
                                  className="min-w-0 flex-1 rounded border border-[#38bdf8] bg-[#111113] px-2 py-1 text-sm text-[#f4f4f5] outline-none"
                                  autoFocus
                                />
                              ) : (
                                <p className="min-w-0 flex-1 text-sm font-medium text-[#f4f4f5]">{task.title}</p>
                              )}
                              <select
                                value={task.priority || 'Medium'}
                                onChange={(event) => handleUpdateTaskPriority(task.id || task._id, event.target.value)}
                                className="rounded border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-300 outline-none"
                              >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {columns.map((targetColumn) => (
                                <button
                                  key={targetColumn.id}
                                  type="button"
                                  onClick={() => handleMoveTask(task.id || task._id, targetColumn.id)}
                                  disabled={task.status === targetColumn.id}
                                  className="rounded border border-[#3c3c3c] px-2 py-1 text-xs text-[#d4d4d8] hover:border-[#38bdf8] disabled:cursor-default disabled:border-[#0ea5e9] disabled:text-sky-300"
                                >
                                  {targetColumn.title}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => handleStartEditTask(task)}
                                className="ml-auto rounded border border-[#3c3c3c] px-2 py-1 text-xs text-[#d4d4d8] hover:border-[#38bdf8] hover:text-sky-300"
                                title="Edit task"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id || task._id)}
                                className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                                title="Delete task"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="rounded-md border border-dashed border-[#3c3c3c] p-3 text-sm text-[#858585]">No tasks here.</p>
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
              <div className="grid gap-3 xl:grid-cols-2">
                {snippets.map((snippet) => (
                  <article key={snippet.id || snippet._id} className="overflow-hidden rounded-md border border-[#2b2b30] bg-[#18181b]">
                    <div className="flex items-center justify-between gap-3 border-b border-[#2b2b30] px-3 py-2">
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
                            className="w-full rounded border border-[#38bdf8] bg-[#111113] px-2 py-1 text-sm text-[#f4f4f5] outline-none"
                            autoFocus
                          />
                        ) : (
                          <h4 className="truncate text-sm font-semibold text-[#f4f4f5]">{snippet.title}</h4>
                        )}
                        <p className="text-xs text-[#858585]">{snippet.language.toUpperCase()} - {new Date(snippet.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopySnippet(snippet.code)}
                          className="rounded border border-[#3c3c3c] px-2 py-1 text-xs text-[#d4d4d8] hover:border-[#38bdf8] hover:text-sky-300"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditSnippet(snippet)}
                          className="rounded border border-[#3c3c3c] px-2 py-1 text-xs text-[#d4d4d8] hover:border-[#38bdf8] hover:text-sky-300"
                          title="Rename snippet"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSnippet(snippet.id || snippet._id)}
                          className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                          title="Delete snippet"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <pre className="max-h-56 overflow-auto bg-[#0f172a] p-3 text-xs leading-relaxed text-[#d4d4d8]">{snippet.code}</pre>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-md border border-dashed border-[#3c3c3c] text-center">
                <p className="text-sm font-medium text-[#f4f4f5]">No snippets saved yet</p>
                <p className="mt-1 max-w-sm text-sm text-[#858585]">Highlight reusable code in the editor, name it, and save it here for later.</p>
              </div>
            )}
          </div>
        );
      case 'documentation':
        return (
          <div className="p-4 h-full overflow-auto">
            <h3 className="text-lg font-medium mb-4">API Documentation</h3>
            {endpoints.length > 0 ? (
              <div className="space-y-6">
                {endpoints.map((endpoint, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                        endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                        endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                        endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-mono">{endpoint.path}</code>
                    </div>
                    {endpoint.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        {endpoint.description}
                      </p>
                    )}
                    {endpoint.parameters && endpoint.parameters.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium mb-2">Parameters</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead>
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Required</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {endpoint.parameters.map((param, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm font-mono">{param.name}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{param.type || 'string'}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {param.required ? 'Yes' : 'No'}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                    {param.description || 'No description'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No API endpoints detected in your code.</p>
                <p className="mt-2 text-sm">Add Express.js route handlers to see them documented here.</p>
              </div>
            )}
            <div className="mt-6 flex items-center space-x-2">
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/openapi/${projectId}`, {
                      headers: { Authorization: `Bearer ${token}` },
                      credentials: 'include',
                    });
                    const data = await res.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `openapi-${projectId}.json`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('OpenAPI download failed', err);
                  }
                }}
                className="inline-flex items-center px-3 py-1.5 rounded bg-indigo-600 text-white"
              >
                Download OpenAPI (Saved Code)
              </button>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/openapi`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ code }),
                    });
                    const data = await res.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `openapi-current.json`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('OpenAPI download failed', err);
                  }
                }}
                className="inline-flex items-center px-3 py-1.5 rounded bg-gray-700 text-white"
              >
                Download OpenAPI (Current Editor)
              </button>
            </div>
          </div>
        );
      case 'test':
        return (
          <TestRunner endpoints={endpoints} projectId={projectId} />
        );
      case 'insights':
        return (
          <div className="p-4 h-full overflow-auto">
            <h3 className="text-lg font-medium mb-4">Code Insights</h3>
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Code Quality</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {code.length > 1000 
                    ? 'Your code is getting long. Consider breaking it into smaller, reusable functions.'
                    : 'Your code looks well-structured and maintainable.'}
                </p>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Performance</h4>
                <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                  {code.includes('setTimeout') || code.includes('setInterval')
                    ? <li>• Consider using requestAnimationFrame for animations instead of setInterval</li>
                    : <li>• No obvious performance issues detected</li>}
                  {code.includes('JSON.parse') && !code.includes('try') && 
                    <li>• Add error handling around JSON.parse to prevent runtime errors</li>}
                </ul>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Security</h4>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  {code.includes('eval(') && 
                    <li>• Avoid using eval() as it can lead to XSS vulnerabilities</li>}
                  {code.includes('localStorage') && code.includes('sensitive') && 
                    <li>• Avoid storing sensitive data in localStorage</li>}
                  {code.includes('innerHTML') && 
                    <li>• Be cautious with innerHTML to prevent XSS attacks</li>}
                  {!code.includes('eval(') && !code.includes('innerHTML') &&
                    <li>• No obvious security issues detected</li>}
                </ul>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Best Practices</h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {!code.includes('use strict') && 
                    <li>• Consider adding 'use strict' at the top of your script</li>}
                  {code.includes('var ') && 
                    <li>• Consider using const/let instead of var for better scoping</li>}
                  {code.includes('==') && !code.includes('===') && 
                    <li>• Prefer strict equality (===) over loose equality (==)</li>}
                  {!code.includes('var ') && !code.includes('==') &&
                    <li>• Following modern JavaScript best practices</li>}
                </ul>
              </div>
            </div>
          </div>
        );
      case 'editor':
      default:
        return (
          <CodeEditor
            value={code}
            onChange={handleCodeChange}
            language={language}
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
            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent ${
              ideChrome
                ? `text-[#e4e4e7] ${isChatOpen ? 'bg-[#0e639c]' : 'bg-[#3c3c3c]'} hover:bg-[#505050] focus:ring-[#0e639c]`
                : theme === 'dark'
                  ? `text-white ${isChatOpen ? 'bg-indigo-600' : 'bg-gray-700'} hover:bg-gray-600 focus:ring-gray-500`
                  : `text-gray-700 ${isChatOpen ? 'bg-indigo-100' : 'bg-white'} border-gray-300 hover:bg-gray-50 focus:ring-indigo-500`
            }`}
            aria-label="Toggle chat"
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1.5" />
            Chat
          </button>
          <CollaboratorsBar projectId={projectId} />
        </div>
      </EditorToolbar>
      
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
