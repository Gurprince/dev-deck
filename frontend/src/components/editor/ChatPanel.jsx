import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import UserAvatar from '../common/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';

const ChatPanel = ({ projectId, isOpen, onClose }) => {
  // A valid projectId is a non-empty string that isn't the 'new' sentinel
  const hasValidProject = !!projectId && projectId !== 'new';
  const [newMessage, setNewMessage] = useState('');
  const [_isLoading, setIsLoading] = useState(true);
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
    if (!hasValidProject) return;
    
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
  }, [projectId, hasValidProject, apiBase, getMessages, addMessage]);

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
    if (!socket || !hasValidProject) return;
    
    const projectIdStr = String(projectId);
    
    if (socket.connected) {
      console.log('Joining project room:', projectIdStr);
      socket.emit('joinProject', { 
        projectId: projectIdStr, 
        userId: user?.id,
        username: user?.username || user?.email?.split('@')[0] || 'user'
      }, (response) => {
        if (response) console.log('Join project response:', response);
      });
    } else {
      // no-op: socket not yet connected, the 'connect' listener will re-fire joinProject
    }
  }, [socket, hasValidProject, projectId, user?.id, user?.username, user?.email]);

  // Set up socket listeners
  useEffect(() => {
    if (!socket || !hasValidProject) return;
    
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

    const trimmed = newMessage.trim();
    if (!trimmed || !projectId) return;

    const projectIdStr = String(projectId);
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Create a temporary message for immediate UI feedback
    const tempMessage = {
      _id: tempId,
      text: trimmed,
      project: projectIdStr,
      projectId: projectIdStr,
      sender: {
        _id: user?.id,
        name: user?.name || user?.username || 'You',
        email: user?.email || '',
        username: user?.username || user?.email?.split('@')[0] || 'user',
      },
      senderId: user?.id,
      senderName: user?.name || user?.username,
      senderEmail: user?.email,
      createdAt: timestamp,
      timestamp: new Date(timestamp).getTime(),
      isSending: true,
      isTemporary: true,
    };

    // Clear input immediately so the UX feels responsive
    setNewMessage('');

    // Push the optimistic message into both context and local state
    updateMessage(projectIdStr, tempId, tempMessage);
    setMessages((prev) => {
      const exists = prev.some((m) => m._id === tempId);
      return exists ? prev : [...prev, tempMessage];
    });

    // Scroll to bottom
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    if (!socket || !socket.connected) {
      // Mark message as failed if socket is unavailable
      const failedMsg = { ...tempMessage, isSending: false, error: 'Not connected' };
      updateMessage(projectIdStr, tempId, failedMsg);
      setMessages((prev) => prev.map((m) => (m._id === tempId ? failedMsg : m)));
      toast.error('Not connected to the server. Please wait and try again.');
      return;
    }

    try {
      const messageToSend = {
        _id: tempId,
        text: trimmed,
        projectId: projectIdStr,
        sender: {
          _id: user?.id,
          name: user?.name || user?.username || 'You',
          email: user?.email || `${user?.id}@dev-deck.local`,
          username: user?.username || user?.email?.split('@')[0] || 'user',
        },
        createdAt: timestamp,
        timestamp: new Date(timestamp).getTime(),
      };

      sendChatMessage(messageToSend);
    } catch (error) {
      console.error('Error sending message:', error);
      const failedMsg = { ...tempMessage, isSending: false, error: 'Failed to send' };
      updateMessage(projectIdStr, tempId, failedMsg);
      setMessages((prev) => prev.map((m) => (m._id === tempId ? failedMsg : m)));
      toast.error('Failed to send message. Please try again.');
    }
  };

  if (!isOpen) return null;

  // No valid project yet — show a friendly placeholder
  if (!hasValidProject) {
    return (
      <div className="fixed bottom-5 right-5 w-80 sm:w-[350px] bg-[#0c0c0f]/95 border border-[#2b2b30]/80 rounded-2xl shadow-2xl flex flex-col h-[480px] transition-all duration-300 ease-in-out overflow-hidden z-50 backdrop-blur-md">
        <div className="bg-[#141418]/90 border-b border-[#2b2b30]/60 text-white p-3.5 flex justify-between items-center select-none">
          <div className="relative flex items-center flex-1">
            <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2 text-sky-400" />
            <span className="font-bold text-sm text-[#f4f4f5] tracking-wide">Project Chat</span>
          </div>
          <XMarkIcon
            className="h-5 w-5 text-slate-400 hover:bg-[#202026] hover:text-[#f4f4f5] rounded-lg p-0.5 cursor-pointer transition-all duration-200"
            onClick={() => onClose && onClose()}
          />
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-6 gap-3">
          <ChatBubbleLeftRightIcon className="h-10 w-10 text-[#404048]" />
          <p className="text-sm font-semibold text-[#a1a1aa]">Chat unavailable</p>
          <p className="text-xs text-[#71717a] max-w-[220px] leading-relaxed">
            Save your project first to enable live chat with collaborators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-5 right-5 w-80 sm:w-[350px] bg-[#0c0c0f]/95 border border-[#2b2b30]/80 rounded-2xl shadow-2xl flex flex-col ${isOpen ? 'h-[480px]' : 'h-12'} transition-all duration-300 ease-in-out overflow-hidden z-50 backdrop-blur-md`}>
      <div className="bg-[#141418]/90 border-b border-[#2b2b30]/60 text-white p-3.5 flex justify-between items-center select-none">
        <div 
          className="relative flex items-center cursor-pointer flex-1"
          onClick={() => isOpen ? onClose() : (onClose && onClose())}
        >
          <span className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
          <ChatBubbleLeftRightIcon className="h-5 w-5 ml-3.5 mr-2 text-sky-400" />
          <span className="font-bold text-sm text-[#f4f4f5] tracking-wide">Project Chat</span>
        </div>
        {isOpen && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearChatHistory();
            }}
            disabled={isClearing || messages.length === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-[#202026] hover:text-[#f4f4f5] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 mr-2"
            title="Clear chat history"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
        {isOpen ? (
          <XMarkIcon 
            className="h-5 w-5 text-slate-400 hover:bg-[#202026] hover:text-[#f4f4f5] rounded-lg p-0.5 cursor-pointer transition-all duration-200" 
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#2c2c35] [&::-webkit-scrollbar-thumb]:rounded-full">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-slate-500 mt-24 p-6 border border-dashed border-[#2b2b30]/65 rounded-xl mx-4 bg-[#141418]/30">
                <ChatBubbleLeftRightIcon className="h-8 w-8 text-[#505058] mb-2.5" />
                <p className="text-xs font-semibold text-[#a1a1aa]">No messages yet</p>
                <p className="text-[10px] text-[#71717a] mt-1 max-w-[200px]">Send a live chat to other editors working in this workspace.</p>
              </div>
            ) : (
              messages.map((message) => {
                // Helper function to extract sender information
                const getSenderInfo = (msg, currentUserId) => {
                  const isCurrentUser = (
                    (msg.sender?._id && msg.sender._id === currentUserId) || 
                    (msg.senderId && msg.senderId === currentUserId) ||
                    (msg.sender?._id === currentUserId) ||
                    (msg.senderId === currentUserId)
                  );
                  
                  const sender = {
                    _id: msg.sender?._id || msg.senderId || 'unknown',
                    name: 'User',
                    email: msg.sender?.email || msg.senderEmail || '',
                    username: msg.sender?.username || '',
                    isCurrentUser: isCurrentUser
                  };

                  if (isCurrentUser) {
                    sender.name = 'You';
                    return sender;
                  }

                  const possibleNames = [
                    msg.sender?.name,
                    msg.sender?.username,
                    msg.senderName,
                    msg.sender?.email?.split('@')[0]
                  ].filter(Boolean);

                  if (possibleNames.length > 0) {
                    sender.name = possibleNames[0];
                  }
                  
                  sender._id = msg.sender?._id || msg.senderId || sender._id;
                  sender.email = msg.sender?.email || msg.senderEmail || sender.email;
                  
                  return sender;
                };

                const currentUserId = user?.id?.toString();
                const { _id: senderId, name: senderName, isCurrentUser } = getSenderInfo(message, currentUserId);
                
                const processedUser = {
                  _id: senderId,
                  name: senderName,
                  email: message.sender?.email || message.senderEmail || '',
                  username: message.sender?.username || '',
                };

                return (
                  <div 
                    key={message._id || message.id} 
                    className={`flex items-start gap-2.5 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    data-message-id={message._id}
                    data-sender-id={senderId}
                    data-is-current-user={isCurrentUser}
                  >
                    {!isCurrentUser && (
                      <div className="shrink-0 mt-0.5">
                        <UserAvatar user={processedUser} size="xs" showTooltip={true} showStatus={false} />
                      </div>
                    )}
                    <div 
                      className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl ${
                        isCurrentUser 
                          ? 'bg-sky-500/20 text-[#f4f4f5] border border-sky-500/30 rounded-tr-none shadow-[0_2px_8px_rgba(14,165,233,0.05)]' 
                          : 'bg-[#18181f]/90 text-[#e4e4e7] border border-[#2b2b30]/65 rounded-tl-none shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                      }`}
                    >
                      {!isCurrentUser && (
                        <div className="font-bold text-[10px] text-sky-400 mb-1 tracking-wide">
                          {senderName}
                        </div>
                      )}
                      <p className="text-xs whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
                      <div 
                        className={`text-[9px] mt-1.5 font-semibold flex items-center gap-1 ${isCurrentUser ? 'text-sky-300/50' : 'text-slate-500'}`}
                        title={new Date(message.createdAt).toLocaleString()}
                      >
                        {message.error ? (
                          <span className="text-rose-400 font-semibold">✕ Failed to send</span>
                        ) : message.isSending ? (
                          <span className="text-sky-400/60 flex items-center gap-0.5">
                            <span className="inline-block w-1 h-1 rounded-full bg-sky-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="inline-block w-1 h-1 rounded-full bg-sky-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="inline-block w-1 h-1 rounded-full bg-sky-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        ) : (
                          formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSendMessage} className="p-3 border-t border-[#2b2b30]/65 bg-[#0f0f13]/98">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-[#131317] border border-[#2b2b30]/80 rounded-xl px-4 py-2 text-xs text-[#f4f4f5] placeholder-[#505058] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/20 transition-all duration-200"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // Submit the parent form to trigger handleSendMessage
                    e.target.closest('form')?.requestSubmit();
                  }
                }}
              />
              <button
                type="submit"
                className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white p-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-sky-500/10 shrink-0"
                disabled={!newMessage.trim()}
                title="Send message"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatPanel;