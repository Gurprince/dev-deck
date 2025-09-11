import { PlayIcon, CodeBracketIcon as CodeIcon, CommandLineIcon as TerminalIcon, ArrowDownTrayIcon as SaveIcon, ArrowPathIcon as RefreshIcon } from '@heroicons/react/24/outline';
import * as monaco from 'monaco-editor';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { executionApi } from '../../services/api';
import CodeEditor from './CodeEditor';
import EditorToolbar from './EditorToolbar';
import OutputPanel, { LogLevels } from './OutputPanel';
import EditorTabs from './EditorTabs';
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

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(\`Server is running on port \${PORT}\`);
});`;

const CodePlayground = ({
  initialCode = DEFAULT_CODE,
  language = 'javascript',
  projectId,
  onSave,
  readOnly = false,
  className = '',
}) => {
  const { theme } = useTheme();
  const { sendExecutionLog } = useSocket();
  const [code, setCode] = useState(initialCode);
  const [activeTab, setActiveTab] = useState('editor');
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef(null);
  const [endpoints, setEndpoints] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Reset editor content when initialCode prop changes (e.g., navigating to New Project)
  useEffect(() => {
    setCode(initialCode);
    setEndpoints([]);
    setLogs([]);
    setActiveTab('editor');
    // For a new project (no projectId), allow immediate save of boilerplate
    setHasUnsavedChanges(!projectId);
  }, [initialCode, projectId]);

  // Track code changes
  useEffect(() => {
    if (code !== initialCode) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [code, initialCode]);

  // Handle code execution
  const handleRunCode = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    const startTime = Date.now();
    
    try {
      // Clear previous logs
      setLogs(prevLogs => [
        ...prevLogs,
        { 
          message: '\n--- Preparing to execute code ---\n', 
          level: LogLevels.INFO,
          timestamp: new Date().toISOString() 
        }
      ]);
      
      // Execute the code
      const response = await executionApi.executeCode(code, projectId);
      
      // Handle the execution result
      if (response.data) {
        const { success, output, stderr } = response.data;
        
        if (success && output) {
          setLogs(prevLogs => [
            ...prevLogs,
            { 
              message: '\n--- Execution Output ---\n' + output, 
              level: LogLevels.INFO,
              timestamp: new Date().toISOString() 
            }
          ]);
        }
        
        if (stderr) {
          setLogs(prevLogs => [
            ...prevLogs,
            { 
              message: '\n--- Error Output ---\n' + stderr, 
              level: LogLevels.ERROR,
              timestamp: new Date().toISOString() 
            }
          ]);
        }
      }
      
      // Parse the code for endpoints
      try {
        const { data } = await executionApi.parseCode(code);
        if (data && data.endpoints && data.endpoints.length > 0) {
          setEndpoints(data.endpoints);
        }
      } catch (parseError) {
        console.error('Error parsing endpoints:', parseError);
        setLogs(prevLogs => [
          ...prevLogs,
          { 
            message: '\n--- Error parsing endpoints ---\n' + (parseError.message || 'Unknown error'),
            level: LogLevels.WARNING,
            timestamp: new Date().toISOString() 
          }
        ]);
      }
      
    } catch (error) {
      console.error('Execution error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'An error occurred during execution';
      const errorDetails = error.response?.data?.stderr || error.response?.data?.error || '';
      
      setLogs(prevLogs => [
        ...prevLogs,
        { 
          message: '\n--- Execution Failed ---\n' + errorMessage,
          level: LogLevels.ERROR,
          timestamp: new Date().toISOString() 
        },
        ...(errorDetails ? [{
          message: '\n--- Error Details ---\n' + errorDetails,
          level: LogLevels.ERROR,
          timestamp: new Date().toISOString()
        }] : [])
      ]);
    } finally {
      setIsRunning(false);
      const endTime = Date.now();
      const executionTime = ((endTime - startTime) / 1000).toFixed(2);
      
      setLogs(prevLogs => [
        ...prevLogs,
        { 
          message: `\n--- Execution completed in ${executionTime}s ---\n`, 
          level: LogLevels.INFO,
          timestamp: new Date().toISOString() 
        }
      ]);
      
      // Switch to console tab after execution
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
        'editor.background': '#1A202C',
        'editor.lineHighlightBackground': '#2D374850',
        'editorLineNumber.foreground': '#4A5568',
        'editorLineNumber.activeForeground': '#A0AEC0',
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

  // Render the active tab content
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'console':
        return (
          <OutputPanel 
            logs={logs} 
            isRunning={isRunning} 
            onClear={handleClearConsole}
          />
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
          </div>
        );
      case 'test':
        return (
          <div className="p-4 h-full overflow-auto space-y-3">
            <h3 className="text-lg font-medium">Test Endpoint</h3>
            <TestRunner endpoints={endpoints} />
          </div>
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
            className="h-full"
          />
        );
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <EditorToolbar
        onRun={handleRunCode}
        onFormat={handleFormatCode}
        onSave={handleSave}
        onReset={handleReset}
        isRunning={isRunning}
        isSaving={isSaving}
        canSave={hasUnsavedChanges || !projectId}
      />
      
      {/* Tabs */}
      <EditorTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabCounts={{
          console: logs.length > 0 ? logs.length : 0,
          documentation: endpoints.length > 0 ? endpoints.length : 0,
        }}
      />
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default CodePlayground;
