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
  surface = 'default',
}) => {
  const { theme } = useTheme();
  const ide = surface === 'ide';
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
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2.5 border-b shrink-0 ${
          ide
            ? isRunning
              ? 'border-[#0e639c]/50 bg-[#1e1e1e]'
              : 'border-[#2b2b30] bg-[#18181b]'
            : isRunning
              ? 'border-sky-300/80 dark:border-sky-500/40 bg-sky-50/80 dark:bg-sky-950/40'
              : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <TerminalIcon
            className={`h-5 w-5 shrink-0 ${
              ide
                ? isRunning
                  ? 'text-[#0e639c]'
                  : 'text-[#858585]'
                : isRunning
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-gray-500'
            }`}
          />
          <div className="min-w-0">
            <h3
              className={`text-sm font-semibold truncate ${ide ? 'text-[#e4e4e7]' : 'text-gray-800 dark:text-gray-100'}`}
            >
              Console
            </h3>
            <p className={`text-xs ${ide ? 'text-[#858585]' : 'text-gray-500 dark:text-gray-400'}`}
            >
              {isRunning ? (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full animate-pulse ${ide ? 'bg-[#38bdf8]' : 'bg-sky-500'}`}
                  />
                  Running...
                </span>
              ) : (
                'Output from Run'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2 py-1 rounded ${
              ide
                ? 'text-[#a1a1aa] hover:bg-[#2d2d30]'
                : theme === 'dark'
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
              ide
                ? 'text-[#a1a1aa] hover:bg-[#2d2d30]'
                : theme === 'dark'
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
        className={`flex-1 min-h-0 overflow-y-auto p-3 font-mono text-sm leading-relaxed ${
          ide
            ? 'bg-[#1e1e1e] text-[#cccccc] border-t border-[#2b2b30]'
            : theme === 'dark'
              ? 'bg-slate-950 text-gray-200 border-t border-slate-800'
              : 'bg-slate-50 text-gray-800 border-t border-gray-100'
        }`}
        onScroll={handleScroll}
      >
        {logs.length === 0 ? (
          <div
            className={`h-full min-h-[12rem] flex flex-col items-center justify-center gap-2 text-center px-4 ${ide ? 'text-[#858585]' : 'text-gray-500 dark:text-gray-400'}`}
          >
            <TerminalIcon className="h-10 w-10 opacity-40" aria-hidden />
            <p className="text-sm font-medium">No output yet</p>
            <p className="text-xs max-w-sm">
              Click <span className="font-semibold text-gray-700 dark:text-gray-300">Run</span> in the toolbar to execute your code. Timings show browser and server run time.
            </p>
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
