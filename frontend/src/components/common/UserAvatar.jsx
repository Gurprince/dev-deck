// src/components/common/UserAvatar.jsx
import React from 'react';

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base'
};

const UserAvatar = React.memo(({ user, size = 'md', showTooltip = true }) => {
  const isOnline = user.status === 'online';
  
  return (
    <div className="relative group">
      <div 
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-semibold shadow-md border-2 border-white dark:border-gray-800`}
        style={{ backgroundColor: user.color || '#6b7280' }}
      >
        {user.avatarText}
        
        {/* Online status indicator */}
        <div 
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-800 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
          title={isOnline ? 'Online' : 'Offline'}
        ></div>
      </div>
      
      {showTooltip && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <div className="font-medium">{user.name}</div>
          <div className="text-gray-300 text-2xs">{user.role}</div>
          <div className="text-gray-300 text-2xs">{isOnline ? 'Online' : 'Offline'}</div>
        </div>
      )}
    </div>
  );
});

export default UserAvatar;