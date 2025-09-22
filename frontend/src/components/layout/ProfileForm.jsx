import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const ProfileForm = ({ onClose }) => {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await updateProfile({ username, email, avatar });
    setSaving(false);
    if (ok && onClose) onClose();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="flex items-center space-x-3">
        <img
          src={avatar || 'https://ui-avatars.com/api/?background=random&name='+encodeURIComponent(username||'U')}
          alt="avatar"
          className="h-12 w-12 rounded-full object-cover"
          onError={(e)=>{ e.currentTarget.src = 'https://ui-avatars.com/api/?background=random&name='+encodeURIComponent(username||'U'); }}
        />
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Logged in as</div>
          <div className="text-base font-medium text-gray-900 dark:text-gray-100">{email || 'user@example.com'}</div>
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-200 mb-1">Display Name</label>
        <input value={username} onChange={(e)=>setUsername(e.target.value)} className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
      </div>
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-200 mb-1">Email</label>
        <input value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
      </div>
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-200 mb-1">Avatar URL</label>
        <input value={avatar} onChange={(e)=>setAvatar(e.target.value)} className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="https://..." />
      </div>
      <div className="flex justify-end space-x-2">
        <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-indigo-600 text-white">{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
};

export default ProfileForm;


