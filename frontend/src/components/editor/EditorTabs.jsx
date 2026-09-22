import { useState, useEffect } from 'react';
import {
  BeakerIcon,
  ClipboardDocumentListIcon,
  CodeBracketIcon as CodeIcon,
  CommandLineIcon as TerminalIcon,
  DocumentDuplicateIcon,
  LightBulbIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';

const EditorTabs = ({
  activeTab = 'editor',
  onTabChange,
  className = '',
  showConsole = true,
  showDocumentation = true,
  showTasks = true,
  showSnippets = true,
  showInsights = true,
  tabCounts = {},
  surface = 'default',
}) => {
  const { theme } = useTheme();
  const ide = surface === 'ide';
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`flex border-b ${ide ? 'border-[#2b2b30] bg-[#18181b]' : theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} ${className}`}>
        <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded m-1" />
        <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded m-1" />
      </div>
    );
  }

  const tabs = [
    { id: 'editor', icon: CodeIcon, label: 'Editor' },
    showConsole && { id: 'console', icon: TerminalIcon, label: 'Console', count: tabCounts.console },
    showTasks && { id: 'tasks', icon: ClipboardDocumentListIcon, label: 'Tasks', count: tabCounts.tasks },
    showSnippets && { id: 'snippets', icon: DocumentDuplicateIcon, label: 'Snippets', count: tabCounts.snippets },
    showDocumentation && { id: 'documentation', icon: DocumentTextIcon, label: 'Docs', count: tabCounts.documentation },
    { id: 'test', icon: BeakerIcon, label: 'Test' },
    showInsights && { id: 'insights', icon: LightBulbIcon, label: 'Insights', count: tabCounts.insights },
  ].filter(Boolean);

  const tabClasses = (isActive) =>
    `flex min-h-10.5 items-center px-4.5 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 border-b-2 ${
      isActive
        ? ide
          ? 'border-sky-500 bg-[#16161c] text-[#f4f4f5]'
          : theme === 'dark'
            ? 'border-sky-500 text-sky-300 bg-slate-800'
            : 'border-sky-500 text-sky-700 bg-slate-100'
        : ide
          ? 'border-transparent text-[#808088] hover:text-[#e4e4e7] hover:bg-[#1a1a20]/30'
          : theme === 'dark'
            ? 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
            : 'border-transparent text-gray-500 hover:text-gray-750 hover:bg-gray-100/50'
    } whitespace-nowrap`;

  return (
    <div className={`flex border-b ${ide ? 'border-[#202024]/85 bg-[#0f0f13]' : theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} ${className}`}>
      <nav className="flex -mb-px overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={tabClasses(isActive)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4.5 w-4.5 mr-2" aria-hidden="true" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`ml-2 py-0.5 px-2 rounded-lg text-[10px] font-bold transition-all duration-200 ${
                    ide
                      ? isActive
                        ? 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/20'
                        : 'bg-[#202025] text-[#808088]'
                      : isActive
                        ? 'bg-sky-100 text-sky-850 dark:bg-sky-900/30 dark:text-sky-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default EditorTabs;
