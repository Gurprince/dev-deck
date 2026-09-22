import { useMemo, useState } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentIcon,
  FolderIcon,
  FolderOpenIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { buildExplorerTree } from '../../utils/workspace';

const getFileIconColor = (filename) => {
  if (!filename) return 'text-[#808088]';
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'text-amber-400/90';
    case 'ts':
    case 'tsx':
      return 'text-sky-400';
    case 'json':
      return 'text-purple-400';
    case 'css':
      return 'text-teal-400';
    case 'html':
      return 'text-orange-400';
    case 'md':
      return 'text-emerald-400';
    default:
      return 'text-[#8892b0]';
  }
};

const WorkspaceExplorer = ({
  title,
  files = [],
  activeFilePath,
  entryFilePath,
  onSetEntryFile,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRenameItem,
  onDeleteItem,
  surface = 'ide',
}) => {
  const ide = surface === 'ide';
  const tree = useMemo(() => buildExplorerTree(files), [files]);
  const [expanded, setExpanded] = useState({});

  const toggleExpanded = (path) => {
    setExpanded((current) => ({
      ...current,
      [path]: current[path] === undefined ? false : !current[path],
    }));
  };

  const promptForPath = (label, initialValue = '') => {
    const value = window.prompt(label, initialValue);
    return value?.trim() || '';
  };

  const renderNode = (node, depth = 0) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expanded[node.path] !== false;
    const isActive = activeFilePath === node.path;
    const isEntry = entryFilePath === node.path;

    return (
      <div key={node.path}>
        <div
          className={`group flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-all duration-150 ${
            isActive
              ? ide
                ? 'bg-[#25252a]/90 text-[#f4f4f5] shadow-sm font-semibold'
                : 'bg-sky-100/80 text-sky-800 font-semibold'
              : ide
                ? 'text-[#cccccc] hover:bg-[#1a1a20]/60 hover:text-white'
                : 'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900'
          }`}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {isFolder ? (
            <button
              type="button"
              onClick={() => toggleExpanded(node.path)}
              className={`rounded p-0.5 transition-colors duration-155 ${ide ? 'text-[#808088] hover:text-[#f4f4f5]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {isExpanded ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
            </button>
          ) : (
            <span className="inline-block w-4.5" />
          )}

          <button
            type="button"
            onClick={() => {
              if (isFolder) toggleExpanded(node.path);
              else onOpenFile?.(node.path);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            {isFolder ? (
              isExpanded ? <FolderOpenIcon className="h-4 w-4 text-sky-400/90" /> : <FolderIcon className="h-4 w-4 text-sky-400/95" />
            ) : (
              <DocumentIcon className={`h-4 w-4 ${getFileIconColor(node.name)}`} />
            )}
            <span className="truncate">{node.name}</span>
            {isEntry ? (
              <span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider ${ide ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-450 shadow-[0_0_8px_-2px_rgba(16,185,129,0.3)]' : 'border-emerald-300 bg-emerald-50 text-emerald-705'}`}>
                RUN
              </span>
            ) : null}
          </button>

          <div className="hidden items-center gap-1 group-hover:flex animate-in fade-in duration-100">
            <button
              type="button"
              onClick={() =>
                isFolder
                  ? onCreateFile?.(promptForPath('New file path', `${node.path}/new-file.js`))
                  : onRenameItem?.(node.path, promptForPath('Rename path', node.path))
              }
              className={`rounded p-0.5 transition-colors ${ide ? 'text-[#808088] hover:bg-[#25252a] hover:text-[#f4f4f5]' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'}`}
              title={isFolder ? "New File" : "Rename"}
            >
              {isFolder ? <PlusIcon className="h-3.5 w-3.5" /> : <PencilSquareIcon className="h-3.5 w-3.5" />}
            </button>
            {isFolder ? (
              <button
                type="button"
                onClick={() => onCreateFolder?.(promptForPath('New folder path', `${node.path}/new-folder`))}
                className={`rounded p-0.5 transition-colors ${ide ? 'text-[#808088] hover:bg-[#25252a] hover:text-[#f4f4f5]' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'}`}
                title="New Folder"
              >
                <FolderPlusIconShim />
              </button>
            ) : null}
            {!isFolder ? (
              <button
                type="button"
                onClick={() => onSetEntryFile?.(node.path)}
                className={`rounded px-1 py-0.5 text-[8px] font-extrabold tracking-wider transition-colors ${
                  isEntry
                    ? ide
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-emerald-50 text-emerald-700'
                    : ide
                      ? 'text-[#808088] hover:bg-[#25252a] hover:text-emerald-400'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-emerald-700'
                }`}
                title="Set as entry run file"
              >
                RUN
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onDeleteItem?.(node.path)}
              className={`rounded p-0.5 transition-colors ${ide ? 'text-[#808088] hover:bg-rose-500/10 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-650'}`}
              title="Delete"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {isFolder && isExpanded ? node.children.map((child) => renderNode(child, depth + 1)) : null}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col font-sans">
      <div className={`border-b px-4 py-3 text-[10px] font-bold uppercase tracking-wider ${ide ? 'border-[#202024]/85 text-[#808088] bg-[#0f0f13]' : 'border-slate-200 text-slate-500'}`}>
        Explorer
      </div>
      <div className={`border-b px-4 py-3 bg-[#111115]/40`}>
        <p className={`truncate text-xs font-bold ${ide ? 'text-[#f4f4f5]' : 'text-slate-700'}`} title={title}>
          {title || 'Untitled Workspace'}
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => onCreateFile?.(promptForPath('New file path', 'src/new-file.js'))}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${ide ? 'bg-[#222226] text-[#c0c0c8] hover:bg-[#2a2a30] hover:text-white border border-[#202024]/60' : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50 border border-slate-200'}`}
          >
            + File
          </button>
          <button
            type="button"
            onClick={() => onCreateFolder?.(promptForPath('New folder path', 'src/new-folder'))}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${ide ? 'bg-[#222226] text-[#c0c0c8] hover:bg-[#2a2a30] hover:text-white border border-[#202024]/60' : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50 border border-slate-200'}`}
          >
            + Folder
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {tree.length ? (
          tree.map((node) => renderNode(node))
        ) : (
          <p className={`px-2 py-3 text-xs leading-relaxed ${ide ? 'text-[#808088]' : 'text-slate-500'}`}>
            Workspace is empty. Create a file above to begin building.
          </p>
        )}
      </div>
    </div>
  );
};

const FolderPlusIconShim = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5">
    <path d="M2.5 5.833c0-.92.746-1.666 1.667-1.666h3.08c.442 0 .866.176 1.178.488l.42.42c.312.312.736.488 1.178.488h5.81c.92 0 1.667.746 1.667 1.666v6.604c0 .92-.746 1.667-1.667 1.667H4.167A1.667 1.667 0 0 1 2.5 13.833V5.833Z" />
    <path d="M10 8v4M8 10h4" />
  </svg>
);

export default WorkspaceExplorer;
