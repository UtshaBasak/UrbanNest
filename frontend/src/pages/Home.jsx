import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, Users, Building2, ChevronRight, Home as HomeIcon, Plus } from 'lucide-react';
import { getProperties, getTopRatedProperties } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [featuredProperties, setFeaturedProperties] = useState([]);
  const [stats] = useState({
    properties: 150,
    owners: 45,
    tenants: 320,
    reviews: 890
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedProperties();
  }, []);

  const fetchFeaturedProperties = async () => {
    try {
      // Fetch a larger pool to ensure we capture all items that might share the same max rating
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
    } catch (error) {
      console.error('Error fetching featured properties:', error);
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-5xl md:text-7xl font-bold mb-6 gradient-text animate-fade-in">
                Find Your Perfect Home
            </h1>
            <p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-300 mb-8 max-w-3xl mx-auto animate-slide-up">
              Discover amazing rental properties from trusted owners, or list your own property and connect with reliable tenants with UrbanNest.
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
                  Browse Properties
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                  Discover amazing rental properties from trusted owners
                </p>
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
                  List Your Property
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                  Connect with reliable tenants and earn rental income
                </p>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white dark:bg-neutral-800 border-y border-neutral-200 dark:border-neutral-700">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="bg-primary-100 dark:bg-primary-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                <Building2 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                {stats.properties}+
              </div>
              <div className="text-neutral-600 dark:text-neutral-400">Properties</div>
            </div>
            
            <div className="text-center group">
              <div className="bg-secondary-100 dark:bg-secondary-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                <Users className="w-8 h-8 text-secondary-600 dark:text-secondary-400" />
              </div>
              <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                {stats.owners}+
              </div>
              <div className="text-neutral-600 dark:text-neutral-400">Property Owners</div>
            </div>
            
            <div className="text-center group">
              <div className="bg-accent-100 dark:bg-accent-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                <Users className="w-8 h-8 text-accent-600 dark:text-accent-400" />
              </div>
              <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                {stats.tenants}+
              </div>
              <div className="text-neutral-600 dark:text-neutral-400">Happy Tenants</div>
            </div>
            
            <div className="text-center group">
              <div className="bg-warning-100 dark:bg-warning-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                <Star className="w-8 h-8 text-warning-600 dark:text-warning-400" />
              </div>
              <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                {stats.reviews}+
              </div>
              <div className="text-neutral-600 dark:text-neutral-400">Reviews</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Featured Properties
            </h2>
            <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
              Discover handpicked properties that offer the best value and amenities for your next home.
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

      {/* How It Works */}
      <section className="py-20 bg-neutral-50 dark:bg-neutral-800 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              How UrbanNest Works
            </h2>
            <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
              Simple steps to find your perfect rental or list your property
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="bg-primary-100 dark:bg-primary-900/30 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-200">
                <Search className="w-10 h-10 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
                Search & Discover
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Browse through our curated collection of rental properties using smart filters and interactive maps.
              </p>
            </div>

            <div className="text-center group">
              <div className="bg-secondary-100 dark:bg-secondary-900/30 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-200">
                <Users className="w-10 h-10 text-secondary-600 dark:text-secondary-400" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
                Connect & Book
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Send booking requests directly to property owners and communicate securely through our platform.
              </p>
            </div>

            <div className="text-center group">
              <div className="bg-accent-100 dark:bg-accent-900/30 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-200">
                <Building2 className="w-10 h-10 text-accent-600 dark:text-accent-400" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
                Move In & Review
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Complete your rental process and share your experience to help our community grow.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;