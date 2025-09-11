import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CodePlayground from '../components/editor/CodePlayground';
import { defaultExpressCode } from '../constants/boilerplate';
import { toast } from 'react-hot-toast';
import { LogLevels } from '../components/editor/OutputPanel';

const EditorPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinProject, leaveProject, onCodeUpdate, onExecutionLog } = useSocket();
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
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
    } else if (projectId === 'new') {
      setTitle('Untitled Project');
    }
  }, [project, projectId]);

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
    
    // Handle execution logs
    const cleanupLogs = onExecutionLog((log) => {
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          message: log,
          level: LogLevels.INFO,
          timestamp: new Date().toISOString(),
        },
      ]);
    });
    
    // Cleanup on unmount
    return () => {
      cleanupCodeUpdate();
      cleanupLogs();
      if (projectId && projectId !== 'new') {
        leaveProject(projectId);
      }
    };
  }, [projectId, project?.code, joinProject, leaveProject, onCodeUpdate, onExecutionLog, queryClient]);

  // Handle saving the project
  const handleSave = async (code) => {
    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  };

  // Handle code execution
  const handleRunCode = async (code) => {
    if (!projectId || projectId === 'new') return;
    
    setIsExecuting(true);
    try {
      // Save the code first
      const saved = await handleSave(code);
      if (!saved) {
        toast.error('Failed to save code before execution');
        return;
      }
      
      // Execute the code
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          message: '\n--- Starting execution ---\n',
          level: LogLevels.INFO,
          timestamp: new Date().toISOString(),
        },
      ]);
      
      // The actual execution will be handled by the CodePlayground component
      // which will use the executionApi to run the code
      
    } catch (error) {
      console.error('Error executing code:', error);
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          message: `Error: ${error.message}\n`,
          level: LogLevels.ERROR,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsExecuting(false);
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
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error.message || 'Failed to load project. Please try again.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex-1 min-w-0">
              <input
                className="w-full max-w-xl bg-transparent text-2xl font-bold text-gray-900 dark:text-white border-b border-transparent focus:border-indigo-500 focus:outline-none"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Project title"
              />
              {project && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {new Date(project.updatedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/projects')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Back to Projects
              </button>
              {projectId !== 'new' && (
                <button
                  onClick={handleDeleteProject}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Delete Project
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <CodePlayground
          initialCode={!projectId ? defaultExpressCode : (project?.code || '')}
          projectId={projectId || undefined}
          onSave={handleSave}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
            <div>
              {user ? (
                <span>Logged in as <span className="font-medium">{user.username}</span></span>
              ) : (
                <span>Not logged in</span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span>DevDeck v{import.meta.env.VITE_APP_VERSION || '1.0.0'}</span>
              <a 
                href="https://github.com/yourusername/devdeck" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
              >
                GitHub
              </a>
              <a 
                href="https://github.com/yourusername/devdeck/issues" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
              >
                Report an Issue
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EditorPage;
