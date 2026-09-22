import path from 'path';

const LEGACY_ENTRY_FILE = 'src/index.js';

const languageByExtension = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.json': 'json',
  '.md': 'markdown',
  '.css': 'css',
  '.html': 'html',
  '.env': 'plaintext',
};

const normalizePath = (value = '') => {
  const trimmed = String(value).trim().replace(/\\/g, '/');
  if (!trimmed) return '';

  const normalized = path.posix.normalize(trimmed).replace(/^\/+/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('..')) {
    return '';
  }

  return normalized;
};

export const inferLanguageFromPath = (filePath = '') =>
  languageByExtension[path.posix.extname(filePath).toLowerCase()] || 'plaintext';

export const createLegacyWorkspace = (code = '') => ({
  files: [
    { path: 'src', type: 'folder' },
    {
      path: LEGACY_ENTRY_FILE,
      type: 'file',
      language: inferLanguageFromPath(LEGACY_ENTRY_FILE),
      content: typeof code === 'string' ? code : '',
    },
  ],
  entryFilePath: LEGACY_ENTRY_FILE,
  code: typeof code === 'string' ? code : '',
});

export const normalizeWorkspaceFiles = (files = [], fallbackCode = '') => {
  if (!Array.isArray(files) || files.length === 0) {
    return createLegacyWorkspace(fallbackCode).files;
  }

  const byPath = new Map();

  const ensureFolder = (folderPath) => {
    const normalizedFolder = normalizePath(folderPath);
    if (!normalizedFolder || byPath.has(normalizedFolder)) return;
    byPath.set(normalizedFolder, {
      path: normalizedFolder,
      type: 'folder',
      language: '',
      content: '',
    });
  };

  files.forEach((item) => {
    const normalized = normalizePath(item?.path);
    if (!normalized) return;

    const type = item?.type === 'folder' ? 'folder' : 'file';
    const segments = normalized.split('/');
    if (segments.length > 1) {
      let current = '';
      segments.slice(0, -1).forEach((segment) => {
        current = current ? `${current}/${segment}` : segment;
        ensureFolder(current);
      });
    }

    byPath.set(normalized, {
      path: normalized,
      type,
      language: type === 'file' ? item?.language || inferLanguageFromPath(normalized) : '',
      content: type === 'file' ? String(item?.content || '') : '',
    });
  });

  const normalizedFiles = Array.from(byPath.values()).sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'folder' ? -1 : 1;
    }
    return left.path.localeCompare(right.path);
  });

  const hasFile = normalizedFiles.some((item) => item.type === 'file');
  if (!hasFile) {
    const legacy = createLegacyWorkspace(fallbackCode);
    return legacy.files;
  }

  return normalizedFiles;
};

export const resolveEntryFilePath = (entryFilePath, files = [], fallbackCode = '') => {
  const normalized = normalizePath(entryFilePath);
  const normalizedFiles = normalizeWorkspaceFiles(files, fallbackCode);
  const fileSet = new Set(
    normalizedFiles.filter((item) => item.type === 'file').map((item) => item.path)
  );

  if (normalized && fileSet.has(normalized)) {
    return normalized;
  }

  if (fileSet.has(LEGACY_ENTRY_FILE)) {
    return LEGACY_ENTRY_FILE;
  }

  const preferred = ['index.js', 'src/index.js', 'app.js', 'server.js'];
  const foundPreferred = preferred.find((candidate) => fileSet.has(candidate));
  if (foundPreferred) return foundPreferred;

  return normalizedFiles.find((item) => item.type === 'file')?.path || LEGACY_ENTRY_FILE;
};

export const getEntryFileContent = ({ files = [], entryFilePath, code = '' }) => {
  const normalizedFiles = normalizeWorkspaceFiles(files, code);
  const resolvedEntry = resolveEntryFilePath(entryFilePath, normalizedFiles, code);
  const entry = normalizedFiles.find(
    (item) => item.type === 'file' && item.path === resolvedEntry
  );

  return {
    files: normalizedFiles,
    entryFilePath: resolvedEntry,
    code: entry?.content || '',
  };
};

export const getWorkspaceCodeBundle = ({ files = [], entryFilePath, code = '' }) => {
  const workspace = getEntryFileContent({ files, entryFilePath, code });
  const bundle = workspace.files
    .filter((item) => item.type === 'file')
    .map((item) => `// FILE: ${item.path}\n${item.content}`)
    .join('\n\n');

  return {
    ...workspace,
    bundle,
  };
};
