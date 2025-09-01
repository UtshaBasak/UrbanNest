import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPropertiesByOwner, deleteCurrentUser } from '../utils/api';
import { Save, Building2, Edit, Eye } from 'lucide-react';

const ProfileSettings = () => {
  const { user, updateProfile: updateAuthProfile } = useAuth();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [editForm, setEditForm] = useState({ name: '', phone: '', profileImage: '' });
  const [saving, setSaving] = useState(false);
  const [ownerProps, setOwnerProps] = useState([]);
  const isOwner = user?.role === 'owner';

  useEffect(() => {
    if (user) {
      setEditForm({ name: user.name || '', phone: user.phone || '', profileImage: user.profileImage || '' });
      if (isOwner) {
        getPropertiesByOwner(user._id || user.id)
          .then(res => setOwnerProps(res.data.properties || []))
          .catch(() => setOwnerProps([]));
      }
    }
  }, [user]);

  const handleImageFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditForm(prev => ({ ...prev, profileImage: reader.result }));
    reader.readAsDataURL(file);
  };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateAuthProfile(editForm);
    } catch (e) {
      console.error(e);
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Profile Settings</h1>
        </div>

        {/* Profile form */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 flex items-center justify-center">
              <div className="w-28 h-28 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden flex items-center justify-center">
                {editForm.profileImage ? (
                  <img src={editForm.profileImage} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-neutral-600 dark:text-neutral-300">No Photo</span>
                )}
              </div>
            </div>
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-sm mb-2 text-neutral-700 dark:text-neutral-300">Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-2 text-neutral-700 dark:text-neutral-300">Phone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm mb-2 text-neutral-700 dark:text-neutral-300">Profile Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                  className="block w-full text-sm text-neutral-700 dark:text-neutral-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 dark:file:bg-cyan-900/40 dark:file:text-cyan-300"
                />
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Upload an image to replace your current photo.</p>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                >
                  <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!window.confirm('Are you sure you want to delete your profile? This action can be reversed only by an admin.')) return;
                    try {
                      await deleteCurrentUser();
                      await logout();
                      navigate('/');
                    } catch (e) {
                      alert('Failed to delete account');
                    }
                  }}
                  className="inline-flex px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Owner property management */}
        {isOwner && (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center"><Building2 className="h-5 w-5 mr-2" /> My Properties</h2>
              <button
                onClick={() => navigate('/properties/new')}
                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm"
              >
                + Add Property
              </button>
            </div>
            {ownerProps.length === 0 ? (
              <div className="text-neutral-500 dark:text-neutral-400">You have no properties yet.</div>
            ) : (
              <div className="space-y-3">
                {ownerProps.map(p => (
                  <div key={p._id} className="flex items-center justify-between border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
                    <div className="flex items-center space-x-3">
                      <img src={p.images?.[0] || '/api/placeholder/80/80'} alt={p.title} className="w-14 h-14 object-cover rounded" />
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-white">{p.title}</div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">{p.location}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/properties/${p._id}`)} className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-cyan-600"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => navigate(`/properties/${p._id}/edit`)} className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Danger zone removed; delete moved to profile card */}
      </div>
    </div>
  );
};

export default ProfileSettings;
