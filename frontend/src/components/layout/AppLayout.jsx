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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
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

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname]);

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
    `group flex items-center rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
      active
        ? 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300 shadow-[0_0_15px_-3px_rgba(14,165,233,0.15)]'
        : 'border-transparent text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#1f1f23]/60 dark:hover:text-[#f4f4f5] hover:translate-x-0.5'
    }`;
  const navIconClasses = (active) =>
    `mr-3 h-5 w-5 transition-all duration-200 ${
      active
        ? 'text-sky-500 dark:text-sky-400 scale-105'
        : 'text-slate-400 group-hover:text-sky-600 dark:text-slate-500 dark:group-hover:text-sky-400 group-hover:scale-105'
    }`;
  const openProfileModal = () => {
    setProfileMenuOpen(false);
    setProfileModalOpen(true);
  };
  const closeProfileModal = () => setProfileModalOpen(false);

  return (
    <div
      className={`flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0b0f] dark:text-[#e4e4e7] ${isIdeWorkspace ? 'min-h-0' : ''}`}
    >
      {/* Mobile menu */}
      <div className={`md:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 flex z-40">
          <div className="fixed inset-0">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            ></div>
          </div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full border-r border-slate-200 bg-white dark:border-[#2b2b30]/60 dark:bg-[#111115]">
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
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-sm font-bold text-white shadow-lg shadow-sky-500/15">
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
            <div className="flex-shrink-0 flex border-t border-slate-200 p-4 dark:border-[#2b2b30]/60">
              <div className="flex items-center">
                <div>
                  <UserCircleIcon className="h-10 w-10 text-sky-400" />
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
        <div className="flex flex-col w-64 border-r border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-[#202024]/60 dark:bg-[#111115]/95 shadow-[1px_0_10px_-5px_rgba(0,0,0,0.1)]">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-sm font-bold text-white shadow-lg shadow-sky-500/15">
                DD
              </span>
              <div className="ml-3">
                <span className="block text-lg font-extrabold text-slate-950 dark:text-white tracking-tight">Dev Deck</span>
                <span className="block text-[10px] uppercase font-bold text-slate-400 dark:text-[#71717a] tracking-wider">Workspace Hub</span>
              </div>
            </div>
            <nav className="mt-8 flex-1 px-3 space-y-1.5">
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
            <div className="mx-3 rounded-xl border border-slate-200/50 bg-slate-50/50 p-4 shadow-sm dark:border-[#2b2b30]/60 dark:bg-[#141418] relative overflow-hidden group">
              <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-sky-500/5 blur-xl group-hover:bg-sky-500/10 transition-all duration-300" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-500 dark:text-sky-400">Workspace</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-[#858585]">
                Plan tasks, save snippets, test endpoints, and document APIs in one cohesive workspace.
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 flex border-t border-slate-200/80 p-4 dark:border-[#202024]/60 bg-slate-50/30 dark:bg-[#141418]/30">
              <div className="flex items-center">
                <div className="relative">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="avatar" className="h-10 w-10 rounded-full object-cover ring-2 ring-sky-500/20" onError={(e)=>{ e.currentTarget.style.display='none'; }} />
                  ) : (
                    <UserCircleIcon className="h-10 w-10 text-sky-400" />
                  )}
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-[#111115]" />
                </div>
              <div className="ml-3 min-w-0">
                <p className="text-sm font-semibold text-slate-950 dark:text-[#f4f4f5] truncate">
                  {user?.username || 'User'}
                </p>
                <p className="max-w-[140px] truncate text-xs text-slate-500 dark:text-[#858585]">
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
        <div className="relative z-10 flex h-16 shrink-0 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-[#202024]/60 dark:bg-[#111115]/80 shadow-[0_1px_8px_-4px_rgba(0,0,0,0.05)]">
          <button
            className="border-r border-slate-200 px-4 text-slate-500 hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 dark:border-[#2b2b30] dark:text-[#a1a1aa] dark:hover:bg-[#2d2d30] dark:hover:text-[#e4e4e7] md:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <ViewGridIcon className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex-1 px-6 flex justify-between">
            <div className="flex min-w-0 flex-1 items-center">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-500 dark:text-sky-400">Dev Deck</p>
                <h1 className="truncate text-base font-bold text-slate-950 dark:text-[#f4f4f5] tracking-tight">{pageTitle}</h1>
              </div>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2 text-slate-500 hover:border-sky-500/40 hover:bg-slate-50 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-[#2b2b30]/60 dark:bg-[#1a1a20]/60 dark:text-[#a1a1aa] dark:hover:border-sky-500/30 dark:hover:bg-[#202026] dark:hover:text-sky-300 transition-all duration-200 active:scale-95"
              >
                <span className="sr-only">Toggle theme</span>
                {theme === 'dark' ? (
                  <SunIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <MoonIcon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>

              {/* Notifications dropdown */}
              <div className="ml-3.5">
                <InvitationsDropdown />
              </div>

              {/* Profile dropdown */}
              <div className="ml-3.5 relative">
                <div className="relative">
                  <button
                    type="button"
                    className="flex max-w-xs items-center rounded-lg border border-slate-200 bg-slate-50/50 p-1.5 text-sm hover:border-sky-500/40 hover:bg-slate-100 dark:border-[#2b2b30]/60 dark:bg-[#1a1a20]/60 dark:hover:bg-[#202026] transition-all duration-200 active:scale-95"
                    id="user-menu"
                    aria-expanded={profileMenuOpen}
                    aria-haspopup="true"
                    onClick={() => setProfileMenuOpen((open) => !open)}
                  >
                    <span className="sr-only">Open user menu</span>
                    <UserCircleIcon className="h-6 w-6 text-sky-400" />
                  </button>
                </div>

                {/* Dropdown menu */}
                {profileMenuOpen && (
                  <div
                    className="absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-lg border border-slate-200/80 bg-white/95 backdrop-blur-md py-1.5 shadow-xl focus:outline-none dark:border-[#2b2b30]/80 dark:bg-[#181820]/95 animate-in fade-in slide-in-from-top-2 duration-150"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu"
                  >
                    <button
                      onClick={openProfileModal}
                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-[#d4d4d8] dark:hover:bg-[#2d2d30] dark:hover:text-white transition-colors duration-150"
                      role="menuitem"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-[#d4d4d8] dark:hover:bg-[#2d2d30] dark:hover:text-white transition-colors duration-150"
                      role="menuitem"
                    >
                      <div className="flex items-center">
                        <LogoutIcon className="h-4 w-4 mr-2" />
                        Sign out
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main
          className={`min-h-0 flex-1 focus:outline-none bg-slate-50 dark:bg-[#0b0b0f] ${
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

        {profileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all"
              onClick={closeProfileModal}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xl dark:border-[#2b2b30]/80 dark:bg-[#181820]/95 animate-in zoom-in-95 duration-200">
              <div className="border-b border-slate-200/80 px-6 py-4 dark:border-[#2b2b30]/80">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Edit Profile</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Keep your account details consistent across projects and collaboration spaces.
                </p>
              </div>
              <div className="px-6 py-5">
                <ProfileForm onClose={closeProfileModal} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppLayout;
