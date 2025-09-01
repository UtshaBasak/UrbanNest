import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPropertiesByOwner } from '../utils/api';
import { MapPin, Star } from 'lucide-react';

const badge = (status) => {
  switch (status) {
    case 'Available': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'Booked': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'Under Construction': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'Pre-booking Available': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

const OwnerProperties = () => {
  const { id } = useParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await getPropertiesByOwner(id);
        setProperties(res.data.properties || []);
      } catch (e) {
        setError('Failed to fetch properties');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">Owner Properties</h1>
        {error && <div className="mb-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded">{error}</div>}
        {loading ? (
          <div>Loading...</div>
        ) : properties.length === 0 ? (
          <div className="text-neutral-500 dark:text-neutral-400">No properties found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <Link key={property._id} to={`/properties/${property._id}`} className="bg-white dark:bg-neutral-800 rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative">
                  <img src={property.images?.[0] || '/api/placeholder/400/300'} alt={property.title} className="w-full h-48 object-cover" />
                  <span className={`absolute top-2 left-2 px-2 py-1 text-xs font-medium rounded-full shadow ${badge(property.availabilityStatus || property.availability)}`}>
                    {property.availabilityStatus || property.availability}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white line-clamp-1">{property.title}</h3>
                  <div className="flex items-center text-neutral-600 dark:text-neutral-400 mb-2">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span className="text-sm line-clamp-1">{property.location}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400 mb-3">
                    {property.owner?.name && (
                      <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700">Owned by {property.owner.name}</span>
                    )}
                    {property.currentTenant?.name && (
                      <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700">Tenant: {property.currentTenant.name}</span>
                    )}
                  </div>
                  <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-400 mb-2 gap-4">
                    {typeof property.size === 'number' && (
                      <span>{property.size} sqft</span>
                    )}
                    {typeof property.bedrooms === 'number' && (
                      <span>{property.bedrooms} bed</span>
                    )}
                    {typeof property.bathrooms === 'number' && (
                      <span>{property.bathrooms} bath</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                      ${property.price?.toLocaleString()}<span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">/month</span>
                    </div>
                    {property.rating && (
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="ml-1 text-sm text-neutral-600 dark:text-neutral-400">{property.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerProperties;
