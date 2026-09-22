import { XMarkIcon } from '@heroicons/react/24/outline';

const OpenFileTabs = ({
  files = [],
  activeFilePath,
  openFilePaths = [],
  onSelect,
  onClose,
  surface = 'ide',
}) => {
  const ide = surface === 'ide';

  const openFiles = openFilePaths
    .map((filePath) => files.find((item) => item.type === 'file' && item.path === filePath))
    .filter(Boolean);

  if (!openFiles.length) return null;

  return (
    <div className={`flex border-b ${ide ? 'border-[#2b2b30] bg-[#18181b]' : 'border-slate-200 bg-white'}`}>
      <div className="flex min-w-0 overflow-x-auto">
        {openFiles.map((file) => {
          const isActive = file.path === activeFilePath;
          return (
            <div
              key={file.path}
              className={`flex min-w-0 items-center border-r ${
                ide ? 'border-[#2b2b30]' : 'border-slate-200'
              } ${isActive ? (ide ? 'bg-[#111113]' : 'bg-slate-50') : ''}`}
            >
              <button
                type="button"
                onClick={() => onSelect?.(file.path)}
                className={`flex min-w-0 items-center gap-2 px-3 py-2 text-sm ${
                  isActive
                    ? ide
                      ? 'text-[#f4f4f5]'
                      : 'text-slate-900'
                    : ide
                      ? 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                      : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="truncate">{file.path.split('/').pop()}</span>
              </button>
              <button
                type="button"
                onClick={() => onClose?.(file.path)}
                className={`rounded p-1 ${ide ? 'text-[#71717a] hover:bg-[#2d2d30] hover:text-[#f4f4f5]' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OpenFileTabs;
