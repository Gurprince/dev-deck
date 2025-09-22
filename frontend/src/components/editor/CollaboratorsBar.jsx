import React, { useState, useEffect, useRef } from 'react';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { useSocket } from '../../context/SocketContext';
import UserAvatar from '../common/UserAvatar';
import { projectsApi } from '../../services/api';
import { toast } from 'react-hot-toast';

// Function to generate consistent colors from strings
const stringToColor = (str) => {
  if (!str) return '#6366F1'; // Default indigo color
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    '#F87171', // red
    '#FB923C', // orange
    '#FBBF24', // amber
    '#34D399', // emerald
    '#60A5FA', // blue
    '#818CF8', // indigo
    '#A78BFA', // violet
    '#F472B6', // pink
  ];
  
  // Use the hash to pick a color
  return colors[Math.abs(hash) % colors.length];
};

const CollaboratorsBar = ({ projectId }) => {
  const { socket } = useSocket();
  const [collabs, setCollabs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [inviteRole, setInviteRole] = useState('editor');
  const popoverRef = useRef(null);

  const handleInvite = async (userOrEmail) => {
    if (!projectId || !socket) {
      console.error('Missing projectId or socket connection');
      return;
    }
    
    const email = userOrEmail.email || userOrEmail;
    if (!email) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    try {
      // Optimistically update the UI
      const tempId = `temp-${Date.now()}`;
      const newCollaborator = {
        _id: tempId,
        email: email.toLowerCase().trim(),
        name: email.split('@')[0],
        role: inviteRole,
        pending: true,
        isOptimistic: true
      };
      
      setCollabs(prev => [...prev, newCollaborator]);
      
      // Send the invitation
      console.log('Sending invitation to:', email);
      const response = await projectsApi.addCollaborator(projectId, {
        email: email.toLowerCase().trim(),
        role: inviteRole
      });
      
      console.log('Invitation response:', response);
      
      if (response.data?.success) {
        toast.success(`Invitation sent to ${email}`);
        
        // Update the collaborator list with the server response
        if (response.data.data?.collaborators) {
          setCollabs(response.data.data.collaborators);
        }
      } else {
        throw new Error(response.data?.message || 'Failed to send invitation');
      }
      
      // Reset form
      setInviteQuery('');
      setShowInvite(false);
      
    } catch (error) {
      console.error('Error sending invitation:', error);
      
      // Remove the optimistic update on error
      setCollabs(prev => prev.filter(c => !c.isOptimistic));
      
      // Show detailed error message
      const errorMessage = error.response?.data?.message || 
                         error.response?.data?.error || 
                         error.message || 
                         'Failed to send invitation';
      
      toast.error(`Error: ${errorMessage}`);
      
      // If there's a socket connection, request the latest collaborator list
      if (socket.connected) {
        console.log('Requesting updated collaborator list after error');
        socket.emit('get-collaborators', projectId);
      }
    }
  };

  useEffect(() => {
    if (!projectId) {
      console.log('No projectId provided');
      return;
    }
    
    if (!socket) {
      console.error('Socket not available');
      setHasError(false); // Don't show error, just show empty state
      setIsLoading(false);
      return;
    }
    
    console.log('Setting up collaborator listener for project:', projectId);
    setIsLoading(true);
    setHasError(false);
    
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Collaborator load timeout');
        setIsLoading(false);
        setCollabs([]); // Set empty array on timeout
        setHasError(false); // Don't show error
      }
    }, 10000);

    const onCollaboratorUpdate = (list) => {
      console.log('Received collaborator update:', list);
      clearTimeout(loadingTimeout);
      setCollabs(Array.isArray(list) ? list : []);
      setIsLoading(false);
      setHasError(false);
    };

    const onError = (error) => {
      console.error('Error loading collaborators:', error);
      clearTimeout(loadingTimeout);
      setIsLoading(false);
      setCollabs([]); // Set empty array on error
      setHasError(false); // Don't show error
    };

    const requestCollaborators = () => {
      if (!projectId) {
        console.error('No projectId available to request collaborators');
        return;
      }
      
      if (socket?.connected) {
        console.log('Requesting collaborators for project:', projectId);
        socket.emit('get-collaborators', projectId);
      } else {
        console.log('Socket not connected, waiting for connection...');
        const onConnect = () => {
          if (socket?.connected) {
            console.log('Socket connected, requesting collaborators for project:', projectId);
            socket.emit('get-collaborators', projectId);
          }
          socket.off('connect', onConnect);
        };
        socket.on('connect', onConnect);
      }
    };

    socket.on('collaborator-update', onCollaboratorUpdate);
    socket.on('collaborator-error', onError);

    socket.on('connect', () => {
      console.log('Socket connected, requesting collaborators');
      requestCollaborators();
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setHasError(false); // Don't show error on disconnect
    });

    requestCollaborators();

    return () => {
      clearTimeout(loadingTimeout);
      socket.off('collaborator-update', onCollaboratorUpdate);
      socket.off('collaborator-error', onError);
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [projectId, socket]);

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
    if (inviteQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const searchUsers = async () => {
      try {
        const response = await projectsApi.searchUsers(inviteQuery);
        if (response.data) {
          setSuggestions(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        setSuggestions([]);
      }
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [inviteQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-2 w-2 bg-gray-300 rounded-full animate-pulse"></div>
        <span className="text-sm text-gray-500">Loading collaborators...</span>
      </div>
    );
  }

  // We no longer show the error state, instead we'll show the empty state
  if (false) { // This condition ensures the error state is never shown
    return (
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="text-xs text-yellow-600 dark:text-yellow-400">
            Couldn't load collaborators
          </div>
          <button
            onClick={() => {
              console.log('Retry button clicked');
              setIsLoading(true);
              setHasError(false);
              if (socket?.connected) {
                console.log('Emitting get-collaborators with projectId:', projectId);
                socket.emit('get-collaborators', projectId);
              } else {
                console.error('Socket not connected when retrying');
              }
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Retry
          </button>
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('Add collaborator button clicked in error state');
              setShowInvite(prev => !prev);
            }}
            className="flex items-center px-3 py-1 text-sm font-medium rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            <UserPlusIcon className="w-4 h-4 mr-1" />
            Add collaborator
          </button>
          {showInvite && (
            <div 
              ref={popoverRef} 
              className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-10 border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Invite to project</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    placeholder="name@example.com"
                    value={inviteQuery}
                    onChange={(e) => setInviteQuery(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                
                {suggestions.length > 0 && (
                  <div className="border rounded-md divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-y-auto">
                    {suggestions.map((user) => (
                      <div key={user._id} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <UserAvatar user={{
                            name: user.name || user.email,
                            email: user.email,
                            avatarText: user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase(),
                            color: `hsl(${user._id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 360}, 70%, 60%)`
                          }} size="sm" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name || user.email}</div>
                            {user.name && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          onClick={() => handleInvite(user)}
                        >
                          Invite
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {inviteQuery && inviteQuery.length >= 2 && !suggestions.some(u => u.email === inviteQuery) && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <button
                      type="button"
                      className="w-full flex justify-between items-center p-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md"
                      onClick={() => handleInvite(inviteQuery)}
                    >
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 font-medium text-sm mr-2">
                          {inviteQuery.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Invite {inviteQuery}
                        </span>
                      </div>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400">Invite</span>
                    </button>
                  </div>
                )}

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    id="role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (collabs.length === 0) {
    console.log('Rendering no collaborators state, showInvite:', showInvite);
    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('Add collaborator button clicked');
            setShowInvite(prev => !prev);
          }}
          className="flex items-center px-3 py-1 text-sm font-medium rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
        >
          <UserPlusIcon className="w-4 h-4 mr-1" />
          Add collaborator
        </button>
        {showInvite && (
          <div 
            ref={popoverRef} 
            className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-10 border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Invite to project</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="name@example.com"
                  value={inviteQuery}
                  onChange={(e) => setInviteQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>
              
              {suggestions.length > 0 && (
                <div className="border rounded-md divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-y-auto">
                  {suggestions.map((user) => (
                    <div key={user._id} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <UserAvatar user={{
                          name: user.name || user.email,
                          email: user.email,
                          avatarText: user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase(),
                          color: `hsl(${user._id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 360}, 70%, 60%)`
                        }} size="sm" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name || user.email}</div>
                          {user.name && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={() => handleInvite(user)}
                      >
                        Invite
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {inviteQuery && inviteQuery.length >= 2 && !suggestions.some(u => u.email === inviteQuery) && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <button
                    type="button"
                    className="w-full flex justify-between items-center p-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md"
                    onClick={() => handleInvite(inviteQuery)}
                  >
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 font-medium text-sm mr-2">
                        {inviteQuery.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        Invite {inviteQuery}
                      </span>
                    </div>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400">Invite</span>
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  id="role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex items-center space-x-4">
      {/* Collaborators list - Notion/Google Docs style */}
      <div className="flex items-center -space-x-3">
        {collabs.map((collaborator) => (
          <div key={collaborator.userId || collaborator._id} className="relative group transition-transform hover:-translate-y-1 duration-200">
            <UserAvatar 
              user={{
                ...collaborator,
                avatarText: collaborator.name ? collaborator.name.charAt(0).toUpperCase() : collaborator.email.charAt(0).toUpperCase(),
                color: collaborator.color || stringToColor(collaborator.email || collaborator.name || 'Anonymous')
              }} 
              showTooltip={true}
            />
          </div>
        ))}
      </div>

      {/* Add collaborator button */}
      <div className="relative">
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="flex items-center px-3 py-1 text-sm font-medium rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
        >
          <UserPlusIcon className="w-4 h-4 mr-1" />
          Add more
        </button>
        
        {showInvite && (
          <div 
            ref={popoverRef}
            className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-10 border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Invite to project</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="name@example.com"
                  value={inviteQuery}
                  onChange={(e) => setInviteQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>
              
              {suggestions.length > 0 && (
                <div className="border rounded-md divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-y-auto">
                  {suggestions.map((user) => (
                    <div key={user._id} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <UserAvatar user={{
                          name: user.name || user.email,
                          email: user.email,
                          avatarText: user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase(),
                          color: `hsl(${user._id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 360}, 70%, 60%)`
                        }} size="sm" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name || user.email}</div>
                          {user.name && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={() => handleInvite(user)}
                      >
                        Invite
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {inviteQuery && inviteQuery.length >= 2 && !suggestions.some(u => u.email === inviteQuery) && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <button
                    type="button"
                    className="w-full flex justify-between items-center p-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md"
                    onClick={() => handleInvite(inviteQuery)}
                  >
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 font-medium text-sm mr-2">
                        {inviteQuery.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        Invite {inviteQuery}
                      </span>
                    </div>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400">Invite</span>
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  id="role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(CollaboratorsBar);