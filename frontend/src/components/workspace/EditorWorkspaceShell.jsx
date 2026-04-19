import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Squares2X2Icon, FolderIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

/**
 * Cursor-inspired workspace: activity bar + optional explorer + main column.
 */
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
  children,
}) => {
  const [explorerOpen, setExplorerOpen] = useState(true);
  const ide = surface === 'ide';

  const barBtn = (active, onClick, titleAttr, childrenIcon) => (
    <button
      type="button"
      onClick={onClick}
      title={titleAttr}
      className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
        active
          ? ide
            ? 'bg-[#2d2d30] text-[#e4e4e7]'
            : 'bg-sky-100 text-sky-700'
          : ide
            ? 'text-[#a1a1aa] hover:bg-[#2d2d30]/80 hover:text-[#e4e4e7]'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
      }`}
    >
      {childrenIcon}
    </button>
  );

  return (
    <div className={`flex h-full min-h-0 ${ide ? 'bg-[#1e1e1e] text-[#cccccc]' : 'bg-slate-50 text-slate-700'}`}>
      {/* Activity bar — Cursor-style narrow rail */}
      <aside
        className={`flex w-12 shrink-0 flex-col items-center border-r py-2 ${ide ? 'border-[#2b2b30] bg-[#18181b]' : 'border-slate-200 bg-white'}`}
        aria-label="Primary"
      >
        <Link
          to="/projects"
          title="All projects"
          className={`mb-1 flex h-10 w-10 items-center justify-center rounded-md transition-colors ${ide ? 'text-[#a1a1aa] hover:bg-[#2d2d30]/80 hover:text-[#e4e4e7]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'}`}
        >
          <Squares2X2Icon className="h-5 w-5" />
        </Link>
        {barBtn(explorerOpen, () => setExplorerOpen((o) => !o), 'Explorer (toggle)', <FolderIcon className="h-5 w-5" />)}
        {barBtn(
          chatOpen,
          onToggleChat,
          'Team chat',
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
        )}
        <div className="flex-1" />
        <span
          className={`flex h-10 w-10 items-center justify-center text-[10px] font-semibold tracking-tight ${ide ? 'text-[#71717a]' : 'text-slate-400'}`}
          title="Dev Deck"
        >
          DD
        </span>
      </aside>

      {/* Explorer */}
      {explorerOpen && (
        <aside className={`flex w-[220px] shrink-0 flex-col border-r ${ide ? 'border-[#2b2b30] bg-[#252526]' : 'border-slate-200 bg-slate-50'}`}>
          <div className={`border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${ide ? 'border-[#2b2b30] text-[#858585]' : 'border-slate-200 text-slate-500'}`}>
            Explorer
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className={`mb-2 truncate px-1 text-xs ${ide ? 'text-[#858585]' : 'text-slate-500'}`} title={title}>
              {title || 'Untitled'}
            </div>
            <div className={`border-l pl-2 ${ide ? 'border-[#404040]' : 'border-slate-300'}`}>
              <div
                className={`flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-sm ${ide ? 'bg-[#37373d] text-[#cccccc]' : 'bg-white text-slate-800 shadow-sm'}`}
                title="Project entry file"
              >
                <span className="text-[#cca700]">JS</span>
                <span className="truncate">main.js</span>
              </div>
              <p className={`mt-3 px-1 text-[11px] leading-relaxed ${ide ? 'text-[#858585]' : 'text-slate-500'}`}>
                Multi-file workspaces are coming soon. Your project code is stored as a single bundle.
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* Main column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Title bar */}
        <header className={`flex h-9 shrink-0 items-center gap-3 border-b px-3 ${ide ? 'border-[#2b2b30] bg-[#18181b]' : 'border-slate-200 bg-white'}`}>
          <div className="min-w-0 flex-1 flex items-baseline gap-2">
            <input
              value={title}
              onChange={(e) => onTitleChange?.(e.target.value)}
              className={`min-w-0 flex-1 bg-transparent text-sm font-medium placeholder-slate-400 focus:outline-none focus:ring-0 ${ide ? 'text-[#e4e4e7] placeholder-[#71717a]' : 'text-slate-950'}`}
              placeholder="Project title"
            />
            {subtitle ? (
              <span className={`hidden shrink-0 text-[11px] sm:inline ${ide ? 'text-[#858585]' : 'text-slate-500'}`}>{subtitle}</span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onBackToProjects}
              className={`rounded px-2 py-1 text-xs ${ide ? 'text-[#a1a1aa] hover:bg-[#2d2d30] hover:text-[#e4e4e7]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
            >
              All projects
            </button>
            {projectId && projectId !== 'new' && onDeleteProject ? (
              <button
                type="button"
                onClick={onDeleteProject}
                className="rounded px-2 py-1 text-xs text-red-400/90 hover:bg-[#3f1f1f] hover:text-red-300"
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
