import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createProperty } from '../utils/api';


const defaultForm = {
  title: '',
  description: '',
  price: '',
  location: '',
  latitude: '',
  longitude: '',
  size: '',
  bedrooms: 1,
  bathrooms: 1,
  type: 'Apartment',
  images: '', // comma-separated URLs for simplicity
  availabilityStatus: 'Available'
};

const CreateProperty = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedPreviews, setUploadedPreviews] = useState([]);
  const handleOpenMapInNewTab = () => {
    window.open('/map', '_blank');
  };


  const isAllowed = user && (user.role === 'owner' || user.role === 'admin');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNumber = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value === '' ? '' : Number(value) }));
  };

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      setUploading(true);
      const bases = await Promise.all(files.map(toBase64));
      setUploadedPreviews((prev) => [...prev, ...bases]);
    } catch (err) {
      console.error('Image read failed', err);
      setError('Failed to read selected images');
    } finally {
      setUploading(false);
    }
  };

  const removePreview = (idx) => {
    setUploadedPreviews((prev) => prev.filter((_, i) => i !== idx));
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAllowed) {
      setError('Only owners or admins can create properties');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const payload = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        location: form.location,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        size: Number(form.size),
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        type: form.type,
        images: [...uploadedPreviews],
        availabilityStatus: form.availabilityStatus
      };

      const res = await createProperty(payload);
      const created = res?.data?.property;

      // Go to the newly created property page if we have the id; else go to dashboard
      if (created && created._id) {
        navigate(`/properties/${created._id}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Create property failed:', err);
      setError(err.message || 'Failed to create property');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAllowed) {
    return (
      <div className="max-w-3xl mx-auto pt-24 px-4">
        <p className="text-center text-neutral-600 dark:text-neutral-300">
          You do not have permission to create properties.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-10">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center mb-6">
          <Plus className="h-6 w-6 text-cyan-600 mr-2" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Add New Property</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-800 p-6 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Title</label>
              <input name="title" value={form.title} onChange={handleChange} required className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
            </div>
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Rent (per month)</label>
              <input type="number" min="0" name="price" value={form.price} onChange={handleNumber} required className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={4} required className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
            </div>
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Location</label>
              <input name="location" value={form.location} onChange={handleChange} placeholder="e.g., Dhaka, Bangladesh" className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
            </div>
            <div className="md:col-span-2">
              <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Latitude</label>
                <input name="latitude" value={form.latitude} onChange={handleChange} placeholder="e.g., 23.8103" className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
              </div>
              <div>
                <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Longitude</label>
                <input name="longitude" value={form.longitude} onChange={handleChange} placeholder="e.g., 90.4125" className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Size (sqft)</label>
              <input type="number" min="0" name="size" value={form.size} onChange={handleNumber} required className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
            </div>
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Bedrooms</label>
              <input type="number" min="0" name="bedrooms" value={form.bedrooms} onChange={handleNumber} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
            </div>
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Bathrooms</label>
              <input type="number" min="0" name="bathrooms" value={form.bathrooms} onChange={handleNumber} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
            </div>
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Type</label>
              <select name="type" value={form.type} onChange={handleChange} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600">
                <option>Apartment</option>
                <option>House</option>
                <option>Studio</option>
                <option>Condo</option>
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
            <div className="md:col-span-2">
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Upload Images</label>
              <input type="file" accept="image/*" multiple onChange={handleFiles} className="block w-full text-sm text-neutral-700 dark:text-neutral-200 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 dark:file:bg-neutral-700 dark:file:text-neutral-100 transition file:transition file:duration-200 hover:file:bg-cyan-100 dark:hover:file:bg-neutral-600" />
              {uploadedPreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {uploadedPreviews.map((src, idx) => (
                    <div key={idx} className="relative group">
                      <img src={src} alt={`upload-${idx}`} className="h-28 w-full object-cover rounded" />
                      <button type="button" onClick={() => removePreview(idx)} className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200">
              Cancel
            </button>
            <button type="submit" disabled={submitting || uploading} className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-60">
              {submitting ? 'Creating...' : uploading ? 'Processing images...' : 'Create Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProperty;
