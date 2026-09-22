import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useSocket } from '../../context/SocketContext';
import { projectsApi } from '../../services/api';
import UserAvatar from '../common/UserAvatar';

const stringToColor = (str) => {
  if (!str) return '#38bdf8';

  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = ['#f97316', '#f59e0b', '#22c55e', '#38bdf8', '#818cf8', '#e879f9'];
  return colors[Math.abs(hash) % colors.length];
};

const RoleSelect = ({ value, onChange }) => (
  <div>
    <label htmlFor="invite-role" className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
      Role
    </label>
    <select
      id="invite-role"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-500 dark:border-[#35353b] dark:bg-[#141418] dark:text-[#f4f4f5]"
    >
      <option value="editor">Editor</option>
      <option value="viewer">Viewer</option>
    </select>
  </div>
);

const InvitePopover = ({
  inviteQuery,
  inviteRole,
  onInviteQueryChange,
  onInviteRoleChange,
  onInvite,
  suggestions,
}) => {
  const hasDirectInvite =
    inviteQuery.length >= 2 && !suggestions.some((user) => user.email?.toLowerCase() === inviteQuery.toLowerCase());

  return (
    <div className="absolute right-0 top-full z-20 mt-3 w-[22rem] rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10 dark:border-[#2b2b30] dark:bg-[#18181b] dark:shadow-black/40">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-950 dark:text-[#f4f4f5]">Invite teammate</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-[#a1a1aa]">Bring collaborators into this project without leaving the editor.</p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="invite-email" className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            value={inviteQuery}
            onChange={(event) => onInviteQueryChange(event.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-500 dark:border-[#35353b] dark:bg-[#141418] dark:text-[#f4f4f5]"
            autoComplete="off"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 dark:border-[#2b2b30]">
            {suggestions.map((user) => (
              <button
                key={user._id}
                type="button"
                onClick={() => onInvite(user)}
                className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left transition hover:bg-slate-50 last:border-b-0 dark:border-[#25252a] dark:hover:bg-[#202026]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar
                    user={{
                      name: user.name || user.email,
                      email: user.email,
                      avatar: user.avatar,
                      color: stringToColor(user.email || user.name),
                    }}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-[#f4f4f5]">{user.name || user.email}</p>
                    {user.name ? (
                      <p className="truncate text-xs text-slate-500 dark:text-[#a1a1aa]">{user.email}</p>
                    ) : null}
                  </div>
                </div>
                <span className="rounded-md bg-sky-500/15 px-2 py-1 text-xs font-medium text-sky-700 dark:text-sky-300">Invite</span>
              </button>
            ))}
          </div>
        )}

        {hasDirectInvite ? (
          <button
            type="button"
            onClick={() => onInvite(inviteQuery)}
            className="flex w-full items-center justify-between rounded-md border border-dashed border-sky-300 bg-sky-50 px-3 py-2 text-left transition hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-500/10 dark:hover:bg-sky-500/15"
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-[#f4f4f5]">Invite {inviteQuery}</p>
              <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">Send an email invitation directly.</p>
            </div>
            <span className="rounded-md bg-white/80 px-2 py-1 text-xs font-medium text-sky-700 dark:bg-[#0f172a] dark:text-sky-300">Send</span>
          </button>
        ) : null}

        <RoleSelect value={inviteRole} onChange={onInviteRoleChange} />
      </div>
    </div>
  );
};

const CollaboratorsBar = ({ projectId }) => {
  const { socket } = useSocket();
  const [collaborators, setCollaborators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [suggestions, setSuggestions] = useState([]);
  const popoverRef = useRef(null);

  const inviteButtonLabel = useMemo(
    () => (collaborators.length > 0 ? 'Invite' : 'Add teammate'),
    [collaborators.length]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowInvite(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!projectId || !socket) {
      setCollaborators([]);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);

    const finishLoading = (list) => {
      setCollaborators(Array.isArray(list) ? list : []);
      setIsLoading(false);
    };

    const handleCollaborators = (list) => finishLoading(list);
    const handleError = (error) => {
      setIsLoading(false);
      toast.error(error?.message || 'Could not load collaborators');
    };

    const requestCollaborators = () => {
      socket.emit('get-collaborators', projectId);
    };

    socket.on('collaborator-update', handleCollaborators);
    socket.on('collaborator-error', handleError);

    if (socket.connected) {
      requestCollaborators();
    } else {
      socket.once('connect', requestCollaborators);
    }

    const timeoutId = window.setTimeout(() => {
      setIsLoading(false);
    }, 12000);

    return () => {
      window.clearTimeout(timeoutId);
      socket.off('collaborator-update', handleCollaborators);
      socket.off('collaborator-error', handleError);
      socket.off('connect', requestCollaborators);
    };
  }, [projectId, socket]);

  useEffect(() => {
    if (inviteQuery.trim().length < 2) {
      setSuggestions([]);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await projectsApi.searchUsers(inviteQuery.trim());
        setSuggestions(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error searching users:', error);
        setSuggestions([]);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [inviteQuery]);

  const handleInvite = async (userOrEmail) => {
    if (!projectId) {
      toast.error('Save the project before inviting teammates');
      return;
    }

    const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email;
    if (!email) {
      toast.error('Enter a valid email address');
      return;
    }

    try {
      const response = await projectsApi.addCollaborator(projectId, {
        email: email.trim().toLowerCase(),
        role: inviteRole,
      });

      const nextCollaborators = response.data?.data?.collaborators;
      if (Array.isArray(nextCollaborators)) {
        setCollaborators(nextCollaborators);
      }

      toast.success(`Invitation sent to ${email}`);
      setInviteQuery('');
      setSuggestions([]);
      setShowInvite(false);
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to send invitation');
    }
  };

  const normalizedCollaborators = useMemo(
    () =>
      (Array.isArray(collaborators) ? collaborators : []).map((collaborator) => {
        const name =
          collaborator?.name ||
          collaborator?.username ||
          collaborator?.email?.split('@')[0] ||
          'Anonymous';
        const email = collaborator?.email || `${name}@example.com`;

        return {
          id: collaborator?.userId || collaborator?._id || collaborator?.id || email,
          name,
          email,
          avatar: collaborator?.avatar,
          role: collaborator?.role,
          status: collaborator?.status || 'online',
          color: collaborator?.color || stringToColor(email || name),
        };
      }),
    [collaborators]
  );

  return (
    <div ref={popoverRef} className="relative flex items-center gap-3">
      <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 dark:border-[#2b2b30] dark:bg-[#141418] dark:text-[#a1a1aa] md:flex">
        <span className={`h-2 w-2 rounded-full ${socket?.connected ? 'bg-emerald-400' : 'bg-amber-400'}`} aria-hidden />
        {socket?.connected ? 'Team live' : 'Reconnecting'}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#a1a1aa]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" aria-hidden />
          Loading teammates...
        </div>
      ) : (
        <>
          <div className="flex items-center -space-x-2">
            {normalizedCollaborators.slice(0, 5).map((collaborator) => (
              <div key={collaborator.id} className="transition-transform hover:-translate-y-0.5">
                <UserAvatar user={collaborator} size="sm" showTooltip />
              </div>
            ))}

            {normalizedCollaborators.length > 5 ? (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white bg-slate-100 text-[11px] font-semibold text-slate-700 dark:border-[#18181b] dark:bg-[#23232a] dark:text-[#d4d4d8]">
                +{normalizedCollaborators.length - 5}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setShowInvite((current) => !current)}
            className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-500/15 dark:text-sky-300"
          >
            <UserPlusIcon className="mr-1.5 h-4 w-4" />
            {inviteButtonLabel}
          </button>
        </>
      )}

      {showInvite ? (
        <InvitePopover
          inviteQuery={inviteQuery}
          inviteRole={inviteRole}
          onInviteQueryChange={setInviteQuery}
          onInviteRoleChange={setInviteRole}
          onInvite={handleInvite}
          suggestions={suggestions}
        />
      ) : null}
    </div>
  );
};

export default React.memo(CollaboratorsBar);
