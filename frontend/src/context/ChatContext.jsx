import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [chatMessages, setChatMessages] = useState({});

  // Load messages for a specific project
  const getMessages = (projectId) => {
    return chatMessages[projectId] || [];
  };

  // Add a new message to a project's chat
  const addMessage = (projectId, message) => {
    setChatMessages(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), message]
    }));
  };

  // Clear all messages for a project
  const clearMessages = (projectId) => {
    setChatMessages(prev => {
      const newState = { ...prev };
      delete newState[projectId];
      return newState;
    });
  };

  // Update a message (useful for updating temporary messages)
  const updateMessage = (projectId, messageId, updates) => {
    setChatMessages(prev => {
      const projectMessages = prev[projectId] || [];
      
      // Find the message to update
      const messageIndex = projectMessages.findIndex(m => m._id === messageId);
      
      // If message not found, add it as a new message
      if (messageIndex === -1) {
        return {
          ...prev,
          [projectId]: [...projectMessages, { _id: messageId, ...updates }]
        };
      }
      
      // Otherwise, update the existing message
      const updatedMessages = [...projectMessages];
      updatedMessages[messageIndex] = { 
        ...updatedMessages[messageIndex], 
        ...updates,
        // Preserve the original ID to prevent duplicates
        _id: updatedMessages[messageIndex]._id
      };
      
      return {
        ...prev,
        [projectId]: updatedMessages
      };
    });
  };

  return (
    <ChatContext.Provider 
      value={{ 
        getMessages, 
        addMessage, 
        clearMessages, 
        updateMessage 
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export default ChatContext;
