import React, { useState, useEffect } from 'react';
import { BellIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { invitationsApi } from '../../services/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

const InvitationsDropdown = () => {
  const [invitations, setInvitations] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        const response = await invitationsApi.getMyInvitations();
        setInvitations(response.data || []);
      } catch (error) {
        console.error('Error fetching invitations:', error);
        toast.error('Failed to load invitations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvitations();
    // Refresh more frequently (every 5 seconds) to show new invitations quickly
    const interval = setInterval(fetchInvitations, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Refresh invitations when the dropdown is opened
  useEffect(() => {
    if (isOpen) {
      const fetchInvitations = async () => {
        try {
          const response = await invitationsApi.getMyInvitations();
          setInvitations(response.data || []);
        } catch (error) {
          console.error('Error fetching invitations:', error);
        }
      };
      
      fetchInvitations();
    }
  }, [isOpen]);

  const handleRespond = async (projectId, invitationId, action) => {
    try {
      // Log the invitation being responded to
      const invitation = invitations.find(inv => inv._id === invitationId);
      console.log('Responding to invitation:', {
        action,
        projectId,
        invitationId,
        invitation,
        currentInvitations: invitations
      });
      
      await invitationsApi.respondToInvitation(projectId, invitationId, action);
      
      if (action === 'accept') {
        // Refresh the projects list to show the newly accepted project
        await queryClient.invalidateQueries(['projects']);
        
        toast.success('Invitation accepted!');
        // Redirect to the project
        navigate(`/projects/${projectId}`);
      } else {
        toast.success('Invitation declined');
      }
      
      // Remove the invitation from the list
      setInvitations(prev => prev.filter(inv => inv._id !== invitationId));
    } catch (error) {
      console.error('Error responding to invitation:', {
        error,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      toast.error(`Failed to ${action} invitation: ${error.response?.data?.message || error.message}`);
    }
  };

  const hasInvitations = invitations.length > 0;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:border-sky-500/40 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-[#2b2b30] dark:bg-[#111113] dark:text-[#a1a1aa] dark:hover:text-sky-300"
      >
        <BellIcon className="h-5 w-5" aria-hidden="true" />
        {hasInvitations && (
          <span className="absolute right-1 top-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-slate-50 dark:ring-[#111113]"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-md border border-slate-200 bg-white shadow-xl focus:outline-none dark:border-[#2b2b30] dark:bg-[#18181b]">
          <div className="p-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-[#2b2b30]">
              <div>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">Invitations</h3>
                <p className="text-xs text-slate-500 dark:text-[#858585]">Project collaboration requests</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-[#858585] dark:hover:bg-[#2d2d30] dark:hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mt-2 max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="py-4 text-center text-slate-500 dark:text-[#858585]">Loading...</div>
              ) : hasInvitations ? (
                <ul className="divide-y divide-slate-200 dark:divide-[#2b2b30]">
                  {invitations.map((invitation) => (
                    <li key={invitation._id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-950 dark:text-[#f4f4f5] truncate">
                            {invitation.project.name}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-[#858585] truncate">
                            Invited as {invitation.role}
                          </p>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex space-x-2">
                          <button
                            onClick={() => handleRespond(invitation.project._id, invitation._id, 'accept')}
                            className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-1 text-emerald-300 hover:bg-emerald-500/20"
                            title="Accept"
                          >
                            <CheckIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleRespond(invitation.project._id, invitation._id, 'decline')}
                            className="rounded-md border border-red-500/30 bg-red-500/10 p-1 text-red-300 hover:bg-red-500/20"
                            title="Decline"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-4 text-center text-slate-500 dark:text-[#858585]">
                  No pending invitations
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvitationsDropdown;
