import { useState, useEffect } from 'react';
import {
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
    { id: 'test', icon: DocumentTextIcon, label: 'Test' },
    showInsights && { id: 'insights', icon: LightBulbIcon, label: 'Insights', count: tabCounts.insights },
  ].filter(Boolean);

  const tabClasses = (isActive) =>
    `flex min-h-10 items-center px-4 py-2 text-sm font-medium border-b-2 ${
      isActive
        ? ide
          ? 'border-[#38bdf8] bg-[#1f2937]/40 text-[#f4f4f5]'
          : theme === 'dark'
            ? 'border-sky-500 text-sky-300'
            : 'border-sky-500 text-sky-700'
        : ide
          ? 'border-transparent text-[#858585] hover:text-[#cccccc] hover:border-[#3c3c3c]'
          : theme === 'dark'
            ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    } whitespace-nowrap`;

  return (
    <div className={`flex border-b ${ide ? 'border-[#2b2b30] bg-[#18181b]' : theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} ${className}`}>
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
              <Icon className="h-5 w-5 mr-2" aria-hidden="true" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`ml-2 py-0.5 px-1.5 rounded-full text-xs font-medium ${
                    ide
                      ? isActive
                        ? 'bg-[#0ea5e9]/30 text-[#e4e4e7]'
                        : 'bg-[#3c3c3c] text-[#a1a1aa]'
                      : isActive
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300'
                        : 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-300'
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
