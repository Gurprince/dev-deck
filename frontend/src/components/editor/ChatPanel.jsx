import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import UserAvatar from '../common/UserAvatar';

const ChatPanel = ({ projectId, isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const { socket } = useSocket();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket || !projectId) return;

    // Listen for new chat messages
    const handleNewMessage = (message) => {
      setMessages(prev => [...prev, message]);
    };

    socket.on('chatMessage', handleNewMessage);

    // Load previous messages
    socket.emit('getChatHistory', projectId, (history) => {
      if (history && Array.isArray(history)) {
        setMessages(history);
      }
    });

    return () => {
      socket.off('chatMessage', handleNewMessage);
    };
  }, [socket, projectId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !projectId) return;

    const message = {
      id: Date.now().toString(),
      text: newMessage,
      sender: {
        id: user?.id,
        name: user?.name || user?.username || 'Anonymous',
        email: user?.email
      },
      timestamp: new Date().toISOString(),
      projectId
    };

    socket.emit('sendChatMessage', message);
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 right-0 w-80 h-96 bg-white dark:bg-gray-800 shadow-lg rounded-tl-lg flex flex-col border border-gray-200 dark:border-gray-700 z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <ChatBubbleLeftRightIcon className="w-5 h-5 text-indigo-500 mr-2" />
          <h3 className="font-medium text-gray-900 dark:text-white">Team Chat</h3>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`flex ${message.sender.id === user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-xs ${message.sender.id === user?.id ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="flex-shrink-0 mr-2">
                <UserAvatar 
                  user={{
                    ...message.sender,
                    avatarText: message.sender.name ? message.sender.name.charAt(0).toUpperCase() : 'A',
                    isOnline: true
                  }}
                  size="sm"
                />
              </div>
              <div 
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.sender.id === user?.id 
                    ? 'bg-indigo-500 text-white rounded-tr-none' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-none'
                }`}
              >
                <div className="font-medium text-xs mb-1">
                  {message.sender.id === user?.id ? 'You' : message.sender.name}
                </div>
                <p>{message.text}</p>
                <div className="text-xs opacity-70 text-right mt-1">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSendMessage} className="border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="submit"
            className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-r-md"
            disabled={!newMessage.trim()}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;