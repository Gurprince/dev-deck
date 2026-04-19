import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../services/api';
import { toast } from 'react-hot-toast';
import {
  BellAlertIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  CodeBracketSquareIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  GlobeAltIcon,
  LockClosedIcon,
  MagnifyingGlassIcon as SearchIcon,
  PlusIcon,
  PuzzlePieceIcon,
  ShieldCheckIcon,
  TrashIcon,
  PencilIcon,
  EyeIcon,
  FunnelIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { projectTemplates } from '../constants/boilerplate';

const devDeckPriorities = [
  {
    stage: 'P0 - Core workflow',
    summary: 'Keep planning, coding, testing, snippets, and docs in one project workspace.',
    items: [
      { label: 'Task board', status: 'Implemented in editor', icon: ClipboardDocumentListIcon },
      { label: 'Snippet vault', status: 'Implemented in editor', icon: CodeBracketSquareIcon },
      { label: 'Generated API docs', status: 'Available after route scan', icon: DocumentTextIcon },
    ],
  },
  {
    stage: 'P1 - Collaboration',
    summary: 'Make team work visible and controlled through roles, invites, comments, and presence.',
    items: [
      { label: 'Project collaborators', status: 'Invite flow available', icon: ShieldCheckIcon },
      { label: 'Team chat', status: 'Available in editor', icon: BellAlertIcon },
      { label: 'Role-based access', status: 'Needs backend enforcement pass', icon: ShieldCheckIcon },
    ],
  },
  {
    stage: 'P2 - Automation',
    summary: 'Reduce tool switching with notifications, external integrations, and project automation.',
    items: [
      { label: 'Notifications', status: 'Invitations available', icon: BellAlertIcon },
      { label: 'External integrations', status: 'Next milestone', icon: PuzzlePieceIcon },
      { label: 'Custom dashboard widgets', status: 'Next milestone', icon: ClipboardDocumentListIcon },
    ],
  },
];

const ProjectsPage = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
  const [pinnedProjectIds, setPinnedProjectIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('devdeck:pinned-projects') || '[]');
    } catch {
      return [];
    }
  });

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      try {
        const response = await projectsApi.getAll();
        return response.data || [];
      } catch (err) {
        console.error('Error fetching projects:', err);
        throw new Error(err.response?.data?.message || 'Failed to load projects');
      }
    },
    onError: (error) => {
      console.error('Projects query error:', error);
      toast.error(error.message || 'Failed to load projects');
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId) => (await projectsApi.delete(projectId)).data,
    onSuccess: () => {
      queryClient.invalidateQueries(['projects']);
      toast.success('Project deleted successfully');
      setShowDeleteModal(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete project');
    },
  });

  useEffect(() => {
    localStorage.setItem('devdeck:pinned-projects', JSON.stringify(pinnedProjectIds));
  }, [pinnedProjectIds]);

  const getProjectWorkflowStats = (project) => {
    const tasks = Array.isArray(project.tasks) ? project.tasks : [];
    const snippets = Array.isArray(project.snippets) ? project.snippets : [];
    const endpoints = Array.isArray(project.endpoints) ? project.endpoints : [];
    const doneTasks = tasks.filter((task) => task.status === 'done').length;

    return {
      openTasks: tasks.filter((task) => task.status !== 'done').length,
      doneTasks,
      totalTasks: tasks.length,
      snippets: snippets.length,
      endpoints: endpoints.length,
      progress: tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0,
    };
  };

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return projects
      .filter((project) => {
        const matchesQuery =
          !query ||
          project.name.toLowerCase().includes(query) ||
          project.description?.toLowerCase().includes(query);
        const matchesVisibility =
          visibilityFilter === 'all' ||
          (visibilityFilter === 'public' && project.isPublic) ||
          (visibilityFilter === 'private' && !project.isPublic);
        const stats = getProjectWorkflowStats(project);
        const matchesActivity =
          activityFilter === 'all' ||
          (activityFilter === 'openTasks' && stats.openTasks > 0) ||
          (activityFilter === 'snippets' && stats.snippets > 0) ||
          (activityFilter === 'recent' &&
            project.updatedAt &&
            Date.now() - new Date(project.updatedAt).getTime() < 7 * 24 * 60 * 60 * 1000);

        return matchesQuery && matchesVisibility && matchesActivity;
      })
      .sort((a, b) => {
        const aPinned = pinnedProjectIds.includes(a._id) ? 1 : 0;
        const bPinned = pinnedProjectIds.includes(b._id) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;

        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'created') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        if (sortBy === 'tasks') return getProjectWorkflowStats(b).openTasks - getProjectWorkflowStats(a).openTasks;
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      });
  }, [activityFilter, pinnedProjectIds, projects, searchQuery, sortBy, visibilityFilter]);
  const publicProjects = projects.filter((project) => project.isPublic).length;
  const privateProjects = projects.length - publicProjects;
  const recentlyUpdated = projects.filter((project) => {
    if (!project.updatedAt) return false;
    const updatedAt = new Date(project.updatedAt).getTime();
    return Date.now() - updatedAt < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const dashboardStats = [
    { label: 'Total projects', value: projects.length, icon: FolderOpenIcon },
    { label: 'Updated this week', value: recentlyUpdated, icon: CalendarDaysIcon },
    { label: 'Private', value: privateProjects, icon: LockClosedIcon },
    { label: 'Public', value: publicProjects, icon: GlobeAltIcon },
  ];
  const pinnedProjects = projects.filter((project) => pinnedProjectIds.includes(project._id));
  const templateList = Object.values(projectTemplates);

  // Handle project deletion
  const handleDeleteProject = (projectId) => {
    deleteProjectMutation.mutate(projectId);
  };

  const togglePinnedProject = (projectId) => {
    setPinnedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [projectId, ...current].slice(0, 8)
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#111113] dark:text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white dark:border-[#2b2b30] dark:bg-[#18181b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="md:flex md:items-start md:justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">Dev Deck Workspace</p>
              <h2 className="mt-1 text-3xl font-bold leading-8 text-slate-950 dark:text-white sm:text-4xl sm:truncate">
                Projects
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                Plan, code, test, document, and collaborate from one focused developer workspace.
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Link
                to="/projects/new"
                className="inline-flex items-center rounded-md border border-transparent bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              >
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                New Project
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {dashboardStats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.label}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#2b2b30] dark:bg-[#1f1f23]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
                    <Icon className="h-5 w-5 text-sky-500" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{stat.value}</p>
                </div>
              );
            })}
          </div>
          
          {/* Search bar */}
          <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                className="block w-full rounded-md border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm leading-5 text-slate-900 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-[#3c3c3c] dark:bg-[#111113] dark:text-white dark:placeholder-slate-500"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <label className="relative">
              <FunnelIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-[#3c3c3c] dark:bg-[#111113] dark:text-white"
              >
                <option value="all">All visibility</option>
                <option value="private">Private only</option>
                <option value="public">Public only</option>
              </select>
            </label>
            <label>
              <select
                value={activityFilter}
                onChange={(event) => setActivityFilter(event.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-[#3c3c3c] dark:bg-[#111113] dark:text-white"
              >
                <option value="all">All activity</option>
                <option value="recent">Updated this week</option>
                <option value="openTasks">Has open tasks</option>
                <option value="snippets">Has snippets</option>
              </select>
            </label>
            <label>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-[#3c3c3c] dark:bg-[#111113] dark:text-white"
              >
                <option value="updated">Sort: Recent</option>
                <option value="name">Sort: Name</option>
                <option value="created">Sort: Created</option>
                <option value="tasks">Sort: Open tasks</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <section className="mb-8">
          <div className="mb-4 flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Start From A Template</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pick a starter and Dev Deck will open the editor with matching boilerplate.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {templateList.map((template) => (
              <Link
                key={template.id}
                to={`/projects/new?template=${template.id}`}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-500/50 hover:shadow-md dark:border-[#2b2b30] dark:bg-[#18181b]"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-sky-50 p-2 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
                    <CodeBracketSquareIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950 dark:text-white">{template.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Use template</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{template.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {pinnedProjects.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Pinned Projects</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Your fastest path back into active work.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {pinnedProjects.map((project) => {
                const stats = getProjectWorkflowStats(project);

                return (
                  <Link
                    key={project._id}
                    to={`/projects/${project._id}`}
                    className="rounded-lg border border-sky-500/30 bg-sky-50 p-4 text-sky-900 transition hover:bg-sky-100 dark:bg-sky-950/20 dark:text-sky-100 dark:hover:bg-sky-950/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{project.name}</p>
                        <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">
                          {stats.openTasks} open tasks - {stats.snippets} snippets
                        </p>
                      </div>
                      <StarIcon className="h-5 w-5 shrink-0 fill-sky-400 text-sky-500" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mb-8">
          <div className="mb-4 flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dev Deck Implementation Priority</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ordered from the most important developer workflow pieces to the platform features that can follow.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {devDeckPriorities.map((group) => (
              <article
                key={group.stage}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2b2b30] dark:bg-[#18181b]"
              >
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">{group.stage}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{group.summary}</p>
                </div>
                <div className="space-y-3">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.label} className="flex items-start gap-3">
                        <span className="mt-0.5 rounded-md bg-sky-50 p-2 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-950 dark:text-white">{item.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{item.status}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>

        {filteredProjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center dark:border-[#3c3c3c] dark:bg-[#18181b]">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-950 dark:text-white">No projects</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {searchQuery
                ? 'No projects match your search.'
                : 'Get started by creating a new project.'}
            </p>
            <div className="mt-6">
              <Link
                to="/projects/new"
                className="inline-flex items-center rounded-md border border-transparent bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              >
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                New Project
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              const workflow = getProjectWorkflowStats(project);
              const isPinned = pinnedProjectIds.includes(project._id);

              return (
                <article
                  key={project._id}
                  className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-[#2b2b30] dark:bg-[#18181b]"
                >
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="truncate text-lg font-semibold leading-6 text-slate-950 dark:text-white">
                      {project.name}
                    </h3>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePinnedProject(project._id)}
                        className={`rounded-md p-1.5 transition ${
                          isPinned
                            ? 'text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/30'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-[#2d2d30]'
                        }`}
                        title={isPinned ? 'Unpin project' : 'Pin project'}
                      >
                        <StarIcon className={`h-5 w-5 ${isPinned ? 'fill-sky-400' : ''}`} />
                      </button>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        project.isPublic
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-[#2d2d30] dark:text-slate-300'
                      }`}>
                        {project.isPublic ? <GlobeAltIcon className="mr-1 h-3.5 w-3.5" /> : <LockClosedIcon className="mr-1 h-3.5 w-3.5" />}
                        {project.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-500 dark:text-slate-400">
                    {project.description || 'No description'}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <CalendarDaysIcon className="h-4 w-4 text-sky-500" />
                    <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-md bg-slate-50 p-2 dark:bg-[#111113]">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Open tasks</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{workflow.openTasks}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2 dark:bg-[#111113]">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Snippets</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{workflow.snippets}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2 dark:bg-[#111113]">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Endpoints</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{workflow.endpoints}</p>
                    </div>
                  </div>
                  {workflow.totalTasks > 0 && (
                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Task progress</span>
                        <span>{workflow.doneTasks}/{workflow.totalTasks}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-[#2d2d30]">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${workflow.progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-200 px-4 py-4 dark:border-[#2b2b30] sm:px-6">
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to={`/projects/${project._id}`}
                      className="inline-flex items-center rounded-md border border-transparent bg-sky-100 px-3 py-2 text-sm font-medium leading-4 text-sky-700 hover:bg-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-900"
                    >
                      <PencilIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                      Edit
                    </Link>
                    <Link
                      to={`/projects/${project._id}`}
                      className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:border-[#3c3c3c] dark:bg-[#1f1f23] dark:text-slate-200 dark:hover:bg-[#2d2d30]"
                    >
                      <EyeIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(project._id)}
                      className="ml-auto inline-flex items-center rounded-md border border-transparent bg-red-100 px-3 py-2 text-sm font-medium leading-4 text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-900"
                    >
                      <TrashIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowDeleteModal(null)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">Delete project</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Are you sure you want to delete this project? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => handleDeleteProject(showDeleteModal)}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => setShowDeleteModal(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
