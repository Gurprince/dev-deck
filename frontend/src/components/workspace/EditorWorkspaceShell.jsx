import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChatBubbleLeftRightIcon, FolderIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import WorkspaceExplorer from './WorkspaceExplorer';

const EditorWorkspaceShell = ({
  title,
  onTitleChange,
  subtitle,
  projectId,
  onBackToProjects,
  onDeleteProject,
  chatOpen,
  onToggleChat,
  surface = 'ide',
  files = [],
  activeFilePath,
  entryFilePath,
  onSetEntryFile,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRenameItem,
  onDeleteItem,
  children,
}) => {
  const [explorerOpen, setExplorerOpen] = useState(true);
  const ide = surface === 'ide';

  const barBtn = (active, onClick, titleAttr, childrenIcon) => (
    <div className="relative w-full flex justify-center py-1">
      {active && ide && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
      )}
      <button
        type="button"
        onClick={onClick}
        title={titleAttr}
        className={`flex h-9.5 w-9.5 items-center justify-center rounded-lg transition-all duration-200 ${
          active
            ? ide
              ? 'bg-[#25252a] text-sky-400 shadow-inner'
              : 'bg-sky-50 text-sky-700 font-medium'
            : ide
              ? 'text-[#808088] hover:bg-[#1a1a20]/80 hover:text-[#e4e4e7] hover:scale-102'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-950 hover:scale-102'
        }`}
      >
        {childrenIcon}
      </button>
    </div>
  );

  return (
    <div className={`flex h-full min-h-0 ${ide ? 'bg-[#18181c] text-[#cccccc]' : 'bg-slate-50 text-slate-700'}`}>
      <aside
        className={`flex w-14 shrink-0 flex-col items-center border-r py-3 gap-1 ${ide ? 'border-[#202024]/85 bg-[#0f0f13]' : 'border-slate-200 bg-white'}`}
        aria-label="Primary"
      >
        <Link
          to="/projects"
          title="All projects"
          className={`mb-2 flex h-9.5 w-9.5 items-center justify-center rounded-lg transition-all duration-200 hover:scale-102 ${ide ? 'text-[#808088] hover:bg-[#1a1a20]/80 hover:text-sky-400' : 'text-slate-400 hover:bg-slate-100 hover:text-sky-750'}`}
        >
          <Squares2X2Icon className="h-5 w-5" />
        </Link>
        {barBtn(explorerOpen, () => setExplorerOpen((open) => !open), 'Explorer (toggle)', <FolderIcon className="h-5 w-5" />)}
        {barBtn(chatOpen, onToggleChat, 'Team chat', <ChatBubbleLeftRightIcon className="h-5 w-5" />)}
        <div className="flex-1" />
        <span
          className={`flex h-10 w-10 items-center justify-center text-[10px] font-extrabold tracking-wider ${ide ? 'text-[#505058]' : 'text-slate-400'}`}
          title="Dev Deck"
        >
          DEVDECK
        </span>
      </aside>

      {explorerOpen ? (
        <aside className={`flex w-[260px] shrink-0 flex-col border-r ${ide ? 'border-[#202024]/85 bg-[#141418]' : 'border-slate-200 bg-slate-50'}`}>
          <WorkspaceExplorer
            title={title}
            files={files}
            activeFilePath={activeFilePath}
            entryFilePath={entryFilePath}
            onSetEntryFile={onSetEntryFile}
            onOpenFile={onOpenFile}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onRenameItem={onRenameItem}
            onDeleteItem={onDeleteItem}
            surface={surface}
          />
        </aside>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className={`flex h-11 shrink-0 items-center gap-4 border-b px-4 ${ide ? 'border-[#202024]/85 bg-[#0f0f13]' : 'border-slate-200 bg-white'}`}>
          <div className="min-w-0 flex-1 items-center gap-3 sm:flex">
            <input
              value={title}
              onChange={(event) => onTitleChange?.(event.target.value)}
              className={`min-w-0 flex-1 bg-transparent text-sm font-semibold placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-sky-500/20 border-b border-transparent pb-0.5 ${ide ? 'text-[#e4e4e7] placeholder-[#505058]' : 'text-slate-950'}`}
              placeholder="Project title"
            />
            {subtitle ? (
              <span className={`hidden shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#25252a] text-[#808088] sm:inline`}>{subtitle}</span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onBackToProjects}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${ide ? 'text-[#a1a1aa] bg-[#1e1e24] hover:bg-[#282830] hover:text-[#e4e4e7]' : 'text-slate-650 bg-slate-100 hover:bg-slate-200 hover:text-slate-950'}`}
            >
              Dashboard
            </button>
            {projectId && projectId !== 'new' && onDeleteProject ? (
              <button
                type="button"
                onClick={onDeleteProject}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-400/90 bg-rose-500/10 hover:bg-[#3f1f1f] hover:text-rose-300 transition-all duration-200"
              >
                Delete
              </button>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
};

export default EditorWorkspaceShell;
