import { useEffect, useRef, useState } from 'react';
import { CommandLineIcon as TerminalIcon, XCircleIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';

const LogLevels = {
  INFO: 'info',
  ERROR: 'error',
  SUCCESS: 'success',
  WARNING: 'warning',
};

const LogItem = ({ message, level = LogLevels.INFO, timestamp, className = '' }) => {
  const { theme } = useTheme();
  
  const getLevelStyles = () => {
    switch (level) {
      case LogLevels.ERROR:
        return 'text-red-500';
      case LogLevels.SUCCESS:
        return 'text-green-500';
      case LogLevels.WARNING:
        return 'text-yellow-500';
      default:
        return theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
    }
  };

  const getIcon = () => {
    switch (level) {
      case LogLevels.ERROR:
        return <XCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" />;
      case LogLevels.SUCCESS:
        return <CheckCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" />;
      case LogLevels.WARNING:
        return <ExclamationCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" />;
      default:
        return <TerminalIcon className="h-4 w-4 mr-2 flex-shrink-0" />;
    }
  };

  return (
    <div className={`flex items-start py-1 px-2 text-sm font-mono ${getLevelStyles()} ${className}`}>
      {getIcon()}
      <span className="flex-1 whitespace-pre-wrap break-words">{message}</span>
      {timestamp && (
        <span className="ml-2 text-xs opacity-50">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

const OutputPanel = ({
  logs = [],
  isRunning = false,
  onClear,
  className = '',
}) => {
  const { theme } = useTheme();
  const endOfLogsRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && endOfLogsRef.current) {
      endOfLogsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isScrolledToBottom = scrollHeight - scrollTop <= clientHeight + 10;
    setAutoScroll(isScrolledToBottom);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center
         space-x-2">
          <TerminalIcon className="h-5 w-5 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Output {isRunning && '(Running...)'}
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2 py-1 rounded ${
              theme === 'dark'
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {autoScroll ? 'Auto-scroll: On' : 'Auto-scroll: Off'}
          </button>
          <button
            type="button"
            onClick={onClear}
            className={`text-xs px-2 py-1 rounded ${
              theme === 'dark'
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            disabled={logs.length === 0}
          >
            Clear
          </button>
        </div>
      </div>
      <div
        className={`flex-1 overflow-y-auto p-2 font-mono text-sm ${
          theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-800'
        }`}
        onScroll={handleScroll}
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            No output yet. Run your code to see the results here.
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <LogItem
                key={index}
                message={log.message}
                level={log.level}
                timestamp={log.timestamp}
              />
            ))}
            <div ref={endOfLogsRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputPanel;
export { LogLevels };
