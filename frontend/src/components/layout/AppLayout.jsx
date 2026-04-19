import { Outlet, useLocation, useMatch } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  CodeBracketIcon as CodeIcon,
  RectangleStackIcon as CollectionIcon,
  ArrowLeftOnRectangleIcon as LogoutIcon,
  MoonIcon,
  SunIcon,
  UserCircleIcon,
  Squares2X2Icon as ViewGridIcon,
} from '@heroicons/react/24/outline';
import ProfileForm from './ProfileForm';
import InvitationsDropdown from '../notifications/InvitationsDropdown';

const AppLayout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  /** Full-bleed IDE layout (Cursor-style workspace) — not the projects list */
  const isIdeWorkspace = Boolean(useMatch({ path: '/projects/:projectId', end: true }));

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [navigate]);

  const navigation = [
    { name: 'Projects', href: '/projects', icon: CollectionIcon },
    { name: 'Editor', href: '/projects/new', icon: CodeIcon },
  ];
  const pageTitle = location.pathname.includes('/projects/new')
    ? 'New Project'
    : location.pathname.match(/^\/projects\/[^/]+$/)
      ? 'Editor'
      : 'Projects';
  const isActiveNav = (href) =>
    href === '/projects'
      ? location.pathname === '/projects'
      : location.pathname === href;
  const navClasses = (active) =>
    `group flex items-center rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? 'border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-200'
        : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-[#a1a1aa] dark:hover:bg-[#2d2d30] dark:hover:text-[#f4f4f5]'
    }`;
  const navIconClasses = (active) =>
    `mr-3 h-5 w-5 transition-colors ${active ? 'text-sky-300' : 'text-slate-400 group-hover:text-sky-600 dark:text-[#71717a] dark:group-hover:text-sky-300'}`;

  return (
    <div
      className={`flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#111113] dark:text-[#e4e4e7] ${isIdeWorkspace ? 'min-h-0' : ''}`}
    >
      {/* Mobile menu */}
      <div className={`md:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 flex z-40">
          <div className="fixed inset-0">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setMobileMenuOpen(false)}
            ></div>
          </div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full border-r border-slate-200 bg-white dark:border-[#2b2b30] dark:bg-[#18181b]">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <svg
                  className="h-6 w-6 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-500/15 text-sm font-bold text-sky-300 ring-1 ring-sky-500/30">
                  DD
                </span>
                <div className="ml-3">
                  <span className="block text-lg font-bold text-slate-950 dark:text-white">Dev Deck</span>
                  <span className="block text-xs text-slate-500 dark:text-[#858585]">Productivity hub</span>
                </div>
              </div>
              <nav className="mt-6 px-3 space-y-2">
                {navigation.map((item) => {
                  const active = isActiveNav(item.href);
                  return (
                    <Link key={item.name} to={item.href} className={navClasses(active)}>
                      <item.icon className={navIconClasses(active)} aria-hidden="true" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-slate-200 p-4 dark:border-[#2b2b30]">
              <div className="flex items-center">
                <div>
                  <UserCircleIcon className="h-10 w-10 text-sky-300" />
                </div>
                <div className="ml-3">
                  <p className="text-base font-medium text-slate-950 dark:text-[#f4f4f5]">
                    {user?.username || 'User'}
                  </p>
                  <p className="text-sm font-medium text-slate-500 dark:text-[#858585]">
                    {user?.email || 'user@example.com'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 w-14">
            {/* Force sidebar to shrink to fit close icon */}
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop (omitted in IDE workspace — editor has its own activity bar) */}
      {!isIdeWorkspace && (
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 border-r border-slate-200 bg-white dark:border-[#2b2b30] dark:bg-[#18181b]">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-500/15 text-sm font-bold text-sky-300 ring-1 ring-sky-500/30">
                DD
              </span>
              <div className="ml-3">
                <span className="block text-xl font-bold text-slate-950 dark:text-white">Dev Deck</span>
                <span className="block text-xs text-slate-500 dark:text-[#858585]">Developer workspace</span>
              </div>
            </div>
            <nav className="mt-6 flex-1 px-3 space-y-2">
              {navigation.map((item) => {
                const active = isActiveNav(item.href);
                return (
                  <Link key={item.name} to={item.href} className={navClasses(active)}>
                    <item.icon className={navIconClasses(active)} aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="mx-3 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-[#2b2b30] dark:bg-[#111113]">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Workspace</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-[#858585]">
                Plan tasks, save snippets, test endpoints, and document APIs in one flow.
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 flex border-t border-slate-200 p-4 dark:border-[#2b2b30]">
              <div className="flex items-center">
                <div>
                  {user?.avatar ? (
                    <img src={user.avatar} alt="avatar" className="h-10 w-10 rounded-full object-cover ring-1 ring-sky-500/30" onError={(e)=>{ e.currentTarget.style.display='none'; }} />
                  ) : (
                    <UserCircleIcon className="h-10 w-10 text-sky-300" />
                  )}
                </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-950 dark:text-[#f4f4f5]">
                  {user?.username || 'User'}
                </p>
                <p className="max-w-[160px] truncate text-xs font-medium text-slate-500 dark:text-[#858585]">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <div className="relative z-10 flex h-16 shrink-0 border-b border-slate-200 bg-white dark:border-[#2b2b30] dark:bg-[#18181b]">
          <button
            className="border-r border-slate-200 px-4 text-slate-500 hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 dark:border-[#2b2b30] dark:text-[#a1a1aa] dark:hover:bg-[#2d2d30] dark:hover:text-[#e4e4e7] md:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <ViewGridIcon className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex min-w-0 flex-1 items-center">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">Dev Deck</p>
                <h1 className="truncate text-sm font-semibold text-slate-950 dark:text-[#f4f4f5]">{pageTitle}</h1>
              </div>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:border-sky-500/40 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-[#2b2b30] dark:bg-[#111113] dark:text-[#a1a1aa] dark:hover:text-sky-300"
              >
                <span className="sr-only">Toggle theme</span>
                {theme === 'dark' ? (
                  <SunIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <MoonIcon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>

              {/* Notifications dropdown */}
              <div className="ml-3">
                <InvitationsDropdown />
              </div>

              {/* Profile dropdown */}
              <div className="ml-3 relative">
                <div className="relative">
                  <button
                    type="button"
                    className="flex max-w-xs items-center rounded-md border border-slate-200 bg-slate-50 p-1.5 text-sm hover:border-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-[#2b2b30] dark:bg-[#111113]"
                    id="user-menu"
                    aria-expanded="false"
                    aria-haspopup="true"
                    onClick={() => document.getElementById('profile-dropdown').classList.toggle('hidden')}
                  >
                    <span className="sr-only">Open user menu</span>
                    <UserCircleIcon className="h-7 w-7 text-sky-300" />
                  </button>
                </div>

                {/* Dropdown menu */}
                <div
                  id="profile-dropdown"
                  className="hidden absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md border border-slate-200 bg-white py-1 shadow-xl focus:outline-none dark:border-[#2b2b30] dark:bg-[#18181b]"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu"
                >
                  <button
                    onClick={() => document.getElementById('edit-profile-modal').showModal()}
                    className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-[#d4d4d8] dark:hover:bg-[#2d2d30] dark:hover:text-white"
                    role="menuitem"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-[#d4d4d8] dark:hover:bg-[#2d2d30] dark:hover:text-white"
                    role="menuitem"
                  >
                    <div className="flex items-center">
                      <LogoutIcon className="h-4 w-4 mr-2" />
                      Sign out
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main
          className={`min-h-0 flex-1 focus:outline-none bg-slate-50 dark:bg-[#111113] ${
            isIdeWorkspace
              ? 'flex flex-col overflow-hidden p-0'
              : 'relative overflow-y-auto'
          }`}
        >
          {isIdeWorkspace ? (
            <Outlet />
          ) : (
            <div className="py-6">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
                <Outlet />
              </div>
            </div>
          )}
        </main>

        {/* Edit Profile Modal */}
        <dialog id="edit-profile-modal" className="fixed inset-0 z-50">
          <div className="min-h-screen w-full flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border border-[#2b2b30] bg-[#18181b] shadow-lg transform transition-all">
              <div className="px-6 py-4 border-b border-[#2b2b30]">
                <h3 className="text-lg font-semibold text-white">Edit Profile</h3>
              </div>
              <div className="px-6 py-4">
                <ProfileForm onClose={() => document.getElementById('edit-profile-modal').close()} />
              </div>
              <div className="px-6 py-3 border-t border-[#2b2b30] flex justify-end">
                <button
                  type="button"
                  className="rounded-md border border-[#3c3c3c] bg-[#2d2d30] px-4 py-2 text-sm font-medium text-[#e4e4e7] hover:border-sky-500/40 hover:text-sky-300"
                  onClick={() => document.getElementById('edit-profile-modal').close()}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </dialog>
      </div>
    </div>
  );
};

export default AppLayout;
