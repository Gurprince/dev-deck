import { useState, useEffect } from 'react';
import { PlayIcon, CodeBracketIcon as CodeIcon, CommandLineIcon as TerminalIcon, ArrowDownTrayIcon as SaveIcon, ArrowPathIcon as RefreshIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';

const EditorToolbar = ({
  onRun,
  onFormat,
  onSave,
  onReset,
  isRunning = false,
  isSaving = false,
  canSave = true,
  className = '',
  children,
  surface = 'default',
}) => {
  const { theme } = useTheme();
  const ide = surface === 'ide';
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className={`flex items-center space-x-2 p-2 border-b ${ide ? 'border-[#2b2b30] bg-[#18181b]' : theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} ${className}`}>
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  const buttonClasses = `inline-flex min-h-8 items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
    ide
      ? 'text-[#e4e4e7] bg-[#2d2d30] hover:bg-[#3c3c3c] focus:ring-[#38bdf8] focus:ring-offset-0'
      : theme === 'dark'
        ? 'text-white bg-slate-700 hover:bg-slate-600 focus:ring-sky-500'
        : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 focus:ring-sky-500'
  } disabled:opacity-50 disabled:cursor-not-allowed`;

  const iconClasses = 'h-4 w-4 mr-1.5';

  return (
    <div
      className={`flex items-center justify-between p-2 border-b ${
        ide
        ? 'border-[#2b2b30] bg-[#18181b]'
          : theme === 'dark'
            ? 'border-gray-700 bg-gray-800'
            : 'border-gray-200 bg-gray-50'
      } ${className}`}
    >
      <div className="flex min-w-0 items-center space-x-2 overflow-x-auto">
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className={`${buttonClasses} ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Run code"
          title="Run code"
        >
          <PlayIcon className={`${iconClasses} ${isRunning ? 'text-green-400' : ''}`} />
          {isRunning ? 'Running...' : 'Run'}
        </button>
        
        <button
          type="button"
          onClick={onFormat}
          className={buttonClasses}
          aria-label="Format code"
          title="Format code"
        >
          <CodeIcon className={iconClasses} />
          Format
        </button>
        
        <button
          type="button"
          onClick={onReset}
          className={`${buttonClasses} ${!ide && theme === 'dark' ? 'hover:bg-gray-600' : ''} ${!ide && theme !== 'dark' ? 'hover:bg-gray-100' : ''}`}
          aria-label="Reset code"
          title="Reset code"
        >
          <RefreshIcon className={iconClasses} />
          Reset
        </button>
      </div>
      
      <div className="flex shrink-0 items-center space-x-2">
        {children}
        
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className={`${buttonClasses} ${
            ide
              ? '!bg-[#0ea5e9] hover:!bg-[#0284c7] focus:ring-[#38bdf8] text-white'
              : theme === 'dark'
                ? 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500'
                : 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500 text-white'
          }`}
          aria-label="Save changes"
          title="Save changes"
        >
          <SaveIcon className={iconClasses} />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default EditorToolbar;
