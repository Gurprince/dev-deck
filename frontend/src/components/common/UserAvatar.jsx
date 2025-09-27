// src/components/common/UserAvatar.jsx
import React from 'react';
import { Tooltip } from '../ui/tooltip';

const sizeClasses = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg',
  '2xl': 'h-16 w-16 text-xl'
};

const statusIndicatorSizes = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
  xl: 'h-3 w-3',
  '2xl': 'h-3.5 w-3.5'
};

const UserAvatar = React.memo(({ 
  user = {}, 
  size = 'md', 
  showTooltip = true,
  showStatus = true,
  className = ''
}) => {
  // Ensure we have a valid user object
  if (!user) {
    console.warn('UserAvatar: No user object provided');
    return null;
  }

  // Get user display information with fallbacks
  const displayName = user.name || user.username || user.email?.split('@')[0] || 'U';
  const email = user.email || `${user.username || 'user'}@example.com`;
  const avatarText = (user.avatarText || displayName.charAt(0)).toUpperCase();
  const isOnline = user.status === 'online' || user.isOnline === true;
  const statusText = isOnline ? 'Online' : 'Offline';
  
  // Generate a consistent color if none provided
  const getColor = () => {
    if (user.color) return user.color;
    
    // Simple hash function to generate a color from the user's name/email
    const str = user.name || user.email || '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 60%)`;
  };

  const avatarContent = (
    <div 
      className={`${sizeClasses[size] || sizeClasses.md} rounded-full flex items-center justify-center text-white font-semibold shadow-md border-2 border-white dark:border-gray-800 overflow-hidden ${className}`}
      style={{ 
        backgroundColor: getColor(),
        ...(user.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {})
      }}
      aria-label={displayName}
    >
      {!user.avatar && avatarText}
      
      {showStatus && (
        <span 
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-gray-800 ${
            statusIndicatorSizes[size] || statusIndicatorSizes.md
          } ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
          title={statusText}
          aria-label={statusText}
        />
      )}
    </div>
  );

  if (!showTooltip) {
    return <div className="relative inline-block">{avatarContent}</div>;
  }

  return (
    <Tooltip 
      content={
        <div className="text-center">
          <div className="font-medium">{displayName}</div>
          {email && email !== displayName && <div className="text-xs text-gray-300">{email}</div>}
          {user.role && <div className="text-xs text-gray-300">{user.role}</div>}
          <div className="text-xs text-gray-300">{statusText}</div>
        </div>
      }
      placement="top"
      delayDuration={200}
    >
      <div className="relative inline-block">
        {avatarContent}
      </div>
    </Tooltip>
  );
});

UserAvatar.displayName = 'UserAvatar';

export default UserAvatar;