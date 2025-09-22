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
      
      const response = await invitationsApi.respondToInvitation(projectId, invitationId, action);
      
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
        className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none"
      >
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {hasInvitations && (
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="p-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-medium text-gray-900">Invitations</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mt-2 max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="py-4 text-center text-gray-500">Loading...</div>
              ) : hasInvitations ? (
                <ul className="divide-y divide-gray-200">
                  {invitations.map((invitation) => (
                    <li key={invitation._id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {invitation.project.name}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            Invited as {invitation.role}
                          </p>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex space-x-2">
                          <button
                            onClick={() => handleRespond(invitation.project._id, invitation._id, 'accept')}
                            className="p-1 rounded-full text-green-600 hover:bg-green-50"
                            title="Accept"
                          >
                            <CheckIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleRespond(invitation.project._id, invitation._id, 'decline')}
                            className="p-1 rounded-full text-red-600 hover:bg-red-50"
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
                <div className="py-4 text-center text-gray-500">
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
