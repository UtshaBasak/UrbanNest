import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProperty, updateProperty } from '../utils/api';
import { compressImageFiles, MAX_IMAGES, MAX_TOTAL_IMAGE_CHARS, TOTAL_IMAGES_TOO_LARGE_MESSAGE, totalImageChars } from '../utils/image';


const EditProperty = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  // Set when the property could not be loaded; the form is not rendered then,
  // so saving can never overwrite the listing with empty fields.
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    latitude: '',
    longitude: '',
    price: '',
    size: '',
    bedrooms: 0,
    bathrooms: 0,
    type: 'Apartment',
    availabilityStatus: 'Available'
  });
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setLoadError('');
        setError('');
        const res = await getProperty(id);
        if (cancelled) return;
        const p = res.data?.property;
        if (!p) {
          setLoadError('Property not found');
          return;
        }
        setForm({
          title: p.title || '',
          description: p.description || '',
          location: p.location || '',
          latitude: typeof p.latitude === 'number' ? p.latitude.toString() : '',
          longitude: typeof p.longitude === 'number' ? p.longitude.toString() : '',
          price: typeof p.price === 'number' ? p.price.toString() : '',
          size: typeof p.size === 'number' ? p.size.toString() : '',
          bedrooms: typeof p.bedrooms === 'number' ? p.bedrooms : 0,
          bathrooms: typeof p.bathrooms === 'number' ? p.bathrooms : 0,
          type: p.type || 'Apartment',
          availabilityStatus: p.availabilityStatus || p.availability || 'Available',
        });
        setImages(Array.isArray(p.images) ? p.images.slice(0, MAX_IMAGES) : []);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e.message || 'Failed to load property');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (id) load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    try {
      setUploading(true);
      setError('');
      // Resize/re-encode as JPEG before storing as base64
      const { images: added, errors } = await compressImageFiles(files, images.length);
      setImages((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
      const combined = [...images, ...added].slice(0, MAX_IMAGES);
      if (totalImageChars(combined) > MAX_TOTAL_IMAGE_CHARS) errors.push(TOTAL_IMAGES_TOO_LARGE_MESSAGE);
      if (errors.length) setError(errors.join(' '));
    } catch (err) {
      console.error('Image processing failed', err);
      setError('Failed to process selected images');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // Mirror the backend validation rules so users get immediate feedback
  const validate = () => {
    const title = form.title.trim();
    const description = form.description.trim();
    if (title.length < 3 || title.length > 120) return 'Title must be between 3 and 120 characters';
    if (description.length < 10 || description.length > 5000) return 'Description must be between 10 and 5000 characters';
    if (!form.location.trim()) return 'Location is required';
    const price = Number(form.price);
    if (form.price === '' || !Number.isFinite(price) || price < 0) return 'Price must be a number of 0 or more';
    for (const [key, label] of [['bedrooms', 'Bedrooms'], ['bathrooms', 'Bathrooms']]) {
      const n = Number(form[key]);
      if (form[key] === '' || !Number.isInteger(n) || n < 0 || n > 50) return `${label} must be a whole number between 0 and 50`;
    }
    if (form.size !== '' && (!Number.isFinite(Number(form.size)) || Number(form.size) < 0)) return 'Size must be a number of 0 or more';
    if (form.latitude !== '' && (!Number.isFinite(Number(form.latitude)) || Math.abs(Number(form.latitude)) > 90)) return 'Latitude must be a number between -90 and 90';
    if (form.longitude !== '' && (!Number.isFinite(Number(form.longitude)) || Math.abs(Number(form.longitude)) > 180)) return 'Longitude must be a number between -180 and 180';
    if (images.length < 1) return 'Please keep or upload at least one image';
    if (images.length > MAX_IMAGES) return `You can upload at most ${MAX_IMAGES} images`;
    if (totalImageChars(images) > MAX_TOTAL_IMAGE_CHARS) return TOTAL_IMAGES_TOO_LARGE_MESSAGE;
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loadError) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setSaving(true);
      setError('');
      await updateProperty(id, {
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        latitude: form.latitude !== '' ? Number(form.latitude) : undefined,
        longitude: form.longitude !== '' ? Number(form.longitude) : undefined,
        price: Number(form.price),
        size: form.size !== '' ? Number(form.size) : undefined,
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        type: form.type,
        images: [...images],
        availabilityStatus: form.availabilityStatus,
      });
      navigate(`/properties/${id}`);
    } catch (e) {
      const fieldErrors = Array.isArray(e.errors) ? e.errors.map((x) => x.msg).filter(Boolean) : [];
      setError(fieldErrors.length ? fieldErrors.join('. ') : (e.message || 'Failed to save changes'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto p-6">Loading...</div>;
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">Edit Property</h1>
          <div className="mb-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded-sm">
            {loadError}
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-sm border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const inputClass = 'w-full p-2 rounded-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-600';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">Edit Property</h1>
        {error && (
          <div className="mb-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm">
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Title</label>
            <input name="title" value={form.title} onChange={handleChange} required minLength={3} maxLength={120} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} required minLength={10} maxLength={5000} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Location</label>
            <input name="location" value={form.location} onChange={handleChange} required className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Latitude</label>
              <input type="number" step="any" min="-90" max="90" name="latitude" value={form.latitude} onChange={handleChange} placeholder="e.g., 23.8103" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Longitude</label>
              <input type="number" step="any" min="-180" max="180" name="longitude" value={form.longitude} onChange={handleChange} placeholder="e.g., 90.4125" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Price (monthly)</label>
              <input type="number" min="0" name="price" value={form.price} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Size (sqft)</label>
              <input type="number" min="0" name="size" value={form.size} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Bedrooms</label>
              <input type="number" min={0} max={50} step={1} name="bedrooms" value={form.bedrooms} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Bathrooms</label>
              <input type="number" min={0} max={50} step={1} name="bathrooms" value={form.bathrooms} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Type</label>
            <select name="type" value={form.type} onChange={handleChange} className={inputClass}>
              <option>Apartment</option>
              <option>House</option>
              <option>Shop</option>
              <option>Commercial Space</option>
              <option>Land</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Status</label>
            <select name="availabilityStatus" value={form.availabilityStatus} onChange={handleChange} className={inputClass}>
              <option>Available</option>
              <option>Booked</option>
              <option>Under Construction</option>
              <option>Pre-booking Available</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-800 dark:text-neutral-200 mb-1">Images ({images.length}/{MAX_IMAGES})</label>
            <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading || images.length >= MAX_IMAGES} className="block w-full text-sm text-neutral-700 dark:text-neutral-200 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 dark:file:bg-neutral-700 dark:file:text-neutral-100 transition file:transition file:duration-200 hover:file:bg-cyan-100 dark:hover:file:bg-neutral-600" />
            {images.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((src, idx) => (
                  <div key={idx} className="relative group">
                    <img src={src} alt={`property-${idx}`} className="h-28 w-full object-cover rounded-sm" />
                    <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="pt-2">
            <button type="submit" disabled={saving || uploading} className="inline-flex items-center justify-center rounded-md bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Saving...' : uploading ? 'Processing images...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProperty;
