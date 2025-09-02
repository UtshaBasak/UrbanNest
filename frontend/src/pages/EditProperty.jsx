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
    type: 'Apartment',
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
          type: p.type || 'Apartment',
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
        type: form.type,
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
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Price (monthly)</label>
            <input type="number" name="price" value={form.price} onChange={handleChange} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Type</label>
            <select name="type" value={form.type} onChange={handleChange} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600">
              <option>Apartment</option>
              <option>House</option>
              <option>Shop</option>
              <option>Commercial Space</option>
              <option>Land</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Status</label>
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
