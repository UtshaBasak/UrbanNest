import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, Users, Building2, ChevronRight, Home as HomeIcon, Plus } from 'lucide-react';
import { getProperties, getTopRatedProperties, getSuggestedProperties, getProperty } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [featuredProperties, setFeaturedProperties] = useState([]);
  const [latestProperties, setLatestProperties] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [loadingRecentlyViewed, setLoadingRecentlyViewed] = useState(true);
  const [stats] = useState({
    properties: 150,
    owners: 45,
    tenants: 320,
    reviews: 890
  });
  const [loading, setLoading] = useState(true);
  const [loadingLatest, setLoadingLatest] = useState(true);

  // Fetch recently viewed properties from localStorage
  useEffect(() => {
    const fetchRecentlyViewed = async () => {
      setLoadingRecentlyViewed(true);
      try {
        const key = 'recentlyViewedProperties';
        let arr = [];
        const raw = localStorage.getItem(key);
        if (raw) {
          arr = JSON.parse(raw);
        }
        // Remove duplicates and falsy
        arr = Array.from(new Set(arr)).filter(Boolean);
        if (arr.length === 0) {
          setRecentlyViewed([]);
          setLoadingRecentlyViewed(false);
          return;
        }
        // Fetch property details for each id (in parallel)
        const results = await Promise.all(
          arr.map(async (pid) => {
            try {
              const res = await getProperty(pid);
              return res.data?.property || null;
            } catch {
              return null;
            }
          })
        );
        setRecentlyViewed(results.filter(Boolean));
      } catch {
        setRecentlyViewed([]);
      } finally {
        setLoadingRecentlyViewed(false);
      }
    };
    fetchRecentlyViewed();
  }, []);

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      try {
        if (user) {
          // Try to fetch suggested properties for logged-in user
          const response = await getSuggestedProperties();
          const list = Array.isArray(response.data) ? response.data : [];
          setFeaturedProperties(list.slice(0, 6));
        } else {
          // Fallback: fetch top-rated properties for guests
          const response = await getTopRatedProperties({ limit: 100, minReviews: 1 });
          const list = Array.isArray(response.data?.properties) ? response.data.properties : [];
          if (list.length === 0) {
            setFeaturedProperties([]);
            return;
          }
          // Compute max rating using averageRating, fallback to rating
          const getAvg = (p) => (typeof p.averageRating === 'number' ? p.averageRating : (typeof p.rating === 'number' ? p.rating : null));
          const ratings = list.map(getAvg).filter((v) => typeof v === 'number');
          if (ratings.length === 0) {
            setFeaturedProperties([]);
            return;
          }
          const max = Math.max(...ratings);
          const eps = 1e-6;
          const maxRated = list.filter((p) => {
            const r = getAvg(p);
            return typeof r === 'number' && Math.abs(r - max) < eps;
          }).slice(0, 6);
          setFeaturedProperties(maxRated);
        }
      } catch (error) {
        console.error('Error fetching featured/suggested properties:', error);
        setFeaturedProperties([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const fetchLatest = async () => {
      setLoadingLatest(true);
      try {
        const response = await getProperties({ sortBy: 'createdAt', sortOrder: 'desc', limit: 6 });
        const list = Array.isArray(response.data?.properties) ? response.data.properties : [];
        setLatestProperties(list);
      } catch (error) {
        setLatestProperties([]);
      } finally {
        setLoadingLatest(false);
      }
    };
    fetchLatest();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 py-20 px-4 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200/30 dark:bg-primary-800/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-200/30 dark:bg-secondary-800/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-12">
            <h6 className="text-5xl md:text-7xl font-bold mb-6 gradient-text animate-fade-in">
                UrbanNest
            </h6>
            <h6 className="text-5xl md:text-7xl font-bold mb-6 gradient-text animate-fade-in">
                Rent Your Property
            </h6>
            <p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-300 mb-8 max-w-3xl mx-auto animate-slide-up">
              One stop solution for all your property needs
            </p>
            
            {/* Card-style CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-8 justify-center items-center animate-slide-up max-w-2xl mx-auto">
              <Link
                to="/properties"
                className="group bg-white dark:bg-neutral-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center hover:scale-105 w-full sm:w-auto min-w-[250px]"
              >
                <div className="bg-primary-100 dark:bg-primary-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                  <Search className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                  Search for Properties
                </h3>
              </Link>
              
              <button
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                    return;
                  }
                  if (user.role === 'owner' || user.role === 'admin') {
                    navigate('/properties/new');
                  } else {
                    alert('Only owners can list properties. You can manage your profile in Settings.');
                    navigate('/profile-settings');
                  }
                }}
                className="group bg-white dark:bg-neutral-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center hover:scale-105 w-full sm:w-auto min-w-[250px]"
              >
                <div className="bg-secondary-100 dark:bg-secondary-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                  <Plus className="w-8 h-8 text-secondary-600 dark:text-secondary-400" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                  Add Your Property
                </h3>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              {user ? 'Suggested Properties for You' : 'Featured Properties'}
            </h2>
            <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
              {user
                ? 'Personalized suggestions based on your favorites and bookings.'
                : 'Discover handpicked properties - Personalized based on your activity'}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-48 bg-neutral-200 dark:bg-neutral-700 rounded-t-xl"></div>
                  <div className="p-6">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded mb-2"></div>
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProperties.map((property) => (
                <Link
                  key={property._id}
                  to={`/properties/${property._id}`}
                  className="card group hover:scale-105 transition-all duration-300"
                >
                  <div className="relative overflow-hidden rounded-t-xl">
                    <img
                      src={property.images?.[0] || '/api/placeholder/400/300'}
                      alt={property.title}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute top-4 left-4">
                      {(() => {
                        const status = property.availabilityStatus || property.availability || 'Available';
                        const cls = `status-${String(status).toLowerCase().split(' ').join('-')}`;
                        return (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${cls}`}>
                            {status}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {property.title}
                      </h3>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                          ${property.price}
                        </div>
                        <div className="text-sm text-neutral-500">/month</div>
                      </div>
                    </div>
                    {typeof property.averageRating === 'number' && property.totalReviews > 0 && (
                      <div className="flex items-center gap-1 text-sm text-yellow-500 mb-2">
                        <Star className="w-4 h-4" />
                        <span>{property.averageRating.toFixed(1)} ({property.totalReviews})</span>
                      </div>
                    )}
                    
                    <div className="flex items-center text-neutral-600 dark:text-neutral-400 mb-2">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span className="text-sm truncate">{property.location}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400 mb-3">
                      {property.owner?.name && (
                        <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700">Owned by {property.owner.name}</span>
                      )}
                      {property.currentTenant?.name && (
                        <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700">Tenant: {property.currentTenant.name}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
                      <span>
                        {typeof property.bedrooms === 'number' ? `${property.bedrooms} bed` : ''}
                        {typeof property.bathrooms === 'number' ? `${typeof property.bedrooms === 'number' ? ' • ' : ''}${property.bathrooms} bath` : ''}
                      </span>
                      <span>
                        {typeof property.size === 'number' ? `${property.size} sqft` : ''}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Removed 'View All Properties' button as requested */}
        </div>
      </section>

      {/* Latest Properties Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Latest Properties
            </h2>
            <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
              Check out the newest properties added to UrbanNest.
            </p>
          </div>
          {loadingLatest ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-48 bg-neutral-200 dark:bg-neutral-700 rounded-t-xl"></div>
                  <div className="p-6">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded mb-2"></div>
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {latestProperties.map((property) => (
                <Link
                  key={property._id}
                  to={`/properties/${property._id}`}
                  className="card group hover:scale-105 transition-all duration-300"
                >
                  <div className="relative overflow-hidden rounded-t-xl">
                    <img
                      src={property.images?.[0] || '/api/placeholder/400/300'}
                      alt={property.title}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute top-4 left-4">
                      {(() => {
                        const status = property.availabilityStatus || property.availability || 'Available';
                        const cls = `status-${String(status).toLowerCase().split(' ').join('-')}`;
                        return (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${cls}`}>
                            {status}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {property.title}
                      </h3>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                          ${property.price}
                        </div>
                        <div className="text-sm text-neutral-500">/month</div>
                      </div>
                    </div>
                    {typeof property.averageRating === 'number' && property.totalReviews > 0 && (
                      <div className="flex items-center gap-1 text-sm text-yellow-500 mb-2">
                        <Star className="w-4 h-4" />
                        <span>{property.averageRating.toFixed(1)} ({property.totalReviews})</span>
                      </div>
                    )}
                    <div className="flex items-center text-neutral-600 dark:text-neutral-400 mb-2">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span className="text-sm truncate">{property.location}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400 mb-3">
                      {property.owner?.name && (
                        <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700">Owned by {property.owner.name}</span>
                      )}
                      {property.currentTenant?.name && (
                        <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700">Tenant: {property.currentTenant.name}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
                      <span>
                        {typeof property.bedrooms === 'number' ? `${property.bedrooms} bed` : ''}
                        {typeof property.bathrooms === 'number' ? `${typeof property.bedrooms === 'number' ? ' • ' : ''}${property.bathrooms} bath` : ''}
                      </span>
                      <span>
                        {typeof property.size === 'number' ? `${property.size} sqft` : ''}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recently Viewed Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Recently Viewed
            </h2>
            <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
              Properties you have recently viewed will appear here.
            </p>
          </div>
          {loadingRecentlyViewed ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-48 bg-neutral-200 dark:bg-neutral-700 rounded-t-xl"></div>
                  <div className="p-6">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded mb-2"></div>
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentlyViewed.length === 0 ? (
            <div className="text-center text-neutral-500 dark:text-neutral-400 text-lg">No recently viewed properties yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {recentlyViewed.map((property) => (
                <Link
                  key={property._id}
                  to={`/properties/${property._id}`}
                  className="card group hover:scale-105 transition-all duration-300"
                >
                  <div className="relative overflow-hidden rounded-t-xl">
                    <img
                      src={property.images?.[0] || '/api/placeholder/400/300'}
                      alt={property.title}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute top-4 left-4">
                      {(() => {
                        const status = property.availabilityStatus || property.availability || 'Available';
                        const cls = `status-${String(status).toLowerCase().split(' ').join('-')}`;
                        return (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${cls}`}>
                            {status}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {property.title}
                      </h3>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                          ${property.price}
                        </div>
                        <div className="text-sm text-neutral-500">/month</div>
                      </div>
                    </div>
                    {typeof property.averageRating === 'number' && property.totalReviews > 0 && (
                      <div className="flex items-center gap-1 text-sm text-yellow-500 mb-2">
                        <Star className="w-4 h-4" />
                        <span>{property.averageRating.toFixed(1)} ({property.totalReviews})</span>
                      </div>
                    )}
                    <div className="flex items-center text-neutral-600 dark:text-neutral-400 mb-2">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span className="text-sm truncate">{property.location}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400 mb-3">
                      {property.owner?.name && (
                        <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700">Owned by {property.owner.name}</span>
                      )}
                      {property.currentTenant?.name && (
                        <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700">Tenant: {property.currentTenant.name}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
                      <span>
                        {typeof property.bedrooms === 'number' ? `${property.bedrooms} bed` : ''}
                        {typeof property.bathrooms === 'number' ? `${typeof property.bedrooms === 'number' ? ' • ' : ''}${property.bathrooms} bath` : ''}
                      </span>
                      <span>
                        {typeof property.size === 'number' ? `${property.size} sqft` : ''}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-[#131e2a] text-white pt-12 pb-4 mt-16">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-12">
            {/* UrbanNest Info */}
            <div className="md:w-1/4 mb-8 md:mb-0 flex flex-col items-center md:items-start">
              <h2 className="text-3xl font-bold mb-2 text-white">UrbanNest</h2>
              <p className="text-gray-300 text-lg">One stop solution for all your property needs</p>
            </div>
            {/* Address */}
            <div className="md:w-1/4 mb-8 md:mb-0">
              <h2 className="text-2xl font-bold mb-2">Address</h2>
              <p className="text-lg text-gray-200">Kha 224 Pragati Sarani,</p>
              <p className="text-lg text-gray-200"> Merul Badda, Dhaka 1212, Bangladesh</p>
            </div>
            {/* Help */}
            <div className="md:w-1/5">
              <h2 className="text-2xl font-bold mb-2">Help</h2>
              <p className="mb-2 text-lg text-gray-200">Contact Us</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-5 h-5 bg-purple-200 rounded-sm items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-purple-700"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L2.32 8.91A2.25 2.25 0 011.25 6.993V6.75" /></svg>
                </span>
                <span className="text-lg">info@urbannest.com</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-5 h-5 bg-pink-200 rounded-sm items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-pink-700"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0-1.243 1.007-2.25 2.25-2.25h15a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75zm0 0l9.72 6.48a2.25 2.25 0 002.36 0L22.5 6.75" /></svg>
                </span>
                <span className="text-lg">+88 01234567890</span>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-gray-700 pt-6 flex flex-col md:flex-row items-center justify-between">
            <p className="text-gray-300 text-lg">Copyright © 2025 UrbanNest. All rights reserved.</p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="bg-blue-500 hover:bg-blue-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg mt-6 md:mt-0 transition-all"
              aria-label="Back to top"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;