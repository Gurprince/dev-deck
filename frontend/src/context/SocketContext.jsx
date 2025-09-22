import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !socket) {
      // Initialize socket connection
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const wsBase = import.meta.env.VITE_API_WS || apiBase.replace(/\/api\/?$/, '');
      const newSocket = io(wsBase, {
        path: '/socket.io',
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        withCredentials: true,
      });

      newSocket.on('connect', () => {
        console.log('Connected to WebSocket server');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected from WebSocket server:', reason);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      setSocket(newSocket);

      return () => {
        if (newSocket) {
          newSocket.disconnect();
        }
      };
    }

    // Cleanup on unmount or when authentication status changes
    return () => {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    };
  }, [isAuthenticated]);

  // Join a project room
  const joinProject = (projectId) => {
    if (socket && projectId) {
      socket.emit('joinProject', projectId, user?.username || 'User');
    }
  };

  // Leave a project room
  const leaveProject = (projectId) => {
    if (socket && projectId) {
      socket.emit('leaveProject', projectId);
    }
  };

  // Subscribe to code updates
  const onCodeUpdate = (callback) => {
    if (!socket) return () => {};
    
    socket.on('codeUpdate', callback);
    return () => socket.off('codeUpdate', callback);
  };

  // Subscribe to execution logs
  const onExecutionLog = (callback) => {
    if (!socket) return () => {};
    
    socket.on('executionLog', callback);
    return () => socket.off('executionLog', callback);
  };

  // Send code update to other users in the project
  const sendCodeUpdate = (projectId, code) => {
    if (socket && projectId) {
      socket.emit('codeUpdate', { projectId, code });
    }
  };

  // Send execution log to the server
  const sendExecutionLog = (projectId, log) => {
    if (socket && projectId) {
      socket.emit('executionLog', { projectId, log });
    }
  };

  // Send cursor position update to other users in the project
  const sendCursorPosition = (projectId, position) => {
    if (socket && projectId) {
      socket.emit('cursorPosition', { 
        projectId, 
        position,
        user: {
          id: user?.id,
          name: user?.name || user?.username || 'Anonymous',
          email: user?.email,
          color: user?.color
        }
      });
    }
  };

  // Subscribe to cursor position updates
  const onCursorPositionUpdate = (callback) => {
    if (!socket) return () => {};
    
    socket.on('cursorPosition', callback);
    return () => socket.off('cursorPosition', callback);
  };

  // Send chat message
  const sendChatMessage = (message) => {
    if (socket && message.projectId) {
      socket.emit('sendChatMessage', message);
    }
  };

  // Subscribe to chat messages
  const onChatMessage = (callback) => {
    if (!socket) return () => {};
    
    socket.on('chatMessage', callback);
    return () => socket.off('chatMessage', callback);
  };
  
  // Send code comment
  const sendCodeComment = (projectId, comment) => {
    if (socket && projectId) {
      socket.emit('codeComment', { projectId, comment });
    }
  };

  // Subscribe to code comments
  const onCodeComment = (callback) => {
    if (!socket) return () => {};
    
    socket.on('codeComment', callback);
    return () => socket.off('codeComment', callback);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        joinProject,
        leaveProject,
        onCodeUpdate,
        sendCodeUpdate,
        onExecutionLog,
        sendExecutionLog,
        sendCursorPosition,
        onCursorPositionUpdate,
        sendChatMessage,
        onChatMessage,
        sendCodeComment,
        onCodeComment,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
