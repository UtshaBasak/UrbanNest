import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { getProperty, updateProperty } from '../utils/api';


const EditProperty = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    latitude: '',
    longitude: '',
    price: '',
    category: 'Apartment',
    availabilityStatus: 'Available'
  });
  const [saving, setSaving] = useState(false);
  const handleOpenMapInNewTab = () => {
    window.open('/map', '_blank');
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await getProperty(id);
        const p = res.data.property;
        setForm({
          title: p.title || '',
          description: p.description || '',
          location: p.location || '',
          latitude: p.latitude ? p.latitude.toString() : '',
          longitude: p.longitude ? p.longitude.toString() : '',
          price: p.price || '',
          category: p.category || 'Apartment',
          availabilityStatus: p.availabilityStatus || p.availability || 'Available',
        });
      } catch (e) {
        setError('Failed to load property');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProperty(id, {
        title: form.title,
        description: form.description,
        location: form.location,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        price: Number(form.price),
        category: form.category,
        availabilityStatus: form.availabilityStatus,
      });
      navigate(`/properties/${id}`);
    } catch (e) {
      setError(e.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">Edit Property</h1>
        {error && (
          <div className="mb-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-neutral-800 p-6 rounded-lg shadow">
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Title</label>
            <input name="title" value={form.title} onChange={handleChange} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Location</label>
            <input name="location" value={form.location} onChange={handleChange} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
          </div>
          <div>
            <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Property Location</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Click the button to open map in new tab, then copy coordinates back here.</p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenMapInNewTab}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                >
                  <MapPin className="h-4 w-4" />
                  Pick from Map
                </button>
              </div>
              {(form.latitude && form.longitude) && (
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    📍 Location selected: {parseFloat(form.latitude).toFixed(6)}, {parseFloat(form.longitude).toFixed(6)}
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Latitude</label>
                <input name="latitude" value={form.latitude} onChange={handleChange} placeholder="e.g., 23.8103" className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
              </div>
              <div>
                <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Longitude</label>
                <input name="longitude" value={form.longitude} onChange={handleChange} placeholder="e.g., 90.4125" className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Price (monthly)</label>
            <input type="number" name="price" value={form.price} onChange={handleChange} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Category</label>
            <select name="category" value={form.category} onChange={handleChange} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600">
              <option>Apartment</option>
              <option>Home</option>
              <option>Penthouse</option>
              <option>Studio</option>
              <option>Villa</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Availability</label>
            <select name="availabilityStatus" value={form.availabilityStatus} onChange={handleChange} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600">
              <option>Available</option>
              <option>Booked</option>
              <option>Under Construction</option>
              <option>Pre-booking Available</option>
            </select>
          </div>
          <div className="pt-2">
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center rounded-md bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProperty;
