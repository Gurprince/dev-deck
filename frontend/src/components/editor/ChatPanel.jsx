import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import UserAvatar from '../common/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';

const ChatPanel = ({ projectId, isOpen, onClose }) => {
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { socket, sendChatMessage } = useSocket();
  const { user } = useAuth();
  const [isClearing, setIsClearing] = useState(false);
  const messagesEndRef = useRef(null);
  const { getMessages, addMessage, updateMessage, clearMessages } = useChat();
  const [messages, setMessages] = useState([]);
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
    
    const projectIdStr = String(projectId);
    const cachedMessages = getMessages(projectIdStr);
    
    if (cachedMessages.length > 0) {
      setMessages(cachedMessages);
      setIsLoading(false);
      return;
    }
    
    const token = getAuthToken();
    if (!token) return;
    
    try {
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
      const messages = Array.isArray(data) ? data : [];
      
      // Add messages to context
      messages.forEach(msg => addMessage(projectIdStr, msg));
      setMessages(messages);
      
    } catch (error) {
      console.error('Error fetching chat history:', error);
      toast.error(error.message || 'Failed to load chat history');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, apiBase, getMessages, addMessage]);

  useEffect(() => {
    if (isOpen) {
      fetchChatHistory();
    }
  }, [fetchChatHistory, isOpen]);
  // Function to clear chat history
  const clearChatHistory = async () => {
    console.log('clearChatHistory called');
    if (!projectId) {
      console.error('No project ID available');
      toast.error('No project ID available');
      return;
    }
    
    const projectIdStr = String(projectId);
    clearMessages(projectIdStr);
    
    if (!window.confirm('Are you sure you want to clear the chat history? This action cannot be undone.')) {
      return;
    }
    const token = getAuthToken();
    if (!token) {
      console.error('No authentication token found');
      toast.error('Authentication required. Please log in again.');
      return;
    }

    console.log('Starting to clear chat history for project:', projectId);
    setIsClearing(true);
    
    try {
      // Use the correct endpoint format that matches the backend route
      const url = `${apiBase}/sse/chat/${projectId}`;
      console.log('Making DELETE request to:', url);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      console.log('Response status:', response.status);
      
      // Try to parse the response body even if the status is not OK
      let responseData;
      try {
        const text = await response.text();
        console.log('Raw response:', text);
        responseData = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        const errorMessage = responseData.message || 
                           response.statusText || 
                           `HTTP error! status: ${response.status}`;
        console.error('Error response:', {
          status: response.status,
          statusText: response.statusText,
          responseData
        });
        throw new Error(errorMessage);
      }

      console.log('Chat history cleared successfully');
      // Don't update state here - wait for the chat_cleared event
      toast.success('Chat history cleared');
    } catch (error) {
      console.error('Error in clearChatHistory:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      
      // Show error in UI and keep it visible for 5 seconds
      toast.error(`Failed to clear chat history: ${error.message}`, {
        duration: 5000
      });
    } finally {
      console.log('Clearing complete, setting isClearing to false');
      setIsClearing(false);
    }
  };

  // Handle new message
  const handleNewMessage = useCallback((incomingMessage) => {
    if (!incomingMessage || !incomingMessage.text || !projectId) {
      console.error('Invalid message or missing project ID');
      return;
    }

    const projectIdStr = String(projectId);
    
    // Generate a stable ID for the message if it doesn't have one
    const messageId = incomingMessage._id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Normalize the message
    const normalizedMessage = {
      ...incomingMessage,
      _id: messageId,
      text: incomingMessage.text,
      project: projectIdStr,
      projectId: projectIdStr,
      sender: {
        _id: incomingMessage.sender?._id || incomingMessage.senderId || 'unknown',
        name: incomingMessage.sender?.name || incomingMessage.senderName || 'Unknown User',
        username: incomingMessage.sender?.username || incomingMessage.senderName?.toLowerCase().replace(/\\s+/g, '_') || 'user',
        email: incomingMessage.sender?.email || incomingMessage.senderEmail || ''
      },
      senderId: incomingMessage.sender?._id || incomingMessage.senderId || 'unknown',
      senderName: incomingMessage.sender?.name || incomingMessage.senderName || 'Unknown User',
      senderEmail: incomingMessage.sender?.email || incomingMessage.senderEmail || '',
      createdAt: incomingMessage.createdAt || new Date().toISOString(),
      timestamp: incomingMessage.timestamp || new Date(incomingMessage.createdAt || new Date()).getTime(),
      isSending: incomingMessage.isSending || false
    };

    // Always use updateMessage which will handle both new and existing messages
    updateMessage(projectIdStr, messageId, normalizedMessage);
    
    // Update local state to ensure immediate UI update
    setMessages(prev => {
      // Check if this is a new message or an update to an existing one
      const existingIndex = prev.findIndex(m => m._id === messageId);
      
      if (existingIndex >= 0) {
        // Update existing message
        const updatedMessages = [...prev];
        updatedMessages[existingIndex] = { ...normalizedMessage };
        return updatedMessages;
      } else {
        // Add new message
        return [...prev, normalizedMessage];
      }
    });
  }, [projectId, updateMessage]);

  // Handle chat cleared event
  const handleChatCleared = useCallback((data) => {
    if (!projectId) return;
    
    const projectIdStr = String(projectId);
    if (data.projectId === projectIdStr) {
      setMessages([]);
      clearMessages(projectIdStr);
      toast.success('Chat history cleared', { duration: 3000 });
    }
  }, [projectId, clearMessages]);
  
  // Join project room
  const joinProject = useCallback(() => {
    if (!socket || !projectId) return;
    
    const projectIdStr = String(projectId);
    
    if (socket.connected) {
      console.log('Joining project room:', projectIdStr);
      socket.emit('joinProject', { 
        projectId: projectIdStr, 
        userId: user?.id,
        username: user?.username || user?.email?.split('@')[0] || 'user'
      }, (response) => {
        console.log('Join project response:', response);
      });
    } else {
      console.log('Socket not connected, cannot join project');
    }
  }, [socket, projectId, user?.id, user?.username, user?.email]);

  // Set up socket listeners
  useEffect(() => {
    if (!socket || !projectId) {
      console.log('Socket or projectId not available', { hasSocket: !!socket, projectId });
      return;
    }
    
    const projectIdStr = String(projectId);
    
    // Set up event listeners
    socket.on('connect', joinProject);
    socket.on('chatMessage', handleNewMessage);
    socket.on('chat_cleared', handleChatCleared);
    
    // Initial join
    joinProject();
    
    // Clean up event listeners
    return () => {
      console.log('Cleaning up chat panel socket listeners');
      socket.off('connect', joinProject);
      socket.off('chatMessage', handleNewMessage);
      socket.off('chat_cleared', handleChatCleared);
      
      // Leave the room when component unmounts
      if (socket.connected) {
        socket.emit('leaveProject', { projectId: projectIdStr, userId: user?.id });
      }
    };
  }, [socket, projectId, user?.id, joinProject, handleNewMessage, handleChatCleared]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !projectId || !socket) return;

    try {
      const projectIdStr = String(projectId);
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();
      
      // Create a temporary message for immediate UI feedback
      const tempMessage = {
        _id: tempId,
        text: newMessage,
        project: projectIdStr,
        projectId: projectIdStr,
        sender: {
          _id: user?.id,
          name: user?.name || user?.username || 'You',
          email: user?.email || '',
          username: user?.username || user?.email?.split('@')[0] || 'user'
        },
        senderId: user?.id,
        senderName: user?.name || user?.username,
        senderEmail: user?.email,
        createdAt: timestamp,
        timestamp: new Date(timestamp).getTime(),
        isSending: true,
        isTemporary: true
      };
      
      // Add the temporary message to the context and local state
      updateMessage(projectIdStr, tempId, tempMessage);
      
      // Clear the input field
      setNewMessage('');
      
      // Scroll to the bottom to show the new message
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      
      // Prepare the message to send
      const messageToSend = {
        _id: tempId, // Use the same ID as the temp message
        text: newMessage,
        projectId: projectIdStr,
        sender: {
          _id: user?.id,
          name: user?.name || user?.username || 'You',
          email: user?.email || `${user?.id}@dev-deck.local`,
          username: user?.username || user?.email?.split('@')[0] || 'user'
        },
        createdAt: timestamp,
        timestamp: new Date(timestamp).getTime()
      };
      
      console.log('Sending chat message:', messageToSend);
      
      try {
        // Send the message via WebSocket
        sendChatMessage(messageToSend);
      } catch (error) {
        console.error('Error sending message:', error);
        // Update the message to show it failed to send
        updateMessage(projectIdStr, tempId, {
          ...tempMessage,
          isSending: false,
          error: 'Failed to send message'
        });
        toast.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      toast.error(error.message || 'An error occurred while sending the message');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-4 right-4 w-80 bg-white rounded-lg shadow-xl flex flex-col ${isOpen ? 'h-96' : 'h-12'} transition-all duration-300 ease-in-out overflow-hidden z-50`}>
      <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
        <div 
          className="flex items-center cursor-pointer flex-1"
          onClick={() => isOpen ? onClose() : (onClose && onClose())}
        >
          <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
          <span>Project Chat</span>
        </div>
        {isOpen && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearChatHistory();
            }}
            disabled={isClearing || messages.length === 0}
            className="p-1 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear chat history"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
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