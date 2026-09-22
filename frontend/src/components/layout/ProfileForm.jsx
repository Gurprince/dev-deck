import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const ProfileForm = ({ onClose }) => {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await updateProfile({ username, email, avatar });
    setSaving(false);
    if (ok && onClose) onClose();
  };

  const handleAvatarFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Please choose an image smaller than 2 MB.');
      return;
    }

    setAvatarError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
      }
    };
    reader.onerror = () => {
      setAvatarError('Could not read that image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatar('');
    setAvatarError('');
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#2b2b30] dark:bg-[#111113]">
        <div className="flex items-center space-x-4">
          <img
            src={avatar || 'https://ui-avatars.com/api/?background=random&name='+encodeURIComponent(username||'U')}
            alt="avatar"
            className="h-16 w-16 rounded-full object-cover ring-1 ring-sky-500/30"
            onError={(e)=>{ e.currentTarget.src = 'https://ui-avatars.com/api/?background=random&name='+encodeURIComponent(username||'U'); }}
          />
          <div className="min-w-0">
            <div className="text-sm text-slate-500 dark:text-slate-400">Signed in as</div>
            <div className="truncate text-base font-medium text-slate-950 dark:text-gray-100">{email || 'user@example.com'}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Update your public details and avatar preview here.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Display Name</label>
          <input
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-[#3c3c3c] dark:bg-[#111113] dark:text-gray-100"
            placeholder="How your teammates see you"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
          <input
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-[#3c3c3c] dark:bg-[#111113] dark:text-gray-100"
            placeholder="name@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Avatar URL</label>
          <input
            value={avatar}
            onChange={(e)=>setAvatar(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-[#3c3c3c] dark:bg-[#111113] dark:text-gray-100"
            placeholder="https://..."
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Leave blank to keep using the generated avatar.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Profile Image</label>
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-[#3c3c3c] dark:bg-[#111113]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Upload a JPG, PNG, GIF, or WebP image.
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Maximum size: 2 MB</div>
              </div>
              <div className="flex gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700">
                  Choose Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="sr-only"
                  />
                </label>
                {avatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-[#3c3c3c] dark:bg-[#18181b] dark:text-slate-200 dark:hover:bg-[#1f1f23]"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            {avatarError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-300">{avatarError}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-[#2b2b30]">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-[#3c3c3c] dark:bg-[#111113] dark:text-slate-200 dark:hover:bg-[#1f1f23]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  );
};

export default ProfileForm;


