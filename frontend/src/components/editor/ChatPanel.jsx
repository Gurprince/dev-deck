import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import UserAvatar from '../common/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';

const ChatPanel = ({ projectId, isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { socket } = useSocket();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  // Ensure the API base URL ends with /api
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const apiBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;

  // Get auth token from localStorage
  const getAuthToken = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Authentication required. Please log in again.');
      return null;
    }
    return token;
  };

  // Fetch chat history
  const fetchChatHistory = useCallback(async () => {
    if (!projectId) return;
    
    const token = getAuthToken();
    if (!token) return;
    
    try {
      // Ensure projectId is a string
      const projectIdStr = String(projectId);
      
      const response = await fetch(`${apiBase}/sse/chat/${projectIdStr}?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to load chat history');
      }
      
      const data = await response.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      toast.error(error.message || 'Failed to load chat history');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, apiBase]);

  useEffect(() => {
    if (isOpen) {
      fetchChatHistory();
    }
  }, [fetchChatHistory, isOpen]);

  // Handle incoming real-time messages and project joining
  useEffect(() => {
    if (!socket || !projectId) return;

    // Ensure projectId is a valid string
    const projectIdStr = String(projectId);
    
    // Join the project room with user information
    const joinProject = () => {
      console.log('Joining project room:', projectIdStr);
      socket.emit('joinProject', { 
        projectId: projectIdStr,
        userId: user?.id,
        username: user?.name || user?.email || 'Anonymous',
        email: user?.email || ''
      });
    };

    const handleNewMessage = (incomingMessage) => {
      console.log('New message received:', incomingMessage);
      console.log('Current user ID:', user?.id);
      
      // Ensure the message is for the current project
      const messageProjectId = incomingMessage.project || incomingMessage.projectId;
      if (messageProjectId !== projectIdStr) {
        console.log('Message for different project, ignoring:', messageProjectId, '!=', projectIdStr);
        return;
      }
      
      // Create a normalized message with consistent structure
      const normalizedMessage = {
        ...incomingMessage,
        // Always use the most complete sender information available
        sender: {
          // Prefer the nested sender object if available
          ...(typeof incomingMessage.sender === 'object' && incomingMessage.sender !== null ? incomingMessage.sender : {}),
          // Fall back to top-level fields if needed
          _id: incomingMessage.sender?._id || incomingMessage.senderId || incomingMessage.sender?._id || 'unknown',
          name: incomingMessage.sender?.name || incomingMessage.senderName || 'User',
          email: incomingMessage.sender?.email || incomingMessage.senderEmail || '',
          username: incomingMessage.sender?.username || ''
        },
        _id: incomingMessage._id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: incomingMessage.createdAt || new Date().toISOString()
      };
      
      console.log('Processing message:', {
        rawMessage: incomingMessage,
        normalizedMessage,
        currentUser: user?.id,
        isFromCurrentUser: normalizedMessage.sender?._id?.toString() === user?.id?.toString()
      });
      
      setMessages(prev => {
        // Check if message already exists to prevent duplicates
        const exists = prev.some(m => {
          const sameId = m._id === normalizedMessage._id;
          const sameContent = m.text === normalizedMessage.text && 
                            m.sender?._id === normalizedMessage.sender?._id &&
                            Math.abs(new Date(m.createdAt) - new Date(normalizedMessage.createdAt)) < 5000;
          return sameId || sameContent;
        });
        
        if (exists) {
          console.log('Duplicate message detected, skipping');
          return prev;
        }
        
        // Replace any temporary messages with the same content from the same user
        const updatedMessages = prev.filter(m => 
          !(m.isSending && 
            m.text === normalizedMessage.text && 
            m.sender?._id === normalizedMessage.sender?._id)
        );
        
        return [...updatedMessages, normalizedMessage];
      });
    };
    
    // Set up socket event listeners
    socket.on('connect', joinProject);
    socket.on('chatMessage', handleNewMessage);
    
    // Initial join
    joinProject();
    
    // Clean up event listeners
    return () => {
      socket.off('connect', joinProject);
      socket.off('chatMessage', handleNewMessage);
      
      // Leave the room when component unmounts
      if (socket.connected) {
        socket.emit('leaveProject', { projectId: projectIdStr, userId: user?.id });
      }
    };
  }, [socket, projectId, user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !projectId) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      // Ensure projectId is a string
      const projectIdStr = String(projectId);
      
      // Create a temporary message for immediate UI feedback
      const tempMessage = {
        _id: `temp-${Date.now()}`,
        text: newMessage,
        project: projectIdStr,
        sender: {
          _id: user?.id,
          name: user?.name || user?.username || 'You',
          email: user?.email || ''
        },
        createdAt: new Date().toISOString(),
        isSending: true
      };
      
      // Add the temporary message to the UI immediately
      setMessages(prev => [...prev, tempMessage]);
      
      // Scroll to the bottom to show the new message
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      
      // Send the message to the server
      const response = await fetch(`${apiBase}/sse/chat/${projectIdStr}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ 
          text: newMessage,
          project: projectIdStr, // Ensure project ID is included in the body
          sender: {
            _id: user?.id,
            name: user?.name || user?.username,
            email: user?.email
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to send message');
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-4 right-4 w-80 bg-white rounded-lg shadow-xl flex flex-col ${isOpen ? 'h-96' : 'h-12'} transition-all duration-300 ease-in-out overflow-hidden z-50`}>
      <div 
        className="bg-blue-600 text-white p-3 flex justify-between items-center cursor-pointer"
        onClick={() => isOpen ? onClose() : (onClose && onClose())}
      >
        <div className="flex items-center">
          <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
          <span>Project Chat</span>
        </div>
        {isOpen ? (
          <XMarkIcon 
            className="h-5 w-5 hover:bg-blue-700 rounded p-0.5" 
            onClick={(e) => {
              e.stopPropagation();
              onClose && onClose();
            }} 
          />
        ) : (
          <div className="w-5 h-5 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <span className="text-xs text-black">{messages.length > 0 ? messages.length : ''}</span>
          </div>
        )}
      </div>
      
      {isOpen && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">
                No messages yet. Say hello! 👋
              </div>
            ) : (
              messages.map((message) => {
                // Helper function to extract sender information
                const getSenderInfo = (msg, currentUserId) => {
                  console.log('getSenderInfo - Message:', JSON.stringify(msg, null, 2));
                  console.log('getSenderInfo - Current User ID:', currentUserId);
                  
                  // First, determine if this is the current user's message
                  const isCurrentUser = (
                    (msg.sender?._id && msg.sender._id === currentUserId) || 
                    (msg.senderId && msg.senderId === currentUserId) ||
                    (msg.sender?._id === currentUserId) ||
                    (msg.senderId === currentUserId)
                  );
                  
                  // Start with default values
                  const sender = {
                    _id: msg.sender?._id || msg.senderId || 'unknown',
                    name: 'User', // Default name
                    email: msg.sender?.email || msg.senderEmail || '',
                    username: msg.sender?.username || '',
                    isCurrentUser: isCurrentUser
                  };

                  // If this is the current user, set name to 'You' and return early
                  if (isCurrentUser) {
                    sender.name = 'You';
                    return sender;
                  }

                  // Try to get the best available name in order of preference
                  const possibleNames = [
                    msg.sender?.name,      // Full name
                    msg.sender?.username,  // Username
                    msg.senderName,        // Legacy senderName
                    msg.sender?.email?.split('@')[0]  // Email prefix
                  ].filter(Boolean);

                  // Use the first valid name we find
                  if (possibleNames.length > 0) {
                    sender.name = possibleNames[0];
                  }
                  
                  // Ensure we have the correct ID and email
                  sender._id = msg.sender?._id || msg.senderId || sender._id;
                  sender.email = msg.sender?.email || msg.senderEmail || sender.email;
                  
                  // Log the final sender info for debugging
                  console.log('Final sender info:', {
                    messageId: msg._id,
                    sender,
                    isCurrentUser,
                    currentUserId,
                    senderId: msg.sender?._id || msg.senderId
                  });

                  return sender;
                };

                // Get sender information
                const currentUserId = user?.id?.toString();
                const { _id: senderId, name: senderName, isCurrentUser } = getSenderInfo(message, currentUserId);
                
                // Debug information
                console.log('Message debug:', {
                  messageId: message._id,
                  rawSender: message.sender,
                  processedSender: { senderId, senderName, isCurrentUser },
                  currentUserId,
                  isCurrentUser
                });
                
                return (
                  <div 
                    key={message._id || message.id} 
                    className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    data-message-id={message._id}
                    data-sender-id={senderId}
                    data-is-current-user={isCurrentUser}
                  >
                    <div 
                      className={`max-w-xs p-3 rounded-lg ${
                        isCurrentUser 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {!isCurrentUser && (
                        <div className="font-semibold text-xs mb-1">
                          {senderName}
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                      <div 
                        className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}
                        title={new Date(message.createdAt).toLocaleString()}
                      >
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200">
            <div className="flex items-center">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <button
                type="submit"
                className="bg-blue-600 text-white p-2 rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                disabled={!newMessage.trim()}
                title="Send message"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatPanel;