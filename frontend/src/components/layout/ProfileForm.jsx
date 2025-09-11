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
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-200 mb-1">Username</label>
        <input value={username} onChange={(e)=>setUsername(e.target.value)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
      </div>
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-200 mb-1">Email</label>
        <input value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
      </div>
      <div>
        <label className="block text-sm text-gray-700 dark:text-gray-200 mb-1">Avatar URL</label>
        <input value={avatar} onChange={(e)=>setAvatar(e.target.value)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
      </div>
      <button type="submit" disabled={saving} className="px-3 py-1 rounded bg-indigo-600 text-white">{saving ? 'Saving...' : 'Save'}</button>
    </form>
  );
};

export default ProfileForm;


