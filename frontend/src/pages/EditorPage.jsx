import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import CodePlayground from '../components/editor/CodePlayground';
import EditorWorkspaceShell from '../components/workspace/EditorWorkspaceShell';
import { getProjectTemplate } from '../constants/boilerplate';
import { toast } from 'react-hot-toast';

const EditorPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedTemplate = getProjectTemplate(searchParams.get('template'));
  const starterCode = selectedTemplate.code;
  const [chatOpen, setChatOpen] = useState(false);
  const { joinProject, leaveProject, onCodeUpdate } = useSocket();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('Untitled Project');

  // Fetch project data
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

  // Sync title when project data loads
  useEffect(() => {
    if (project?.name) {
      setTitle(project.name);
    } else if (!projectId || projectId === 'new') {
      setTitle(selectedTemplate?.name || 'Untitled Project');
    }
  }, [project, projectId, selectedTemplate?.name]);

  // Update mutation for saving project
  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, updates }) => (await projectsApi.update(id, updates)).data,
    onSuccess: () => {
      queryClient.invalidateQueries(['projects', projectId]);
      toast.success('Project saved successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save project');
    },
  });

  // Create new project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (projectData) => (await projectsApi.create(projectData)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['projects']);
      navigate(`/projects/${data._id}`, { replace: true });
      toast.success('Project created successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  // Handle real-time code updates
  useEffect(() => {
    if (!projectId || projectId === 'new') return;
    
    // Join project room for real-time collaboration
    joinProject(projectId);
    
    // Handle incoming code updates
    const cleanupCodeUpdate = onCodeUpdate((code) => {
      if (code !== project?.code) {
        // Update local state without saving to the server
        queryClient.setQueryData(['projects', projectId], (oldData) => ({
          ...oldData,
          code,
        }));
      }
    });
    
    // Cleanup on unmount
    return () => {
      cleanupCodeUpdate();
      if (projectId && projectId !== 'new') {
        leaveProject(projectId);
      }
    };
  }, [projectId, project?.code, joinProject, leaveProject, onCodeUpdate, queryClient]);

  // Handle saving the project
  const handleSave = async (code) => {
    try {
      if (!projectId) {
        // Create new project
        await createProjectMutation.mutateAsync({
          name: title?.trim() || 'Untitled Project',
          description: 'A new DevDeck project',
          code,
          isPublic: false,
        });
      } else {
        // Update existing project
        await updateProjectMutation.mutateAsync({
          id: projectId,
          updates: { code, name: title?.trim() || project?.name || 'Untitled Project' },
        });
      }
      return true;
    } catch (error) {
      console.error('Error saving project:', error);
      return false;
    }
  };

  // Handle project deletion
  const handleDeleteProject = async () => {
    if (!projectId || projectId === 'new' || !window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }
    
    try {
      await projectsApi.delete(projectId);
      queryClient.invalidateQueries(['projects']);
      toast.success('Project deleted successfully');
      navigate('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error(error.message || 'Failed to delete project');
    }
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
          onToggleChat={() => setChatOpen((c) => !c)}
          surface={theme === 'dark' ? 'ide' : 'default'}
      >
        <CodePlayground
          initialCode={!projectId ? starterCode : (project?.code || '')}
          projectId={projectId || undefined}
          onSave={handleSave}
          chatOpen={chatOpen}
          onChatOpenChange={setChatOpen}
          surface={theme === 'dark' ? 'ide' : 'default'}
        />
      </EditorWorkspaceShell>
    </div>
  );
};

export default EditorPage;
