// frontend/src/components/editor/CodeEditor.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { executeCode, stopExecution, executionStore } from '../../services/codeExecutionService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { throttle } from 'lodash';

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
  className = '',
}) => {
  const { theme: appTheme } = useTheme();
  const { user } = useAuth();
  const socketContext = useSocket();
  const editorRef = useRef(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState('');
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [, setCollaboratorCursors] = useState({});
  const [, setComments] = useState([]);
  const [, setActiveComment] = useState(null);
  const [, setCommentPosition] = useState({ x: 0, y: 0 });
  const [socket, setSocket] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    let newSocket = socketContext?.socket;
    
    if (!newSocket && projectId) {
      newSocket = io('http://localhost:3001', {
        query: { projectId },
        withCredentials: true
      });
      setSocket(newSocket);
    }

    return () => {
      if (newSocket && !socketContext?.socket) {
        newSocket.disconnect();
      }
    };
  }, [projectId, socketContext]);

  // WebSocket event handlers
  const handleCodeUpdate = useCallback((code) => {
    if (code !== localValue) {
      setLocalValue(code);
      onChange(code);
    }
  }, [localValue, onChange]);

  const handleCursorUpdate = useCallback((data) => {
    if (!data?.user?.id || data.user.id === user?.id) return;

    setCollaboratorCursors(prev => ({
      ...prev,
      [data.user.id]: {
        ...data,
        timestamp: Date.now()
      }
    }));
  }, [user?.id]);

  const handleCommentUpdate = useCallback((data) => {
    if (data?.comment) {
      setComments(prev => {
        const exists = prev.some(c => c.id === data.comment.id);
        return exists
          ? prev.map(c => c.id === data.comment.id ? data.comment : c)
          : [...prev, data.comment];
      });
    }
  }, []);

  // Setup WebSocket listeners
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log('Connected to WebSocket');
      socket.emit('join-project', { projectId });
    };

    socket.on('connect', handleConnect);
    socket.on('code-update', handleCodeUpdate);
    socket.on('cursor-update', handleCursorUpdate);
    socket.on('comment-update', handleCommentUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('code-update', handleCodeUpdate);
      socket.off('cursor-update', handleCursorUpdate);
      socket.off('comment-update', handleCommentUpdate);
    };
  }, [socket, projectId, handleCodeUpdate, handleCursorUpdate, handleCommentUpdate]);

  // Handle external value changes
  // Sync from parent when `value` changes; omit localValue from deps to avoid clobbering in-progress edits
  useEffect(() => {
    if (editorRef.current && value !== localValue) {
      setLocalValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when parent `value` changes
  }, [value]);

  // Throttled functions for WebSocket events
  const throttledSendCodeUpdate = useRef(
    throttle((code) => {
      if (socket?.connected) {
        socket.emit('code-update', { 
          projectId, 
          code,
          userId: user?.id
        });
      }
    }, 500)
  ).current;

  const throttledSendCursorPosition = useRef(
    throttle((position) => {
      if (socket?.connected && user?.id) {
        socket.emit('cursor-update', { 
          projectId, 
          position,
          user: {
            id: user.id,
            name: user.name || user.username || 'Anonymous',
            color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`
          }
        });
      }
    }, 100)
  ).current;

  // Handle editor changes
  const handleChange = useCallback((newValue) => {
    setLocalValue(newValue);
    onChange(newValue);
    if (projectId) {
      throttledSendCodeUpdate(newValue);
    }
  }, [onChange, projectId, throttledSendCodeUpdate]);

  // Handle cursor position changes
  const handleCursorChange = useCallback(() => {
    if (!editorRef.current || !projectId || !user?.id) return;
    
    const position = editorRef.current.getPosition();
    if (position) {
      setCursorPosition(position);
      throttledSendCursorPosition({
        lineNumber: position.lineNumber,
        column: position.column
      });
    }
  }, [projectId, user?.id, throttledSendCursorPosition]);

  // Add comment handler
  const addComment = useCallback((selection, text) => {
    if (!projectId || !user || !socket?.connected) return;

    const newComment = {
      id: `comment-${Date.now()}`,
      text,
      author: {
        id: user.id,
        name: user.name || user.username || 'Anonymous',
        email: user.email
      },
      timestamp: new Date().toISOString(),
      selection: {
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn
      },
      replies: []
    };

    setComments(prev => [...prev, newComment]);
    socket.emit('comment-update', { 
      projectId, 
      comment: newComment,
      userId: user.id
    });
    setActiveComment(null);
  }, [projectId, user, socket]);

  // Handle editor mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure editor options
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

    // Add context menu for comments
    editor.addAction({
      id: 'add-comment',
      label: 'Add Comment',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed) => {
        const selection = ed.getSelection();
        if (selection && !selection.isEmpty()) {
          const position = ed.getScrolledVisiblePosition(
            { lineNumber: selection.startLineNumber, column: selection.startColumn }
          );

          if (position) {
            const editorDomNode = ed.getDomNode();
            if (editorDomNode) {
              const editorCoords = editorDomNode.getBoundingClientRect();
              setCommentPosition({
                x: editorCoords.left + position.left,
                y: editorCoords.top + position.top
              });

              const commentText = prompt('Enter your comment:');
              if (commentText) {
                addComment(selection, commentText);
              }
            }
          }
        }
      }
    });

    // Track cursor position changes
    editor.onDidChangeCursorPosition((event) => {
      setCursorPosition(event.position);
      handleCursorChange();
    });

    // Register custom language if needed
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
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      const currentExecution = executionStore.getCurrentExecution();
      if (currentExecution) {
        stopExecution(currentExecution.id).catch(console.error);
        executionStore.clearExecution();
      }
      if (socket && !socketContext?.socket) {
        socket.disconnect();
      }
    };
  }, [socket, socketContext]);

  // Run code execution
  const handleRunCode = async () => {
    try {
      setIsExecuting(true);
      setOutput('Executing code...\n');

      // Stop any running server first
      const currentExecution = executionStore.getCurrentExecution();
      if (currentExecution) {
        try {
          await stopExecution(currentExecution.id);
          executionStore.clearExecution();
          setOutput(prev => prev + `\nStopped previous server on port ${currentExecution.port}\n`);
        } catch (error) {
          console.error('Error stopping previous execution:', error);
        }
      }

      const result = await executeCode(localValue);
      
      if (result.success) {
        setOutput(prev => prev + (result.output || '') + '\n');
        if (result.error) {
          setOutput(prev => prev + 'Error: ' + result.error + '\n');
        }
      } else {
        setOutput(prev => prev + 'Error: ' + (result.message || 'Execution failed') + '\n');
      }

      // Check if server was started
      if (result.output && result.output.includes('SERVER_STARTED:')) {
        const port = result.output.match(/SERVER_STARTED:(\d+)/)[1];
        executionStore.setExecution(`exec-${Date.now()}`, port);
        setIsServerRunning(true);
      }
    } catch (error) {
      console.error('Execution error:', error);
      setOutput(prev => prev + 'Error: ' + (error.message || 'Failed to execute code') + '\n');
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
        setOutput(prev => prev + `\nServer on port ${currentExecution.port} stopped.\n`);
      }
    } catch (error) {
      console.error('Error stopping execution:', error);
      setOutput(prev => prev + 'Error stopping server: ' + (error.message || 'Unknown error') + '\n');
    }
  };

  const handleValidate = (markers) => {
    onValidate(markers);
  };

  // Determine theme based on app theme or custom theme
  const editorTheme = customTheme || (appTheme === 'dark' ? 'devdeck-editor-dark' : 'vs');
  const lineCount = localValue ? localValue.split('\n').length : 1;
  const characterCount = localValue.length;

  return (
    <div className={`flex h-full min-h-0 flex-col bg-white text-slate-900 dark:bg-[#111113] dark:text-[#e4e4e7] ${className}`}>
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 dark:border-[#2b2b30] dark:bg-[#18181b]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-[#f4f4f5]">app.{language === 'typescript' ? 'ts' : language === 'json' ? 'json' : 'js'}</p>
            <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">
              {isReadOnly ? 'Read only' : 'Live editing'} - Wrap on - Auto format
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showInlineActions && (
            <>
              <Button
                onClick={handleRunCode}
                disabled={isExecuting}
                variant="outline"
                size="sm"
              >
                {isExecuting ? 'Running...' : 'Run Code'}
              </Button>
              {isServerRunning && (
                <Button
                  onClick={handleStopExecution}
                  variant="destructive"
                  size="sm"
                >
                  Stop Server
                </Button>
              )}
            </>
          )}
          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-[#2d2d30] dark:text-[#d4d4d8]">
            {language.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          defaultLanguage={language}
          value={localValue}
          onChange={handleChange}
          onCursorPositionChange={handleCursorChange}
          theme={editorTheme}
          onMount={handleEditorDidMount}
          onValidate={handleValidate}
          options={{
            ...options,
            readOnly: isReadOnly,
          }}
        />
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 text-xs text-slate-500 dark:border-[#2b2b30] dark:bg-[#18181b] dark:text-[#a1a1aa]">
        <div className="flex min-w-0 items-center gap-3">
          <span>Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}</span>
          <span>{lineCount} lines</span>
          <span>{characterCount} chars</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span>{isReadOnly ? 'Protected' : 'Editable'}</span>
          <span>UTF-8</span>
          <span>LF</span>
        </div>
      </div>
      {showInlineActions && output && (
        <div className="max-h-56 overflow-auto border-t border-[#2b2b30] bg-[#0f172a] p-4 font-mono text-sm text-[#86efac]">
          <pre>{output}</pre>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
