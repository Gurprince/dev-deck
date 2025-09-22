import React, { useState } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import UserAvatar from '../common/UserAvatar';

const InlineComment = ({ 
  comment, 
  onResolve, 
  onReply, 
  onDelete, 
  currentUser,
  position
}) => {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const handleReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText);
    setReplyText('');
    setIsReplying(false);
  };

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-64 max-h-80 overflow-y-auto"
      style={{
        position: 'absolute',
        left: `${position.x + 10}px`,
        top: `${position.y}px`,
        zIndex: 1000
      }}
    >
      {/* Comment header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
        <div className="flex items-center">
          <UserAvatar 
            user={{
              ...comment.author,
              avatarText: comment.author.name ? comment.author.name.charAt(0).toUpperCase() : 'A',
              isOnline: true
            }}
            size="xs"
          />
          <span className="ml-2 text-xs font-medium text-gray-700 dark:text-gray-300">
            {comment.author.name}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button 
            onClick={() => onResolve(comment.id)}
            className="text-green-500 hover:text-green-600 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Resolve comment"
          >
            <CheckIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onDelete(comment.id)}
            className="text-gray-500 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Delete comment"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Comment content */}
      <div className="p-3">
        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {comment.text}
        </p>
        <div className="text-xs text-gray-500 mt-1">
          {new Date(comment.timestamp).toLocaleString()}
        </div>
        
        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-2">
            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Replies</h4>
            {comment.replies.map((reply) => (
              <div key={reply.id} className="flex items-start space-x-2">
                <UserAvatar 
                  user={{
                    ...reply.author,
                    avatarText: reply.author.name ? reply.author.name.charAt(0).toUpperCase() : 'A',
                    isOnline: true
                  }}
                  size="xs"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {reply.author.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-800 dark:text-gray-200 mt-1">
                    {reply.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Reply form */}
        <div className="mt-3">
          {isReplying ? (
            <div className="space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                className="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                rows={2}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setIsReplying(false)}
                  className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim()}
                  className="px-2 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded disabled:opacity-50"
                >
                  Reply
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsReplying(true)}
              className="text-xs text-indigo-500 hover:text-indigo-600"
            >
              Reply to this comment
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InlineComment;