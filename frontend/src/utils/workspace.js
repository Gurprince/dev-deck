const languageByExtension = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
};

export const LEGACY_ENTRY_FILE = 'src/index.js';

export const inferLanguageFromPath = (filePath = '') => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  return languageByExtension[extension] || 'plaintext';
};

export const normalizeWorkspacePath = (value = '') => {
  const trimmed = String(value).trim().replace(/\\/g, '/');
  if (!trimmed) return '';

  const segments = trimmed.split('/').filter(Boolean);
  const normalized = [];
  for (const segment of segments) {
    if (segment === '.' || segment === '..') return '';
    normalized.push(segment);
  }

  return normalized.join('/');
};

export const createLegacyWorkspace = (code = '') => ({
  files: [
    { path: 'src', type: 'folder', language: '', content: '' },
    {
      path: LEGACY_ENTRY_FILE,
      type: 'file',
      language: inferLanguageFromPath(LEGACY_ENTRY_FILE),
      content: code || '',
    },
  ],
  entryFilePath: LEGACY_ENTRY_FILE,
});

export const normalizeWorkspaceFiles = (files = [], fallbackCode = '') => {
  if (!Array.isArray(files) || files.length === 0) {
    return createLegacyWorkspace(fallbackCode).files;
  }

  const byPath = new Map();

  const ensureFolder = (folderPath) => {
    const normalizedFolder = normalizeWorkspacePath(folderPath);
    if (!normalizedFolder || byPath.has(normalizedFolder)) return;
    byPath.set(normalizedFolder, {
      path: normalizedFolder,
      type: 'folder',
      language: '',
      content: '',
    });
  };

  files.forEach((item) => {
    const normalized = normalizeWorkspacePath(item?.path);
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

  if (!normalizedFiles.some((item) => item.type === 'file')) {
    return createLegacyWorkspace(fallbackCode).files;
  }

  return normalizedFiles;
};

export const resolveEntryFilePath = (entryFilePath, files = [], fallbackCode = '') => {
  const normalizedFiles = normalizeWorkspaceFiles(files, fallbackCode);
  const filePaths = normalizedFiles.filter((item) => item.type === 'file').map((item) => item.path);
  const normalizedEntry = normalizeWorkspacePath(entryFilePath);

  if (normalizedEntry && filePaths.includes(normalizedEntry)) return normalizedEntry;
  if (filePaths.includes(LEGACY_ENTRY_FILE)) return LEGACY_ENTRY_FILE;

  return (
    filePaths.find((item) => ['index.js', 'src/index.js', 'app.js', 'server.js'].includes(item)) ||
    filePaths[0] ||
    LEGACY_ENTRY_FILE
  );
};

export const getWorkspaceState = ({ files = [], entryFilePath, code = '' } = {}) => {
  const normalizedFiles = normalizeWorkspaceFiles(files, code);
  const resolvedEntryFilePath = resolveEntryFilePath(entryFilePath, normalizedFiles, code);

  return {
    files: normalizedFiles,
    entryFilePath: resolvedEntryFilePath,
  };
};

export const getFileByPath = (files = [], filePath) =>
  files.find((item) => item.type === 'file' && item.path === filePath) || null;

export const buildExplorerTree = (files = []) => {
  const root = [];
  const byPath = new Map();

  const ensureNode = (item) => {
    if (byPath.has(item.path)) return byPath.get(item.path);
    const node = {
      ...item,
      name: item.path.split('/').pop(),
      children: [],
    };
    byPath.set(item.path, node);
    return node;
  };

  files.forEach((item) => {
    const node = ensureNode(item);
    const segments = item.path.split('/');
    if (segments.length === 1) {
      if (!root.includes(node)) root.push(node);
      return;
    }

    const parentPath = segments.slice(0, -1).join('/');
    const parent = ensureNode({
      path: parentPath,
      type: 'folder',
      language: '',
      content: '',
    });
    if (!parent.children.includes(node)) {
      parent.children.push(node);
    }
  });

  const sortNodes = (nodes) => {
    nodes.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'folder' ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(root);
  return root;
};

export const updateFileContent = (files = [], filePath, content) =>
  files.map((item) =>
    item.type === 'file' && item.path === filePath ? { ...item, content } : item
  );

export const createWorkspaceItem = (files = [], rawPath, type = 'file') => {
  const path = normalizeWorkspacePath(rawPath);
  if (!path) return files;

  const normalizedFiles = normalizeWorkspaceFiles(files);
  if (normalizedFiles.some((item) => item.path === path)) return normalizedFiles;

  const next = [...normalizedFiles];
  const segments = path.split('/');
  if (segments.length > 1) {
    let current = '';
    segments.slice(0, -1).forEach((segment) => {
      current = current ? `${current}/${segment}` : segment;
      if (!next.some((item) => item.path === current)) {
        next.push({ path: current, type: 'folder', language: '', content: '' });
      }
    });
  }

  next.push({
    path,
    type,
    language: type === 'file' ? inferLanguageFromPath(path) : '',
    content: type === 'file' ? '' : '',
  });

  return normalizeWorkspaceFiles(next);
};

export const renameWorkspaceItem = (files = [], oldPath, nextPath) => {
  const normalizedOld = normalizeWorkspacePath(oldPath);
  const normalizedNext = normalizeWorkspacePath(nextPath);
  if (!normalizedOld || !normalizedNext || normalizedOld === normalizedNext) return normalizeWorkspaceFiles(files);

  const prefix = `${normalizedOld}/`;
  const nextFiles = files.map((item) => {
    if (item.path === normalizedOld) {
      return {
        ...item,
        path: normalizedNext,
        language: item.type === 'file' ? inferLanguageFromPath(normalizedNext) : '',
      };
    }

    if (item.path.startsWith(prefix)) {
      const suffix = item.path.slice(prefix.length);
      const updatedPath = `${normalizedNext}/${suffix}`;
      return {
        ...item,
        path: updatedPath,
        language: item.type === 'file' ? inferLanguageFromPath(updatedPath) : '',
      };
    }

    return item;
  });

  return normalizeWorkspaceFiles(nextFiles);
};

export const deleteWorkspaceItem = (files = [], targetPath) => {
  const normalizedTarget = normalizeWorkspacePath(targetPath);
  if (!normalizedTarget) return normalizeWorkspaceFiles(files);

  const prefix = `${normalizedTarget}/`;
  return normalizeWorkspaceFiles(
    files.filter((item) => item.path !== normalizedTarget && !item.path.startsWith(prefix))
  );
};
