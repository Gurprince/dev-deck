import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { ChatBubbleLeftRightIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { throttle } from 'lodash';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { executeCode, executionStore, stopExecution } from '../../services/codeExecutionService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import '../../styles/collaborators.css';

const languageFileName = {
  javascript: 'app.js',
  typescript: 'app.ts',
  json: 'payload.json',
  http: 'requests.http',
};

const buildParticipantColor = (seed) => {
  const source = seed || 'devdeck';
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash % 360)} 75% 60%)`;
};

const CodeEditor = ({
  value = '',
  onChange = () => {},
  language = 'javascript',
  theme: customTheme,
  options = {},
  onMount = () => {},
  onValidate = () => {},
  projectId,
  isReadOnly = false,
  showInlineActions = true,
  fileName,
  activeFilePath,
  className = '',
}) => {
  const { theme: appTheme } = useTheme();
  const { user } = useAuth();
  const socketContext = useSocket();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const ownedSocketRef = useRef(null);
  const runtimeRef = useRef({
    socket: null,
    projectId,
    userId: user?.id,
    userName: user?.name || user?.username || 'Anonymous',
    userEmail: user?.email || '',
    userColor: buildParticipantColor(user?.email || user?.id),
  });
  const commentSelectionRef = useRef(null);
  const codeEmitterRef = useRef(null);
  const cursorEmitterRef = useRef(null);
  const commentDecorationsRef = useRef([]);
  const isRemoteUpdate = useRef(false);
  const cursorDecorationsRef = useRef([]);

  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState('');
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [selectionInfo, setSelectionInfo] = useState({ lines: 0, characters: 0 });
  const [collaboratorCursors, setCollaboratorCursors] = useState({});
  const [comments, setComments] = useState([]);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [pendingComment, setPendingComment] = useState('');
  const [isCommentComposerOpen, setIsCommentComposerOpen] = useState(false);
  const [socket, setSocket] = useState(socketContext?.socket || null);
  const [editorMounted, setEditorMounted] = useState(false);

  useEffect(() => {
    runtimeRef.current = {
      socket,
      projectId,
      userId: user?.id,
      userName: user?.name || user?.username || 'Anonymous',
      userEmail: user?.email || '',
      userColor: buildParticipantColor(user?.email || user?.id),
      activeFilePath,
    };
  }, [projectId, socket, user?.email, user?.id, user?.name, user?.username, activeFilePath]);

  useEffect(() => {
    if (socketContext?.socket) {
      setSocket(socketContext.socket);
      return undefined;
    }

    if (!projectId) {
      setSocket(null);
      return undefined;
    }

    const ownedSocket = io('http://localhost:3001', {
      query: { projectId },
      withCredentials: true,
    });

    ownedSocketRef.current = ownedSocket;
    setSocket(ownedSocket);

    return () => {
      ownedSocket.disconnect();
      ownedSocketRef.current = null;
      setSocket(null);
    };
  }, [projectId, socketContext]);

  const handleCodeUpdate = useCallback(
    (data) => {
      const code = typeof data === 'string' ? data : data?.code;
      const filePath = typeof data === 'string' ? null : data?.filePath;

      if (typeof code !== 'string') return;

      // Only update if it is for the currently active file
      if (filePath && filePath !== activeFilePath) return;

      if (code !== localValue) {
        isRemoteUpdate.current = true;

        // Preserve cursor position
        let position = null;
        if (editorRef.current) {
          position = editorRef.current.getPosition();
        }

        setLocalValue(code);
        onChange(code);

        if (position && editorRef.current) {
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.setPosition(position);
            }
          }, 0);
        }

        setTimeout(() => {
          isRemoteUpdate.current = false;
        }, 0);
      }
    },
    [activeFilePath, localValue, onChange]
  );

  const handleCursorUpdate = useCallback(
    (data) => {
      if (!data?.user?.id || data.user.id === user?.id) return;

      setCollaboratorCursors((prev) => ({
        ...prev,
        [data.user.id]: {
          ...data,
          timestamp: Date.now(),
        },
      }));
    },
    [user?.id]
  );

  const handleCommentUpdate = useCallback((data) => {
    if (!data?.comment) return;

    setComments((prev) => {
      const exists = prev.some((comment) => comment.id === data.comment.id);
      return exists
        ? prev.map((comment) => (comment.id === data.comment.id ? data.comment : comment))
        : [...prev, data.comment];
    });
    setIsCommentsOpen(true);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const handleConnect = () => {
      if (projectId) {
        socket.emit('join-project', { projectId });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('code-update', handleCodeUpdate);
    socket.on('cursor-update', handleCursorUpdate);
    socket.on('comment-update', handleCommentUpdate);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('code-update', handleCodeUpdate);
      socket.off('cursor-update', handleCursorUpdate);
      socket.off('comment-update', handleCommentUpdate);
    };
  }, [handleCodeUpdate, handleCommentUpdate, handleCursorUpdate, projectId, socket]);

  useEffect(() => {
    if (editorRef.current && value !== localValue) {
      setLocalValue(value);
    }
  }, [localValue, value]);

  useEffect(() => {
    codeEmitterRef.current = throttle((code) => {
      const runtime = runtimeRef.current;
      if (runtime.socket?.connected && runtime.projectId && runtime.userId) {
        runtime.socket.emit('code-update', {
          projectId: runtime.projectId,
          code,
          userId: runtime.userId,
          filePath: runtime.activeFilePath,
        });
      }
    }, 350);

    cursorEmitterRef.current = throttle((position) => {
      const runtime = runtimeRef.current;
      if (runtime.socket?.connected && runtime.projectId && runtime.userId) {
        runtime.socket.emit('cursor-update', {
          projectId: runtime.projectId,
          position,
          filePath: runtime.activeFilePath,
          user: {
            id: runtime.userId,
            name: runtime.userName,
            email: runtime.userEmail,
            color: runtime.userColor,
          },
        });
      }
    }, 100);

    return () => {
      codeEmitterRef.current?.cancel?.();
      cursorEmitterRef.current?.cancel?.();
    };
  }, []);

  useEffect(() => {
    const cleanupId = window.setInterval(() => {
      setCollaboratorCursors((prev) => {
        const next = Object.fromEntries(
          Object.entries(prev).filter(([, data]) => Date.now() - (data.timestamp || 0) < 12000)
        );
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 4000);

    return () => window.clearInterval(cleanupId);
  }, []);

  useEffect(() => {
    return () => {
      const currentExecution = executionStore.getCurrentExecution();
      if (currentExecution) {
        stopExecution(currentExecution.id).catch(console.error);
        executionStore.clearExecution();
      }
    };
  }, []);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const newDecorations = comments.map((comment) => {
      const { startLineNumber, startColumn, endLineNumber, endColumn } = comment.selection || {};
      return {
        range: new monaco.Range(
          startLineNumber || 1,
          startColumn || 1,
          endLineNumber || startLineNumber || 1,
          endColumn || startColumn || 1
        ),
        options: {
          isWholeLine: true,
          className: 'comment-highlight',
          glyphMarginClassName: 'comment-decoration-glyph',
          hoverMessage: { value: `**${comment.author?.name || 'Anonymous'}:** ${comment.text}` },
        },
      };
    });

    commentDecorationsRef.current = editor.deltaDecorations(
      commentDecorationsRef.current,
      newDecorations
    );
  }, [comments, editorMounted]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return undefined;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const activeCursors = Object.entries(collaboratorCursors).filter(
      ([userId, data]) => data.filePath === activeFilePath && userId !== user?.id && data.position
    );

    let styleEl = document.getElementById('monaco-remote-cursors-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'monaco-remote-cursors-styles';
      document.head.appendChild(styleEl);
    }

    let cssContent = '';
    const newDecorations = activeCursors.map(([userId, data]) => {
      const color = data.user?.color || '#007acc';
      const name = data.user?.name || data.user?.username || 'Anonymous';
      const pos = data.position;

      const cursorClass = `remote-cursor-${userId}`;
      const labelClass = `remote-cursor-label-${userId}`;

      cssContent += `
        .${cursorClass} {
          border-left: 2px solid ${color} !important;
          margin-left: -1px;
          position: absolute;
          height: 19px;
          animation: cursor-blink 1s infinite;
        }
        .${labelClass} {
          position: absolute;
        }
        .${labelClass}::after {
          content: '${name.replace(/'/g, "\\'")}';
          position: absolute;
          top: -16px;
          left: 2px;
          background-color: ${color};
          color: white;
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 2px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 1000;
          opacity: 0;
          transition: opacity 0.2s;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .${cursorClass}:hover .${labelClass}::after {
          opacity: 1;
        }
      `;

      return {
        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
        options: {
          className: cursorClass,
          beforeContentClassName: labelClass,
          hoverMessage: { value: name },
        },
      };
    });

    styleEl.innerHTML = cssContent;

    cursorDecorationsRef.current = editor.deltaDecorations(
      cursorDecorationsRef.current,
      newDecorations
    );

    return () => {
      if (styleEl) {
        styleEl.innerHTML = '';
      }
    };
  }, [collaboratorCursors, activeFilePath, editorMounted, user?.id]);

  const updateSelectionInfo = useCallback(() => {
    if (!editorRef.current) return;

    const selection = editorRef.current.getSelection();
    const model = editorRef.current.getModel();
    if (!selection || !model || selection.isEmpty()) {
      setSelectionInfo({ lines: 0, characters: 0 });
      return;
    }

    const selectionText = model.getValueInRange(selection);
    const lines = selection.endLineNumber - selection.startLineNumber + 1;
    setSelectionInfo({ lines, characters: selectionText.length });
  }, []);

  const handleChange = useCallback(
    (newValue = '') => {
      setLocalValue(newValue);
      onChange(newValue);
      if (projectId && !isRemoteUpdate.current) {
        codeEmitterRef.current?.(newValue);
      }
    },
    [onChange, projectId]
  );

  const handleCursorChange = useCallback(() => {
    if (!editorRef.current || !projectId || !user?.id) return;

    const position = editorRef.current.getPosition();
    if (!position) return;

    setCursorPosition(position);
    cursorEmitterRef.current?.({
      lineNumber: position.lineNumber,
      column: position.column,
    });
  }, [projectId, user?.id]);

  const addComment = useCallback(() => {
    const text = pendingComment.trim();
    const selection = commentSelectionRef.current;

    if (!text || !selection || !projectId || !user || !socket?.connected) return;

    const newComment = {
      id: `comment-${Date.now()}`,
      text,
      author: {
        id: user.id,
        name: user.name || user.username || 'Anonymous',
        email: user.email,
      },
      timestamp: new Date().toISOString(),
      selection: {
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn,
      },
      replies: [],
    };

    setComments((prev) => [...prev, newComment]);
    socket.emit('comment-update', {
      projectId,
      comment: newComment,
      userId: user.id,
    });

    setPendingComment('');
    setIsCommentComposerOpen(false);
    setIsCommentsOpen(true);
    commentSelectionRef.current = null;
  }, [pendingComment, projectId, socket, user]);

  const closeCommentComposer = useCallback(() => {
    setPendingComment('');
    setIsCommentComposerOpen(false);
    commentSelectionRef.current = null;
  }, []);

  const focusCommentSelection = useCallback((comment) => {
    if (!editorRef.current || !comment?.selection) return;

    editorRef.current.revealLineInCenter(comment.selection.startLineNumber);
    editorRef.current.setPosition({
      lineNumber: comment.selection.startLineNumber,
      column: comment.selection.startColumn,
    });
    editorRef.current.focus();
  }, []);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.updateOptions({
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineHeight: 22,
      wordWrap: 'on',
      automaticLayout: true,
      formatOnPaste: true,
      formatOnType: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
      padding: {
        top: 14,
        bottom: 14,
      },
      renderWhitespace: 'selection',
      smoothScrolling: true,
      stickyScroll: { enabled: true },
      roundedSelection: false,
      glyphMargin: true,
    });

    monaco.editor.defineTheme('devdeck-editor-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '7a869a' },
        { token: 'keyword', foreground: '7dd3fc' },
        { token: 'string', foreground: '86efac' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'type', foreground: 'c4b5fd' },
      ],
      colors: {
        'editor.background': '#111113',
        'editor.foreground': '#e4e4e7',
        'editor.lineHighlightBackground': '#1f293730',
        'editorCursor.foreground': '#38bdf8',
        'editorLineNumber.foreground': '#6b7280',
        'editorLineNumber.activeForeground': '#e4e4e7',
        'editor.selectionBackground': '#0e749033',
        'editor.inactiveSelectionBackground': '#33415555',
        'editorIndentGuide.background1': '#27272a',
        'editorIndentGuide.activeBackground1': '#38bdf8',
        'editorGutter.background': '#111113',
        'scrollbarSlider.background': '#3f3f4680',
        'scrollbarSlider.hoverBackground': '#52525b99',
      },
    });

    editor.addAction({
      id: 'add-comment',
      label: 'Add Comment',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (currentEditor) => {
        const selection = currentEditor.getSelection();
        if (!selection || selection.isEmpty()) return;

        commentSelectionRef.current = selection;
        setPendingComment('');
        setIsCommentComposerOpen(true);
      },
    });

    editor.onDidChangeCursorPosition((event) => {
      setCursorPosition(event.position);
      handleCursorChange();
    });

    editor.onDidChangeCursorSelection(() => {
      updateSelectionInfo();
    });

    monaco.languages.register({ id: 'http' });
    monaco.languages.setMonarchTokensProvider('http', {
      defaultToken: '',
      tokenizer: {
        root: [
          [/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+/, 'keyword'],
          [/\s(HTTP\/\d\.\d)/, 'type'],
          [/(https?:\/\/[^\s{}]+)/, 'string'],
          [/\{\{[^}]*\}\}/, 'variable'],
          [/\/\/.*$/, 'comment'],
        ],
      },
    });

    onMount(editor, monaco);
    setEditorMounted(true);
  };

  const handleRunCode = async () => {
    try {
      setIsExecuting(true);
      setOutput('Executing code...\n');

      const currentExecution = executionStore.getCurrentExecution();
      if (currentExecution) {
        try {
          await stopExecution(currentExecution.id);
          executionStore.clearExecution();
          setOutput((prev) => `${prev}\nStopped previous server on port ${currentExecution.port}\n`);
        } catch (error) {
          console.error('Error stopping previous execution:', error);
        }
      }

      const result = await executeCode(localValue);

      if (result.success) {
        setOutput((prev) => `${prev}${result.output || ''}\n`);
        if (result.error) {
          setOutput((prev) => `${prev}Error: ${result.error}\n`);
        }
      } else {
        setOutput((prev) => `${prev}Error: ${result.message || 'Execution failed'}\n`);
      }

      if (result.output && result.output.includes('SERVER_STARTED:')) {
        const port = result.output.match(/SERVER_STARTED:(\d+)/)?.[1];
        if (port) {
          executionStore.setExecution(`exec-${Date.now()}`, port);
          setIsServerRunning(true);
        }
      }
    } catch (error) {
      console.error('Execution error:', error);
      setOutput((prev) => `${prev}Error: ${error.message || 'Failed to execute code'}\n`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleStopExecution = async () => {
    try {
      const currentExecution = executionStore.getCurrentExecution();
      if (currentExecution) {
        await stopExecution(currentExecution.id);
        executionStore.clearExecution();
        setIsServerRunning(false);
        setOutput((prev) => `${prev}\nServer on port ${currentExecution.port} stopped.\n`);
      }
    } catch (error) {
      console.error('Error stopping execution:', error);
      setOutput((prev) => `${prev}Error stopping server: ${error.message || 'Unknown error'}\n`);
    }
  };

  const editorTheme = customTheme || (appTheme === 'dark' ? 'devdeck-editor-dark' : 'vs');
  const resolvedFileName =
    fileName || languageFileName[language] || `app.${language === 'typescript' ? 'ts' : 'js'}`;
  const lineCount = localValue ? localValue.split('\n').length : 1;
  const characterCount = localValue.length;
  const collaboratorList = useMemo(
    () =>
      Object.values(collaboratorCursors).sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0)),
    [collaboratorCursors]
  );

  return (
    <div className={`relative flex h-full min-h-0 flex-col bg-white text-slate-900 dark:bg-[#111113] dark:text-[#e4e4e7] ${className}`}>
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 dark:border-[#2b2b30] dark:bg-[#18181b]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-[#f4f4f5]">{resolvedFileName}</p>
            <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">
              {isReadOnly ? 'Read only session' : 'Live editing enabled'} | Wrap on | Auto format
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCommentsOpen((current) => !current)}
            className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-sky-400 hover:text-sky-700 dark:border-[#35353b] dark:bg-[#202026] dark:text-[#d4d4d8] dark:hover:text-sky-300"
          >
            <ChatBubbleLeftRightIcon className="mr-1.5 h-4 w-4" />
            {comments.length} comments
          </button>
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-[#2d2d30] dark:text-[#d4d4d8]">
            {language.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1">
          <Editor
            height="100%"
            defaultLanguage={language}
            value={localValue}
            onChange={handleChange}
            onCursorPositionChange={handleCursorChange}
            theme={editorTheme}
            onMount={handleEditorDidMount}
            onValidate={onValidate}
            options={{
              ...options,
              readOnly: isReadOnly,
            }}
          />
        </div>

        {(isCommentsOpen || collaboratorList.length > 0) && (
          <aside className="hidden w-72 shrink-0 border-l border-slate-200 bg-slate-50/80 backdrop-blur dark:border-[#202024]/85 dark:bg-[#0f0f13] lg:flex lg:flex-col">
            <div className="border-b border-slate-200/80 px-4 py-3.5 dark:border-[#202024]/85">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="h-4 w-4 text-sky-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-[#f4f4f5]">Live Session</h3>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-[#808088]">Presence, cursor tracking, and comments directly in context.</p>
            </div>

            <div className="border-b border-slate-200/80 px-4 py-3.5 dark:border-[#202024]/85">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#808088]">Collaborators</p>
                <span className="rounded-lg bg-slate-200 dark:bg-[#202025] px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-[#808088]">
                  {collaboratorList.length}
                </span>
              </div>

              {collaboratorList.length > 0 ? (
                <div className="space-y-2">
                  {collaboratorList.map((participant) => (
                    <div key={participant.user.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-[#2b2b30]/60 dark:bg-[#1a1a20]/90">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-slate-909 dark:text-[#f4f4f5]">{participant.user.name}</p>
                        <span
                          className="inline-block h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]"
                          style={{ color: participant.user.color || buildParticipantColor(participant.user.id), backgroundColor: participant.user.color || buildParticipantColor(participant.user.id) }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] font-bold text-slate-400 dark:text-[#808088]">
                        Line {participant.position?.lineNumber || 1}, col {participant.position?.column || 1}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-[#808088]">No other editors active.</p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#808088]">Comments</p>
                <span className="text-[10px] font-bold text-slate-400 dark:text-[#808088]">{comments.length} total</span>
              </div>

              {comments.length > 0 ? (
                <div className="space-y-3">
                  {comments
                    .slice()
                    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
                    .map((comment) => (
                      <button
                        key={comment.id}
                        type="button"
                        onClick={() => focusCommentSelection(comment)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-all duration-200 hover:border-sky-500/30 dark:border-[#2b2b30]/65 dark:bg-[#1a1a20]/90 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-[#f4f4f5]">{comment.author?.name || 'Anonymous'}</p>
                          <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-400">L{comment.selection?.startLineNumber}</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-600 dark:text-[#c0c0c8] leading-relaxed">{comment.text}</p>
                        <p className="mt-2.5 text-[9px] font-bold text-slate-400 dark:text-[#808088]">{new Date(comment.timestamp).toLocaleTimeString()}</p>
                      </button>
                    ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-[#2b2b30]/80 dark:text-[#808088] leading-relaxed">
                  Highlight code, right-click, and select <span className="font-semibold text-sky-400">Add Comment</span>.
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 text-xs text-slate-500 dark:border-[#202024]/85 dark:bg-[#0f0f13] dark:text-[#808088]">
        <div className="flex min-w-0 items-center gap-3">
          <span>Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}</span>
          <span>{lineCount} lines</span>
          <span>{characterCount} chars</span>
          {selectionInfo.characters > 0 ? (
            <span>
              Selected {selectionInfo.characters} chars across {selectionInfo.lines} line{selectionInfo.lines === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span>{isReadOnly ? 'Protected' : 'Editable'}</span>
          <span>{socket?.connected ? 'Synced live' : 'Local only'}</span>
          <span>UTF-8</span>
          <span>LF</span>
        </div>
      </div>

      {showInlineActions && output ? (
        <div className="max-h-56 overflow-auto border-t border-[#2b2b30] bg-[#0f172a] p-4 font-mono text-sm text-[#86efac]">
          <pre>{output}</pre>
        </div>
      ) : null}

      {showInlineActions ? (
        <div className="absolute right-4 top-16 z-10 flex items-center gap-2">
          <Button onClick={handleRunCode} disabled={isExecuting} variant="outline" size="sm">
            {isExecuting ? 'Running...' : 'Run Code'}
          </Button>
          {isServerRunning ? (
            <Button onClick={handleStopExecution} variant="destructive" size="sm">
              Stop Server
            </Button>
          ) : null}
        </div>
      ) : null}

      {isCommentComposerOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[2px] animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#2b2b30]/80 dark:bg-[#181820]/95 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-[#202024]/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-[#f4f4f5]">Add Review Note</h3>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#808088]">
                  Lines {commentSelectionRef.current?.startLineNumber} to {commentSelectionRef.current?.endLineNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCommentComposer}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-[#35353b] dark:text-[#a1a1aa] dark:hover:bg-[#202026] dark:hover:text-white transition-all duration-200"
              >
                Cancel
              </button>
            </div>

            <textarea
              value={pendingComment}
              onChange={(event) => setPendingComment(event.target.value)}
              placeholder="Suggest improvements, call out bugs, or note designs here..."
              className="mt-4 h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-700 outline-none transition-all duration-200 focus:border-sky-500 dark:border-[#35353b] dark:bg-[#111115] dark:text-[#f4f4f5]"
              autoFocus
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeCommentComposer}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:border-[#35353b] dark:text-[#d4d4d8] dark:hover:bg-[#202026] transition-all duration-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={addComment}
                disabled={!pendingComment.trim()}
                className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white transition-all duration-200 hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
              >
                Save Comment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CodeEditor;
