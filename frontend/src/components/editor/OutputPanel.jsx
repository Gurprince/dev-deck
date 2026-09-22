import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  CommandLineIcon as TerminalIcon,
  ExclamationCircleIcon,
  FunnelIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';

const LogLevels = {
  INFO: 'info',
  ERROR: 'error',
  SUCCESS: 'success',
  WARNING: 'warning',
};

const levelConfig = {
  [LogLevels.INFO]: {
    label: 'Info',
    icon: InformationCircleIcon,
    ideText: 'text-[#d4d4d8]',
    defaultText: 'text-slate-700 dark:text-slate-200',
    chip: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
  },
  [LogLevels.WARNING]: {
    label: 'Warning',
    icon: ExclamationCircleIcon,
    ideText: 'text-amber-300',
    defaultText: 'text-amber-700 dark:text-amber-300',
    chip: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  },
  [LogLevels.ERROR]: {
    label: 'Error',
    icon: XCircleIcon,
    ideText: 'text-red-300',
    defaultText: 'text-red-700 dark:text-red-300',
    chip: 'border-red-500/30 bg-red-500/15 text-red-300',
  },
  [LogLevels.SUCCESS]: {
    label: 'Success',
    icon: CheckCircleIcon,
    ideText: 'text-emerald-300',
    defaultText: 'text-emerald-700 dark:text-emerald-300',
    chip: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  },
};

const levelOrder = [LogLevels.INFO, LogLevels.WARNING, LogLevels.ERROR, LogLevels.SUCCESS];

const OutputPanel = ({
  logs = [],
  isRunning = false,
  onClear,
  className = '',
  surface = 'default',
}) => {
  useTheme();
  const ide = surface === 'ide';
  const endOfLogsRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [activeLevel, setActiveLevel] = useState('all');
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const counts = {
      total: logs.length,
      [LogLevels.INFO]: 0,
      [LogLevels.WARNING]: 0,
      [LogLevels.ERROR]: 0,
      [LogLevels.SUCCESS]: 0,
    };

    logs.forEach((log) => {
      const level = log.level || LogLevels.INFO;
      counts[level] = (counts[level] || 0) + 1;
    });

    return counts;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (activeLevel === 'all') return logs;
    return logs.filter((log) => (log.level || LogLevels.INFO) === activeLevel);
  }, [activeLevel, logs]);

  useEffect(() => {
    if (autoScroll && endOfLogsRef.current) {
      endOfLogsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  useEffect(() => {
    if (!copied) return undefined;
    const timeoutId = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.target;
    const isScrolledToBottom = scrollHeight - scrollTop <= clientHeight + 10;
    setAutoScroll(isScrolledToBottom);
  };

  const handleCopyLogs = async () => {
    if (!filteredLogs.length) return;

    const text = filteredLogs
      .map((log) => {
        const level = (log.level || LogLevels.INFO).toUpperCase();
        const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '';
        return `[${level}${time ? ` ${time}` : ''}] ${log.message}`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (error) {
      console.error('Could not copy console logs:', error);
    }
  };

  const panelHeaderClass = ide
    ? isRunning
      ? 'border-[#0e639c]/50 bg-[#18181b]'
      : 'border-[#2b2b30] bg-[#18181b]'
    : isRunning
      ? 'border-sky-300/80 bg-sky-50/80 dark:border-sky-500/40 dark:bg-sky-950/40'
      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900';

  const bodyClass = ide
    ? 'bg-[#111113] text-[#cccccc] border-t border-[#2b2b30]'
    : 'bg-slate-50 text-slate-800 border-t border-slate-100 dark:bg-slate-950 dark:text-slate-200 dark:border-slate-800';

  const mutedText = ide ? 'text-[#858585]' : 'text-slate-500 dark:text-slate-400';
  const strongText = ide ? 'text-[#e4e4e7]' : 'text-slate-800 dark:text-slate-100';
  const subtleButton = ide
    ? 'text-[#a1a1aa] hover:bg-[#2d2d30] hover:text-[#f4f4f5]'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
  const cardClass = ide
    ? 'border-[#2b2b30] bg-[#18181b]'
    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div className={`shrink-0 border-b px-3 py-3 ${panelHeaderClass}`}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`rounded-md border p-2 ${ide ? 'border-[#2b2b30] bg-[#111113]' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'}`}>
              <TerminalIcon className={`h-5 w-5 ${isRunning ? 'text-sky-400' : mutedText}`} />
            </div>
            <div className="min-w-0">
              <h3 className={`truncate text-sm font-semibold ${strongText}`}>Console</h3>
              <p className={`mt-1 text-xs ${mutedText}`}>
                {isRunning ? 'Execution is in progress. New output will stream here as it arrives.' : 'Review output, warnings, timing, and runtime failures from the latest runs.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoScroll((current) => !current)}
              className={`rounded-md px-2.5 py-1.5 text-xs transition ${subtleButton}`}
            >
              Auto-scroll: {autoScroll ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={handleCopyLogs}
              disabled={!filteredLogs.length}
              className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${subtleButton}`}
            >
              <ClipboardDocumentIcon className="mr-1.5 h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={logs.length === 0}
              className={`rounded-md px-2.5 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${subtleButton}`}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-5">
          <div className={`rounded-md border p-3 ${cardClass}`}>
            <p className={`text-[11px] uppercase tracking-[0.2em] ${mutedText}`}>Entries</p>
            <p className={`mt-1 text-lg font-semibold ${strongText}`}>{stats.total}</p>
          </div>
          {levelOrder.map((level) => {
            const config = levelConfig[level];
            const Icon = config.icon;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setActiveLevel((current) => (current === level ? 'all' : level))}
                className={`rounded-md border p-3 text-left transition ${
                  activeLevel === level
                    ? config.chip
                    : cardClass
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[11px] uppercase tracking-[0.2em] ${activeLevel === level ? 'text-current' : mutedText}`}>
                    {config.label}
                  </p>
                  <Icon className="h-4 w-4" />
                </div>
                <p className={`mt-1 text-lg font-semibold ${activeLevel === level ? 'text-current' : strongText}`}>{stats[level]}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs ${ide ? 'border-[#2b2b30] bg-[#111113] text-[#a1a1aa]' : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
            <FunnelIcon className="mr-1.5 h-3.5 w-3.5" />
            Showing {filteredLogs.length} of {logs.length}
          </span>
          {isRunning ? (
            <span className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs text-sky-300">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
              Live run
            </span>
          ) : null}
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto p-3 ${bodyClass}`} onScroll={handleScroll}>
        {filteredLogs.length === 0 ? (
          <div className={`flex h-full min-h-[14rem] flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 text-center ${ide ? 'border-[#2b2b30] text-[#858585]' : 'border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400'}`}>
            <TerminalIcon className="h-10 w-10 opacity-40" aria-hidden />
            <p className="text-sm font-medium">
              {logs.length === 0 ? 'No output yet' : 'No logs match this filter'}
            </p>
            <p className="max-w-sm text-xs">
              {logs.length === 0
                ? 'Run the project to capture server output, warnings, and runtime failures here.'
                : 'Switch filters or clear the console to return to the full output stream.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log, index) => {
              const level = log.level || LogLevels.INFO;
              const config = levelConfig[level] || levelConfig[LogLevels.INFO];
              const Icon = config.icon;

              return (
                <article
                  key={`${level}-${log.timestamp || index}-${index}`}
                  className={`rounded-md border p-3 ${
                    ide
                      ? 'border-[#2b2b30] bg-[#18181b]'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${ide ? config.ideText : config.defaultText}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${config.chip}`}>
                          {config.label}
                        </span>
                        {log.timestamp ? (
                          <span className={`text-[11px] ${mutedText}`}>
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        ) : null}
                      </div>
                      <pre
                        className={`mt-2 whitespace-pre-wrap break-words font-mono text-sm leading-relaxed ${
                          ide ? config.ideText : config.defaultText
                        }`}
                      >
                        {log.message}
                      </pre>
                    </div>
                  </div>
                </article>
              );
            })}
            <div ref={endOfLogsRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputPanel;
export { LogLevels };
