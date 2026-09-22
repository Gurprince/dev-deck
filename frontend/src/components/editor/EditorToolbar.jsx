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

  const baseButtonClasses = `inline-flex min-h-8.5 items-center px-3.5 py-1.5 border border-transparent text-xs font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed`;

  const defaultColorClasses = ide
    ? 'text-[#c0c0c8] bg-[#1e1e24] hover:bg-[#282830] hover:text-white border-[#202024]/60 focus:ring-[#38bdf8] focus:ring-offset-0'
    : theme === 'dark'
      ? 'text-white bg-slate-700 hover:bg-slate-600 focus:ring-sky-500'
      : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 focus:ring-sky-500';

  const iconClasses = 'h-4 w-4 mr-1.5 transition-transform duration-200 group-hover:scale-105';

  return (
    <div
      className={`flex items-center justify-between p-2.5 border-b ${
        ide
        ? 'border-[#202024]/85 bg-[#0f0f13]'
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
          className={`${baseButtonClasses} group ${isRunning ? 'opacity-50 cursor-not-allowed' : ''} text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/18`}
          aria-label="Run code"
          title="Run code"
        >
          <PlayIcon className={`${iconClasses} ${isRunning ? 'text-emerald-300 animate-pulse' : 'text-emerald-400'}`} />
          {isRunning ? 'Running...' : 'Run'}
        </button>
        
        <button
          type="button"
          onClick={onFormat}
          className={`${baseButtonClasses} ${defaultColorClasses} group`}
          aria-label="Format code"
          title="Format code"
        >
          <CodeIcon className={iconClasses} />
          Format
        </button>
        
        <button
          type="button"
          onClick={onReset}
          className={`${baseButtonClasses} ${defaultColorClasses} group ${!ide && theme === 'dark' ? 'hover:bg-gray-600' : ''} ${!ide && theme !== 'dark' ? 'hover:bg-gray-100' : ''}`}
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
          className={`${baseButtonClasses} group ${
            ide
              ? 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 focus:ring-[#38bdf8] text-white shadow-md shadow-sky-500/10'
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
