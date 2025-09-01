import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Star, Filter, Search, Grid, List, ChevronDown } from 'lucide-react';
import { getProperties } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Properties = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    search: '',
    minPrice: '',
    maxPrice: '',
    availabilityStatus: '', 
    sortBy: 'createdAt'
  });
  const [draftFilters, setDraftFilters] = useState({
    search: '',
    minPrice: '',
    maxPrice: '',
    availabilityStatus: '',
    sortBy: 'createdAt'
  });
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, [filters]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const response = await getProperties(filters);
      setProperties(response.data.properties || []);
    } catch (error) {
      setError('Failed to fetch properties');
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  

  const handleDraftChange = (key, value) => {
    setDraftFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setFilters({ ...draftFilters });
  };

  const clearFilters = () => {
    const cleared = {
      search: '',
      minPrice: '',
      maxPrice: '',
      availabilityStatus: '',
      sortBy: 'createdAt'
    };
    setDraftFilters(cleared);
    setFilters(cleared);
  };

  const getAvailabilityColor = (status) => {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Booked':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Under Construction':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Pre-booking Available':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-4">
                  <div className="h-48 bg-neutral-200 dark:bg-neutral-700 rounded mb-4"></div>
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded mb-2"></div>
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4 sm:mb-0">
            Properties
          </h1>
          <div className="flex items-center space-x-4">
            {user?.role === 'owner' && (
              <button
                onClick={() => navigate('/properties/new')}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                + Add Property
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 rounded-lg border transition-colors bg-white text-neutral-800 hover:bg-neutral-50 border-neutral-300 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600 dark:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <Filter className="h-4 w-4 mr-2 text-current" />
              Filters
              <ChevronDown className={`h-4 w-4 ml-2 text-current transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            <div className="flex border border-neutral-300 dark:border-neutral-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-cyan-500 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-cyan-500 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    value={draftFilters.search}
                    onChange={(e) => handleDraftChange('search', e.target.value)}
                    placeholder="Search properties..."
                    className="w-full pl-10 pr-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Min Price
                </label>
                <input
                  type="number"
                  value={draftFilters.minPrice}
                  onChange={(e) => handleDraftChange('minPrice', e.target.value)}
                  placeholder="Min price"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Max Price
                </label>
                <input
                  type="number"
                  value={draftFilters.maxPrice}
                  onChange={(e) => handleDraftChange('maxPrice', e.target.value)}
                  placeholder="Max price"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Availability
                </label>
                <select
                  value={draftFilters.availabilityStatus || ''}
                  onChange={(e) => handleDraftChange('availabilityStatus', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">All</option>
                  <option value="Available">Available</option>
                  <option value="Booked">Booked</option>
                  <option value="Under Construction">Under Construction</option>
                  <option value="Pre-booking Available">Pre-booking Available</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Sort By
                </label>
                <select
                  value={draftFilters.sortBy}
                  onChange={(e) => handleDraftChange('sortBy', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="createdAt">Newest</option>
                  <option value="price">Price: Low to High</option>
                  <option value="-price">Price: High to Low</option>
                  <option value="rating">Rating</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-4 gap-2">
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Properties Grid/List */}
        {properties.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-neutral-400 dark:text-neutral-500 text-lg">
              No properties found matching your criteria.
            </div>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-6'}>
            {properties.map((property) => (
              <Link
                key={property._id}
                to={`/properties/${property._id}`}
                className={`bg-white dark:bg-neutral-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${
                  viewMode === 'list' ? 'flex' : 'block'
                }`}
              >
                <div className={(viewMode === 'list' ? 'w-1/3 ' : 'w-full ') + 'relative'}>
                  <img
                    src={property.images?.[0] || '/api/placeholder/400/300'}
                    alt={property.title}
                    className={`object-cover ${viewMode === 'list' ? 'h-full' : 'h-48'} w-full`}
                  />
                  <span
                    className={`absolute top-2 left-2 px-2 py-1 text-xs font-medium rounded-full shadow ${getAvailabilityColor(property.availabilityStatus || property.availability)}`}
                  >
                    {property.availabilityStatus || property.availability}
                  </span>
                </div>
                <div className={`p-6 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white line-clamp-1">
                      {property.title}
                    </h3>
                  </div>
                  {/* Rating row (match Home featured style) */}
                  {(() => {
                    // Check both averageRating and rating properties
                    const rating = typeof property.averageRating === 'number' 
                      ? property.averageRating 
                      : (typeof property.rating === 'number' ? property.rating : null);
                    
                    const count = property.totalReviews || 0;
                    
                    // Show rating if it exists and is greater than 0
                    if (rating && rating > 0) {
                      return (
                        <div className="flex items-center gap-1 text-sm text-yellow-500 mb-2">
                          <Star className="w-4 h-4 fill-current" />
                          <span>
                            {Number(rating).toFixed(1)}
                            {count > 0 ? ` (${count} review${count !== 1 ? 's' : ''})` : ''}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
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
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4 line-clamp-2">
                    {property.description}
                  </p>
                  <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-400 mb-3 gap-4">
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
                      ${property.price?.toLocaleString()}
                      <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">/month</span>
                    </div>
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

export default Properties;
