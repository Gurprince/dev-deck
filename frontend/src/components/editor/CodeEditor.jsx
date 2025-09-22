import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { throttle } from 'lodash';
import { useAuth } from '../../context/AuthContext';
import InlineComment from './InlineComment';

const CodeEditor = ({
  value = '',
  onChange = () => {},
  language = 'javascript',
  theme: customTheme,
  options = {},
  height = '100%',
  width = '100%',
  onMount = () => {},
  onValidate = () => {},
  projectId,
  isReadOnly = false,
  className = '',
}) => {
  const { theme: appTheme } = useTheme();
  const { onCodeUpdate, sendCodeUpdate, sendCursorPosition, onCursorPositionUpdate, onCodeComment, sendCodeComment } = useSocket();
  const { user } = useAuth();
  const editorRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [collaboratorCursors, setCollaboratorCursors] = useState({});
  const [comments, setComments] = useState([]);
  const [activeComment, setActiveComment] = useState(null);
  const [commentPosition, setCommentPosition] = useState({ x: 0, y: 0 });

  // Handle external value changes
  useEffect(() => {
    if (editorRef.current && value !== localValue) {
      setLocalValue(value);
    }
  }, [value]);

  // Handle real-time collaboration
  useEffect(() => {
    if (!projectId || !isMounted) return;

    const handleCodeUpdate = (code) => {
      if (code !== localValue) {
        setLocalValue(code);
        onChange(code);
      }
    };

    const cleanup = onCodeUpdate(handleCodeUpdate);
    return cleanup;
  }, [projectId, onCodeUpdate, localValue, onChange, isMounted]);

  // Debounce code updates (broadcast to collaborators)
  useEffect(() => {
    if (!isMounted) return;
    
    const timer = setTimeout(() => {
      if (projectId && localValue !== value) {
        sendCodeUpdate(projectId, localValue);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localValue, projectId, sendCodeUpdate, value, isMounted]);

  // Effect for handling cursor position updates from collaborators
  useEffect(() => {
    if (!projectId || !isMounted || !editorRef.current) return;

    const handleCursorUpdate = (data) => {
      if (data.user.id === undefined) return; // Skip if no user ID
      
      setCollaboratorCursors(prev => ({
        ...prev,
        [data.user.id]: {
          ...data,
          timestamp: Date.now()
        }
      }));
    };

    const cleanup = onCursorPositionUpdate(handleCursorUpdate);
    
    // Clean up old cursors after inactivity
    const cursorCleanupInterval = setInterval(() => {
      const now = Date.now();
      setCollaboratorCursors(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(userId => {
          if (now - updated[userId].timestamp > 30000) { // Remove after 30 seconds of inactivity
            delete updated[userId];
          }
        });
        return updated;
      });
    }, 10000);

    return () => {
      cleanup();
      clearInterval(cursorCleanupInterval);
    };
  }, [projectId, isMounted, onCursorPositionUpdate]);

  // Create throttled cursor position sender
  const throttledSendCursorPosition = useRef(
    throttle((position) => {
      if (projectId) {
        sendCursorPosition(projectId, position);
      }
    }, 100)
  ).current;

  // Handle comments
  useEffect(() => {
    if (!projectId || !isMounted) return;

    const handleCommentUpdate = (data) => {
      if (data.comment) {
        setComments(prev => {
          // Update existing comment or add new one
          const exists = prev.some(c => c.id === data.comment.id);
          if (exists) {
            return prev.map(c => c.id === data.comment.id ? data.comment : c);
          } else {
            return [...prev, data.comment];
          }
        });
      }
    };

    const cleanup = onCodeComment(handleCommentUpdate);
    return cleanup;
  }, [projectId, isMounted, onCodeComment]);

  // Add comment on selection
  const addComment = (selection, text) => {
    if (!projectId || !user) return;
    
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
    sendCodeComment(projectId, newComment);
    setActiveComment(null);
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    setIsMounted(true);
    
    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      fontSize: 14,
      wordWrap: 'on',
      automaticLayout: true,
      formatOnPaste: true,
      formatOnType: true,
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
              
              // Create a new comment
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
    editor.onDidChangeCursorPosition((e) => {
      const position = editor.getPosition();
      if (position) {
        throttledSendCursorPosition({
          lineNumber: position.lineNumber,
          column: position.column
        });
      }
    });

    // Add decorations for collaborator cursors
    const updateCursorDecorations = () => {
      if (!editor) return;
      
      // Create decorations for each collaborator cursor
      Object.values(collaboratorCursors).forEach(cursorData => {
        const { user, position } = cursorData;
        if (!position || !user) return;
        
        // Create cursor decoration
        const cursorDecoration = {
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column + 1
          ),
          options: {
            className: 'collaborator-cursor',
            hoverMessage: { value: user.name || 'Collaborator' },
            beforeContentClassName: 'collaborator-cursor-before',
            afterContentClassName: 'collaborator-cursor-after',
            inlineClassName: 'collaborator-cursor-inline',
            overviewRuler: {
              color: user.color || '#007acc',
              position: monaco.editor.OverviewRulerLane.Full
            },
          }
        };
        
        // Apply decoration
        editor.deltaDecorations([], [cursorDecoration]);
      });
    };

    // Update decorations when collaborator cursors change
      const decorationInterval = setInterval(updateCursorDecorations, 100);
      
      // Add decorations for comments
      const updateCommentDecorations = () => {
        if (!editor) return;
        
        // Create decorations for each comment
        const decorations = comments.map(comment => {
          return {
            range: new monaco.Range(
              comment.selection.startLineNumber,
              comment.selection.startColumn,
              comment.selection.endLineNumber,
              comment.selection.endColumn
            ),
            options: {
              inlineClassName: 'comment-highlight',
              hoverMessage: { value: `Comment by ${comment.author.name}: ${comment.text}` },
              className: 'comment-decoration',
              overviewRuler: {
                color: '#FFCC00',
                position: monaco.editor.OverviewRulerLane.Center
              },
              minimap: {
                color: '#FFCC00',
                position: monaco.editor.MinimapPosition.Inline
              }
            }
          };
        });
        
        // Apply decorations
        editor.deltaDecorations([], decorations);
      };
      
      // Update comment decorations when comments change
      const commentDecorationInterval = setInterval(updateCommentDecorations, 500);
      
      // Register custom language if needed
    monaco.languages.register({ id: 'http' });
    monaco.languages.setMonarchTokensProvider('http', {
      defaultToken: '',
      tokenizer: {
        root: [
          [/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+/, 'keyword'],
          [/\s(HTTP\/\d\.\d)/, 'type'],
          [/(https?:\/\/[^\s\{\}\]]+)/, 'string'],
          [/\{\{[^\}]*\}\}/, 'variable'],
          [/\/\/.*$/, 'comment'],
        ],
      },
    });

    onMount(editor, monaco);
    
    return () => {
      clearInterval(decorationInterval);
      clearInterval(commentDecorationInterval);
    };
  };

  const handleChange = (newValue) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleValidate = (markers) => {
    onValidate(markers);
  };

  // Determine theme based on app theme or custom theme
  const editorTheme = customTheme || (appTheme === 'dark' ? 'vs-dark' : 'light');

  return (
    <div className={`w-full h-full ${className}`}>
      <Editor
        height={height}
        width={width}
        language={language}
        theme={editorTheme}
        value={localValue}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        onValidate={handleValidate}
        options={{
          ...options,
          readOnly: isReadOnly,
          selectOnLineNumbers: true,
          roundedSelection: false,
          cursorStyle: 'line',
          automaticLayout: true,
          fontFamily: 'Fira Code, Menlo, Monaco, "Courier New", monospace',
          fontLigatures: true,
          fontSize: 14,
          lineHeight: 24,
          hideCursorInOverviewRuler: true,
          scrollBeyondLastLine: false,
          renderLineHighlight: 'all',
          minimap: { enabled: true },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          wordBasedSuggestions: true,
          parameterHints: {
            enabled: true,
          },
          suggestOnTriggerCharacters: true,
          tabSize: 2,
          insertSpaces: true,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          formatOnPaste: true,
          formatOnType: true,
          ...options,
        }}
      />
    </div>
  );
};

export default CodeEditor;
