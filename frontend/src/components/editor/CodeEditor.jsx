import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';

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
  const { onCodeUpdate, sendCodeUpdate } = useSocket();
  const editorRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const [localValue, setLocalValue] = useState(value);

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

  // Debounce code updates
  useEffect(() => {
    if (!isMounted) return;
    
    const timer = setTimeout(() => {
      if (projectId && localValue !== value) {
        sendCodeUpdate(projectId, localValue);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localValue, projectId, sendCodeUpdate, value, isMounted]);

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
