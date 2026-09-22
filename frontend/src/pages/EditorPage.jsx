import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import CodePlayground from '../components/editor/CodePlayground';
import EditorWorkspaceShell from '../components/workspace/EditorWorkspaceShell';
import { getProjectTemplate } from '../constants/boilerplate';
import {
  createWorkspaceItem,
  deleteWorkspaceItem,
  getFileByPath,
  getWorkspaceState,
  inferLanguageFromPath,
  normalizeWorkspacePath,
  renameWorkspaceItem,
  updateFileContent,
} from '../utils/workspace';
import { toast } from 'react-hot-toast';

const EditorPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedTemplate = getProjectTemplate(searchParams.get('template'));
  const { socket, joinProject, leaveProject } = useSocket();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('Untitled Project');
  const [chatOpen, setChatOpen] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [entryFilePath, setEntryFilePath] = useState(selectedTemplate.entryFilePath || 'src/index.js');
  const [activeFilePath, setActiveFilePath] = useState(selectedTemplate.entryFilePath || 'src/index.js');
  const [openFilePaths, setOpenFilePaths] = useState([]);

  const templateWorkspace = useMemo(
    () =>
      getWorkspaceState({
        files: selectedTemplate.files,
        entryFilePath: selectedTemplate.entryFilePath,
        code: selectedTemplate.code,
      }),
    [selectedTemplate]
  );

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => (await projectsApi.getById(projectId)).data,
    enabled: !!projectId && projectId !== 'new',
    onError: (err) => {
      toast.error(err.message || 'Failed to load project');
      if (err.status === 404) {
        navigate('/projects');
      }
    },
  });

  useEffect(() => {
    const sourceWorkspace =
      projectId && projectId !== 'new' && project
        ? getWorkspaceState({
            files: project.files,
            entryFilePath: project.entryFilePath,
            code: project.code,
          })
        : templateWorkspace;

    setWorkspaceFiles(sourceWorkspace.files);
    setEntryFilePath(sourceWorkspace.entryFilePath);
    setActiveFilePath(sourceWorkspace.entryFilePath);
    setOpenFilePaths([sourceWorkspace.entryFilePath]);
  }, [project, projectId, templateWorkspace]);

  useEffect(() => {
    if (project?.name) {
      setTitle(project.name);
    } else if (!projectId || projectId === 'new') {
      setTitle(selectedTemplate?.name || 'Untitled Project');
    }
  }, [project, projectId, selectedTemplate?.name]);

  useEffect(() => {
    if (!projectId || projectId === 'new') return undefined;
    joinProject(projectId);
    return () => leaveProject(projectId);
  }, [joinProject, leaveProject, projectId]);

  useEffect(() => {
    if (!socket || !projectId || projectId === 'new') return undefined;

    const handleRemoteCodeUpdate = (data) => {
      if (data && data.filePath && data.filePath !== activeFilePath && typeof data.code === 'string') {
        setWorkspaceFiles((current) => updateFileContent(current, data.filePath, data.code));
      }
    };

    socket.on('code-update', handleRemoteCodeUpdate);
    return () => {
      socket.off('code-update', handleRemoteCodeUpdate);
    };
  }, [socket, projectId, activeFilePath]);

  const currentFile = getFileByPath(workspaceFiles, activeFilePath) || getFileByPath(workspaceFiles, entryFilePath);
  const currentCode = currentFile?.content || '';
  const currentLanguage = inferLanguageFromPath(currentFile?.path || entryFilePath);

  const ensureOpenFile = (filePath) => {
    setOpenFilePaths((current) => (current.includes(filePath) ? current : [...current, filePath]));
  };

  const openFile = (filePath) => {
    const normalized = normalizeWorkspacePath(filePath);
    if (!normalized) return;
    setActiveFilePath(normalized);
    ensureOpenFile(normalized);
  };

  const closeFile = (filePath) => {
    setOpenFilePaths((current) => {
      const next = current.filter((item) => item !== filePath);
      if (activeFilePath === filePath) {
        const fallback = next[next.length - 1] || entryFilePath;
        setActiveFilePath(fallback);
      }
      return next.length ? next : [entryFilePath];
    });
  };

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, updates }) => (await projectsApi.update(id, updates)).data,
    onSuccess: () => {
      queryClient.invalidateQueries(['projects', projectId]);
      toast.success('Project saved successfully');
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || 'Failed to save project');
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (projectData) => (await projectsApi.create(projectData)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['projects']);
      navigate(`/projects/${data._id}`, { replace: true });
      toast.success('Project created successfully');
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || 'Failed to create project');
    },
  });

  const handleSave = async ({ files, entryFilePath: nextEntryFilePath, code }) => {
    try {
      const updates = {
        name: title?.trim() || project?.name || 'Untitled Project',
        code,
        files,
        entryFilePath: nextEntryFilePath,
      };

      if (!projectId || projectId === 'new') {
        await createProjectMutation.mutateAsync({
          ...updates,
          description: 'A new DevDeck project',
          isPublic: false,
        });
      } else {
        await updateProjectMutation.mutateAsync({
          id: projectId,
          updates,
        });
      }
      return true;
    } catch (saveError) {
      console.error('Error saving project:', saveError);
      return false;
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId || projectId === 'new' || !window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await projectsApi.delete(projectId);
      queryClient.invalidateQueries(['projects']);
      toast.success('Project deleted successfully');
      navigate('/projects');
    } catch (deleteError) {
      console.error('Error deleting project:', deleteError);
      toast.error(deleteError.message || 'Failed to delete project');
    }
  };

  const handleCodeChange = (nextCode) => {
    if (!currentFile?.path) return;
    setWorkspaceFiles((current) => updateFileContent(current, currentFile.path, nextCode));
  };

  const handleCreateFile = (filePath) => {
    if (!filePath) return;
    const normalized = normalizeWorkspacePath(filePath);
    if (!normalized) return;
    setWorkspaceFiles((current) => createWorkspaceItem(current, normalized, 'file'));
    openFile(normalized);
  };

  const handleCreateFolder = (folderPath) => {
    if (!folderPath) return;
    const normalized = normalizeWorkspacePath(folderPath);
    if (!normalized) return;
    setWorkspaceFiles((current) => createWorkspaceItem(current, normalized, 'folder'));
  };

  const handleRenameItem = (oldPath, nextPath) => {
    if (!oldPath || !nextPath) return;
    setWorkspaceFiles((current) => renameWorkspaceItem(current, oldPath, nextPath));

    if (entryFilePath === oldPath || entryFilePath.startsWith(`${oldPath}/`)) {
      const suffix = entryFilePath === oldPath ? '' : entryFilePath.slice(oldPath.length + 1);
      setEntryFilePath(suffix ? `${nextPath}/${suffix}` : nextPath);
    }

    if (activeFilePath === oldPath || activeFilePath.startsWith(`${oldPath}/`)) {
      const suffix = activeFilePath === oldPath ? '' : activeFilePath.slice(oldPath.length + 1);
      setActiveFilePath(suffix ? `${nextPath}/${suffix}` : nextPath);
    }

    setOpenFilePaths((current) =>
      current.map((item) =>
        item === oldPath || item.startsWith(`${oldPath}/`)
          ? `${nextPath}${item === oldPath ? '' : item.slice(oldPath.length)}`
          : item
      )
    );
  };

  const handleDeleteItem = (targetPath) => {
    if (!targetPath) return;
    if (!window.confirm(`Delete ${targetPath}?`)) return;

    const nextFiles = deleteWorkspaceItem(workspaceFiles, targetPath);
    const fallbackFile = nextFiles.find((item) => item.type === 'file')?.path || '';
    setWorkspaceFiles(nextFiles);

    if (targetPath === entryFilePath || entryFilePath.startsWith(`${targetPath}/`)) {
      setEntryFilePath(fallbackFile);
    }

    if (targetPath === activeFilePath || activeFilePath.startsWith(`${targetPath}/`)) {
      setActiveFilePath(fallbackFile);
    }

    setOpenFilePaths((current) => {
      const filtered = current.filter(
        (item) => item !== targetPath && !item.startsWith(`${targetPath}/`)
      );
      return filtered.length ? filtered : fallbackFile ? [fallbackFile] : [];
    });
  };

  const handleSetEntryFile = (filePath) => {
    const file = getFileByPath(workspaceFiles, filePath);
    if (!file) return;
    setEntryFilePath(filePath);
    openFile(filePath);
  };

  if (isLoading && projectId !== 'new') {
    return (
      <div className="flex h-full min-h-[50vh] flex-1 items-center justify-center bg-[#1e1e1e]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#2b2b30] border-t-[#0e639c]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl flex-1 p-6 text-[#e4e4e7]">
        <div className="border-l-4 border-red-500 bg-red-950/40 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-200">
                {error.message || 'Failed to load project. Please try again.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-slate-50 dark:bg-[#1e1e1e]">
      <EditorWorkspaceShell
        title={title}
        onTitleChange={setTitle}
        subtitle={
          project
            ? `Updated ${new Date(project.updatedAt).toLocaleString()}`
            : projectId === 'new'
              ? 'New project'
              : undefined
        }
        projectId={projectId}
        onBackToProjects={() => navigate('/projects')}
        onDeleteProject={projectId && projectId !== 'new' ? handleDeleteProject : undefined}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((current) => !current)}
        surface={theme === 'dark' ? 'ide' : 'default'}
        files={workspaceFiles}
        activeFilePath={activeFilePath}
        entryFilePath={entryFilePath}
        onSetEntryFile={handleSetEntryFile}
        onOpenFile={openFile}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
        onRenameItem={handleRenameItem}
        onDeleteItem={handleDeleteItem}
      >
        <CodePlayground
          initialCode={currentCode}
          language={currentLanguage}
          projectId={projectId || undefined}
          onSave={handleSave}
          onCodeChange={handleCodeChange}
          activeFilePath={activeFilePath}
          openFilePaths={openFilePaths}
          workspaceFiles={workspaceFiles}
          entryFilePath={entryFilePath}
          onOpenFile={openFile}
          onCloseFile={closeFile}
          chatOpen={chatOpen}
          onChatOpenChange={setChatOpen}
          surface={theme === 'dark' ? 'ide' : 'default'}
        />
      </EditorWorkspaceShell>
    </div>
  );
};

export default EditorPage;
