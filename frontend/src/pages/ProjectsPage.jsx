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
  ChevronDownIcon,
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
    <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0b0b0f] dark:text-slate-100 overflow-hidden">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-sky-500/[0.04] rounded-full blur-3xl pointer-events-none dark:bg-sky-500/[0.03]" />
      <div className="absolute top-40 right-1/4 w-[600px] h-[600px] bg-indigo-500/[0.04] rounded-full blur-3xl pointer-events-none dark:bg-indigo-500/[0.03]" />

      {/* Header */}
      <div className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md dark:border-[#202024]/60 dark:bg-[#111115]/80 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-500 dark:text-sky-400">Dev Deck Workspace</p>
              <h2 className="mt-1 text-3xl font-extrabold leading-8 text-slate-950 dark:text-white sm:text-4xl tracking-tight">
                Projects Dashboard
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Plan, code, test, document, and collaborate from one unified, high-fidelity developer cockpit.
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Link
                to="/projects/new"
                className="inline-flex items-center rounded-xl border border-transparent bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:from-sky-600 hover:to-indigo-600 transition-all duration-300 hover:shadow-sky-500/35 hover:-translate-y-0.5 active:translate-y-0"
              >
                <PlusIcon className="-ml-1 mr-2 h-5 w-5 stroke-[2.5]" aria-hidden="true" />
                New Project
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dashboardStats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.label}
                  className="relative overflow-hidden rounded-xl border border-slate-200/60 bg-white/60 p-5 dark:border-[#2b2b30]/60 dark:bg-[#15151c]/60 backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-md hover:border-sky-500/20 group"
                >
                  <div className="absolute -right-6 -bottom-6 h-16 w-16 rounded-full bg-sky-500/5 blur-lg group-hover:bg-sky-500/10 transition-all duration-300" />
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{stat.label}</p>
                    <span className="rounded-lg bg-sky-500/10 p-2 text-sky-500 dark:bg-sky-500/15">
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                  <p className="mt-3 text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">{stat.value}</p>
                </div>
              );
            })}
          </div>
          
          {/* Search bar */}
          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px_200px_200px]">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                className="block w-full rounded-xl border border-slate-200 bg-white/70 py-3.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-[#202024]/80 dark:bg-[#15151a]/85 dark:text-white dark:placeholder-slate-500 transition-all duration-200 shadow-sm"
                placeholder="Search projects by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="relative">
              <FunnelIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-455" />
              <select
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white/70 py-3.5 pl-9 pr-8 text-sm text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-[#202024]/80 dark:bg-[#15151a]/85 dark:text-slate-300 appearance-none shadow-sm cursor-pointer"
              >
                <option value="all">All Visibility</option>
                <option value="private">Private Only</option>
                <option value="public">Public Only</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDownIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="relative">
              <select
                value={activityFilter}
                onChange={(event) => setActivityFilter(event.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white/70 py-3.5 pl-4 pr-8 text-sm text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-[#202024]/80 dark:bg-[#15151a]/85 dark:text-slate-300 appearance-none shadow-sm cursor-pointer"
              >
                <option value="all">All Activity</option>
                <option value="recent">Updated This Week</option>
                <option value="openTasks">Has Open Tasks</option>
                <option value="snippets">Has Snippets</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDownIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white/70 py-3.5 pl-4 pr-8 text-sm text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-[#202024]/80 dark:bg-[#15151a]/85 dark:text-slate-300 appearance-none shadow-sm cursor-pointer"
              >
                <option value="updated">Sort: Recent</option>
                <option value="name">Sort: Name</option>
                <option value="created">Sort: Created</option>
                <option value="tasks">Sort: Open Tasks</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDownIcon className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <section className="mb-10">
          <div className="mb-5 flex flex-col gap-1">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">Start From A Template</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pick a starter template, and Dev Deck will initialize your editor with matching boilerplate instantly.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {templateList.map((template) => (
              <Link
                key={template.id}
                to={`/projects/new?template=${template.id}`}
                className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-sky-500/40 hover:shadow-md dark:border-[#2b2b30]/60 dark:bg-[#15151c]/50 backdrop-blur-sm overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/0 to-indigo-500/0 group-hover:from-sky-500/[0.02] group-hover:to-indigo-500/[0.02] transition-all duration-300 pointer-events-none" />
                <div className="relative z-10 flex items-center gap-3">
                  <span className="rounded-xl bg-sky-500/10 p-2.5 text-sky-500 group-hover:scale-110 transition-transform duration-300">
                    <CodeBracketSquareIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-950 dark:text-white truncate group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-colors duration-200">{template.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Starter template</p>
                  </div>
                </div>
                <p className="relative z-10 mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{template.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {pinnedProjects.length > 0 && (
          <section className="mb-10">
            <div className="mb-5">
              <h3 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">Pinned Workspaces</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Your quickest path back into active coding sessions.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {pinnedProjects.map((project) => {
                const stats = getProjectWorkflowStats(project);

                return (
                  <Link
                    key={project._id}
                    to={`/projects/${project._id}`}
                    className="relative group rounded-xl border border-sky-500/25 bg-sky-500/[0.02] p-5 text-sky-900 transition-all duration-300 hover:bg-sky-500/[0.06] hover:border-sky-500/50 hover:shadow-md dark:bg-sky-950/10 dark:text-sky-100 dark:hover:bg-sky-950/20"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/0 to-indigo-500/0 group-hover:from-sky-500/[0.02] transition-all duration-300" />
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-950 dark:text-white group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-colors duration-200">{project.name}</p>
                        <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">
                          {stats.openTasks} tasks · {stats.snippets} snippets
                        </p>
                      </div>
                      <StarIcon className="h-5 w-5 shrink-0 fill-amber-400 text-amber-500 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mb-10">
          <div className="mb-5 flex flex-col gap-1">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">Priority Framework Roadmap</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              DevDeck system milestones mapped out from foundational developer workflow steps to downstream integrations.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {devDeckPriorities.map((group) => (
              <article
                key={group.stage}
                className="relative overflow-hidden rounded-xl border border-slate-200 bg-white/60 p-5 shadow-sm dark:border-[#2b2b30]/60 dark:bg-[#15151c]/60 backdrop-blur-sm group transition-all duration-300 hover:border-sky-500/20"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">{group.stage}</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">{group.summary}</p>
                </div>
                <div className="space-y-4 mt-6">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.label} className="flex items-start gap-3">
                        <span className="mt-0.5 rounded-lg bg-sky-500/10 p-2 text-sky-500 dark:bg-sky-500/15">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-905 dark:text-slate-100">{item.label}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">{item.status}</p>
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
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-12 text-center dark:border-[#2b2b30] dark:bg-[#15151c]/60 backdrop-blur-sm">
            <svg
              className="mx-auto h-12 w-12 text-slate-405"
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
            <h3 className="mt-4 text-base font-bold text-slate-950 dark:text-white">No projects found</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {searchQuery
                ? 'No projects matching your search parameters.'
                : 'Get started by creating your very first project workspace.'}
            </p>
            <div className="mt-6">
              <Link
                to="/projects/new"
                className="inline-flex items-center rounded-xl border border-transparent bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:from-sky-600 hover:to-indigo-600 transition-all duration-300 hover:shadow-sky-500/35"
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
                  className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:border-sky-500/35 hover:-translate-y-0.5 dark:border-[#2b2b30]/60 dark:bg-[#15151c]/60 backdrop-blur-sm flex flex-col justify-between"
                >
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="truncate text-lg font-bold text-slate-950 dark:text-white leading-6 group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-colors duration-200">
                        {project.name}
                      </h3>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => togglePinnedProject(project._id)}
                          className={`rounded-lg p-1.5 transition ${
                            isPinned
                              ? 'text-amber-500 hover:bg-amber-500/10'
                              : 'text-slate-400 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-[#2d2d30] dark:text-slate-500'
                          }`}
                          title={isPinned ? 'Unpin project' : 'Pin project'}
                        >
                          <StarIcon className={`h-4.5 w-4.5 ${isPinned ? 'fill-amber-400 text-amber-500' : ''}`} />
                        </button>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          project.isPublic
                            ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-[#2c2c35] dark:text-slate-400'
                        }`}>
                          {project.isPublic ? <GlobeAltIcon className="mr-1 h-3.5 w-3.5" /> : <LockClosedIcon className="mr-1 h-3.5 w-3.5" />}
                          {project.isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                      {project.description || 'No description provided.'}
                    </p>
                    <div className="mt-5 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-505 font-semibold uppercase tracking-wider">
                      <CalendarDaysIcon className="h-4 w-4 text-sky-500" />
                      <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-[#0c0c0f]/50 border border-slate-100 dark:border-transparent">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tasks</p>
                        <p className="mt-1 text-base font-extrabold text-slate-950 dark:text-white">{workflow.openTasks}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-[#0c0c0f]/50 border border-slate-100 dark:border-transparent">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Snippets</p>
                        <p className="mt-1 text-base font-extrabold text-slate-955 dark:text-white">{workflow.snippets}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-[#0c0c0f]/50 border border-slate-100 dark:border-transparent">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Endpoints</p>
                        <p className="mt-1 text-base font-extrabold text-slate-955 dark:text-white">{workflow.endpoints}</p>
                      </div>
                    </div>

                    {workflow.totalTasks > 0 && (
                      <div className="mt-5">
                        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <span>Task Progress</span>
                          <span>{workflow.doneTasks}/{workflow.totalTasks}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#26262b]">
                          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-505 transition-all duration-300" style={{ width: `${workflow.progress}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200/60 dark:border-[#2b2b30]/60 px-6 py-4 bg-slate-50/50 dark:bg-[#15151c]/30 flex flex-wrap gap-2.5">
                    <Link
                      to={`/projects/${project._id}`}
                      className="inline-flex items-center rounded-lg border border-transparent bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-600 hover:bg-sky-500/15 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/25 transition-all duration-200 active:scale-95 animate-pulse-slow"
                    >
                      <PencilIcon className="-ml-0.5 mr-1.5 h-4 w-4" aria-hidden="true" />
                      Edit
                    </Link>
                    <Link
                      to={`/projects/${project._id}`}
                      className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-[#2b2b30]/60 dark:bg-[#202026] dark:text-slate-300 dark:hover:bg-[#282830] transition-all duration-200 active:scale-95 shadow-sm"
                    >
                      <EyeIcon className="-ml-0.5 mr-1.5 h-4 w-4" aria-hidden="true" />
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(project._id)}
                      className="ml-auto inline-flex items-center rounded-lg border border-transparent bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-500/15 dark:bg-rose-500/15 dark:text-rose-400 dark:hover:bg-rose-500/25 transition-all duration-200 active:scale-95"
                    >
                      <TrashIcon className="-ml-0.5 mr-1.5 h-4 w-4" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setShowDeleteModal(null)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-[#181820] rounded-2xl px-4 pt-5 pb-4 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 border border-slate-200/80 dark:border-[#2b2b30]/80 animate-in zoom-in-95 duration-200">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-rose-500/10 sm:mx-0 sm:h-10 sm:w-10">
                  <TrashIcon className="h-5 w-5 text-rose-500" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-bold text-slate-950 dark:text-white" id="modal-title">Delete project workspace</h3>
                  <div className="mt-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Are you sure you want to delete this project? All associated tasks, snippets, and workspaces will be permanently erased. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 sm:mt-5 sm:flex sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 transition-all duration-200 active:scale-95"
                  onClick={() => handleDeleteProject(showDeleteModal)}
                >
                  Delete Workspace
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-200 dark:border-[#2b2b30]/80 shadow-sm px-4 py-2 bg-white dark:bg-[#202026] text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#282830] transition-all duration-200 active:scale-95 sm:mt-0"
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
