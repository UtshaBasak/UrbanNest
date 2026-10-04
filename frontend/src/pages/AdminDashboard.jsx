import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Building2, 
  Trash2, 
  Search,
  Eye,
  Star,
  Phone,
  Mail,
  MapPin,
  Home,
  UserCheck,
  UserX,
  BarChart3
} from 'lucide-react';
import { 
  getAdminStats,
  getOwners,
  getTenants, 
  getAdminProperties,
  deleteUserById,
  deletePropertyById,
  getAdminReviews,
  deleteReviewById
} from '../utils/api';

// SearchBar component defined outside to prevent re-creation on each render
const SearchBar = ({ placeholder, value, onChange, onSearch }) => (
  <div className="relative mb-4">
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyPress={(e) => e.key === 'Enter' && onSearch()}
      className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
    />
    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
    <button
      onClick={onSearch}
      className="absolute right-2 top-1.5 px-3 py-1 bg-blue-500 text-white rounded-sm hover:bg-blue-600 transition-colors"
    >
      Search
    </button>
  </div>
);

// Static class maps so Tailwind can detect every class at build time
const STAT_CARD_COLORS = {
  blue: { border: 'border-blue-500', text: 'text-blue-500' },
  green: { border: 'border-green-500', text: 'text-green-500' },
  purple: { border: 'border-purple-500', text: 'text-purple-500' },
  orange: { border: 'border-orange-500', text: 'text-orange-500' },
  red: { border: 'border-red-500', text: 'text-red-500' },
  yellow: { border: 'border-yellow-500', text: 'text-yellow-500' }
};

// StatCard component defined outside to prevent re-creation on each render
const StatCard = ({ title, value, icon: Icon, color = 'blue' }) => {
  const colorClasses = STAT_CARD_COLORS[color] || STAT_CARD_COLORS.blue;
  return (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 ${colorClasses.border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <Icon className={`h-8 w-8 ${colorClasses.text}`} />
      </div>
    </div>
  );
};

// Pagination controls for admin tables
const PaginationControls = ({ pagination, onPageChange }) => {
  if (!pagination) return null;
  const page = pagination.page || 1;
  const pages = Math.max(pagination.pages || 1, 1);
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Prev
      </button>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Page {page} of {pages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
};

const PAGE_SIZE = 20;

const TAB_FETCHERS = {
  owners: getOwners,
  tenants: getTenants,
  properties: getAdminProperties,
  reviews: getAdminReviews
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [data, setData] = useState({
    owners: [],
    tenants: [],
    properties: [],
    reviews: []
  });
  const [paginations, setPaginations] = useState({
    owners: null,
    tenants: null,
    properties: null,
    reviews: null
  });
  const [pages, setPages] = useState({
    owners: 1,
    tenants: 1,
    properties: 1,
    reviews: 1
  });
  const [searchTerms, setSearchTerms] = useState({
    owners: '',
    tenants: '',
    properties: '',
    reviews: ''
  });

  // Debounced search with useRef to maintain timeout reference
  const searchTimeouts = React.useRef({});

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(searchTimeouts.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Fetch one tab's list with the given search term and page
  const fetchTab = async (type, search = '', page = 1) => {
    const params = { page, limit: PAGE_SIZE };
    if (search.trim()) params.search = search.trim();
    const result = await TAB_FETCHERS[type](params);
    const items = result?.data?.[type] || [];
    const pagination = result?.data?.pagination || null;

    // If the page became empty (e.g. after deleting its last item), step back one page
    if (items.length === 0 && page > 1) {
      return fetchTab(type, search, page - 1);
    }

    setData(prev => ({ ...prev, [type]: items }));
    setPaginations(prev => ({ ...prev, [type]: pagination }));
    setPages(prev => ({ ...prev, [type]: page }));
  };

  const fetchStats = async () => {
    try {
      const statsRes = await getAdminStats();
      setStats(statsRes?.data?.stats || {});
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      await Promise.allSettled([
        fetchStats(),
        ...Object.keys(TAB_FETCHERS).map((type) =>
          fetchTab(type, searchTerms[type], pages[type]).catch((error) => {
            console.error(`Error fetching ${type}:`, error);
          })
        )
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Refetch the given tab (and stats) keeping its current search term and page
  const refreshTab = async (type) => {
    await Promise.allSettled([
      fetchStats(),
      fetchTab(type, searchTerms[type], pages[type]).catch((error) => {
        console.error(`Error refreshing ${type}:`, error);
      })
    ]);
  };

  const handlePageChange = async (type, page) => {
    try {
      await fetchTab(type, searchTerms[type], page);
    } catch (error) {
      console.error('Error changing page:', error);
    }
  };

  const handleDeleteUser = async (userId, userType) => {
    if (window.confirm(`Are you sure you want to delete this ${userType}? This action cannot be undone and will delete all related data.`)) {
      try {
        await deleteUserById(userId);
        await refreshTab(userType === 'owner' ? 'owners' : 'tenants');
        alert(`${userType} deleted successfully`);
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleDeleteProperty = async (propertyId) => {
    if (window.confirm('Are you sure you want to delete this property? This action cannot be undone and will delete all related bookings and reviews.')) {
      try {
        await deletePropertyById(propertyId);
        await refreshTab('properties');
        alert('Property deleted successfully');
      } catch (error) {
        console.error('Error deleting property:', error);
        alert('Failed to delete property: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleDeleteReview = async (reviewId, reviewType) => {
    if (window.confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      try {
        await deleteReviewById(reviewId, reviewType);
        await refreshTab('reviews');
        alert('Review deleted successfully');
      } catch (error) {
        console.error('Error deleting review:', error);
        alert('Failed to delete review: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleSearch = async (searchType) => {
    // Cancel any pending debounced search for this type
    if (searchTimeouts.current[searchType]) {
      clearTimeout(searchTimeouts.current[searchType]);
    }
    try {
      // A new search always starts at page 1
      await fetchTab(searchType, searchTerms[searchType], 1);
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  const updateSearchTerm = (type, value) => {
    setSearchTerms(prev => ({ ...prev, [type]: value }));

    // Clear existing timeout for this search type
    if (searchTimeouts.current[type]) {
      clearTimeout(searchTimeouts.current[type]);
    }

    // Set new timeout for debounced search (works for owners, tenants, properties and reviews;
    // an empty value refetches all data for that type)
    searchTimeouts.current[type] = setTimeout(async () => {
      try {
        await fetchTab(type, value, 1);
      } catch (error) {
        console.error('Error searching:', error);
      }
    }, 300); // 300ms delay
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage users and properties</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex gap-8">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'owners', label: 'Owner Information', icon: UserCheck },
              { id: 'tenants', label: 'Tenant Information', icon: UserX },
              { id: 'properties', label: 'Property Information', icon: Building2 },
              { id: 'reviews', label: 'Reviews', icon: Star }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center px-3 py-2 border-b-2 font-medium text-sm ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard title="Total Users" value={stats.totalUsers || 0} icon={Users} color="blue" />
            <StatCard title="Total Owners" value={stats.totalOwners || 0} icon={UserCheck} color="green" />
            <StatCard title="Total Tenants" value={stats.totalTenants || 0} icon={UserX} color="purple" />
            <StatCard title="Total Properties" value={stats.totalProperties || 0} icon={Building2} color="orange" />
            <StatCard title="Active Bookings" value={stats.totalBookings || 0} icon={Home} color="red" />
            <StatCard title="Total Reviews" value={stats.totalReviews || 0} icon={Star} color="yellow" />
          </div>
        )}

        {/* Owners Tab */}
        {activeTab === 'owners' && (
          <div>
            <SearchBar
              placeholder="Search owners by name, email, or phone..."
              value={searchTerms.owners}
              onChange={(value) => updateSearchTerm('owners', value)}
              onSearch={() => handleSearch('owners')}
            />
            
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Owner Information</h3>
              </div>
              <div className="overflow-x-auto admin-table-scroll">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Owner</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Properties</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rating</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.owners.map((owner) => (
                      <tr key={owner._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="shrink-0 h-10 w-10">
                              <img
                                className="h-10 w-10 rounded-full object-cover"
                                src={owner.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(owner.name)}&background=3B82F6&color=fff`}
                                alt={owner.name}
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{owner.name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">ID: {owner._id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 mr-2 text-gray-400" />
                              {owner.email}
                            </div>
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {owner.phone}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {owner.propertyCount || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-400 mr-1" />
                            {owner.avgRating ? owner.avgRating.toFixed(1) : 'N/A'}
                            {owner.ratingCount > 0 && (
                              <span className="text-gray-500 dark:text-gray-400 ml-1">({owner.ratingCount})</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDeleteUser(owner._id, 'owner')}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls pagination={paginations.owners} onPageChange={(page) => handlePageChange('owners', page)} />
            </div>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div>
            <SearchBar
              placeholder="Search tenants by name, email, or phone..."
              value={searchTerms.tenants}
              onChange={(value) => updateSearchTerm('tenants', value)}
              onSearch={() => handleSearch('tenants')}
            />
            
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tenant Information</h3>
              </div>
              <div className="overflow-x-auto admin-table-scroll">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tenant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rating</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.tenants.map((tenant) => (
                      <tr key={tenant._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="shrink-0 h-10 w-10">
                              <img
                                className="h-10 w-10 rounded-full object-cover"
                                src={tenant.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(tenant.name)}&background=8B5CF6&color=fff`}
                                alt={tenant.name}
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{tenant.name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">ID: {tenant._id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 mr-2 text-gray-400" />
                              {tenant.email}
                            </div>
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {tenant.phone}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-400 mr-1" />
                            {tenant.avgRating ? tenant.avgRating.toFixed(1) : 'N/A'}
                            {tenant.ratingCount > 0 && (
                              <span className="text-gray-500 dark:text-gray-400 ml-1">({tenant.ratingCount})</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDeleteUser(tenant._id, 'tenant')}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls pagination={paginations.tenants} onPageChange={(page) => handlePageChange('tenants', page)} />
            </div>
          </div>
        )}

        {/* Properties Tab */}
        {activeTab === 'properties' && (
          <div>
            <SearchBar
              placeholder="Search properties by title, description, type, status or location..."
              value={searchTerms.properties}
              onChange={(value) => updateSearchTerm('properties', value)}
              onSearch={() => handleSearch('properties')}
            />
            
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Property Information</h3>
              </div>
              
              {/* Fixed height container with sticky scrollbar */}
              <div className="relative">
                <div className="overflow-x-auto admin-table-scroll max-h-[70vh]" style={{ paddingBottom: '20px' }}>
                  <div className="min-w-[1200px]">
                    <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ minWidth: '280px' }}>Property</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ minWidth: '200px' }}>Owner</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ minWidth: '140px' }}>Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ minWidth: '150px' }}>Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ minWidth: '130px' }}>Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ minWidth: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.properties.map((property) => (
                      <tr key={property._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="shrink-0 h-10 w-10">
                              <img
                                className="h-10 w-10 rounded-sm object-cover"
                                src={property.images?.[0] || '/placeholder-property.jpg'}
                                alt={property.title}
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{property.title}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                ID: {property.propertyId || property._id.slice(-8).toUpperCase()}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {property.bedrooms}BR • {property.bathrooms}BA • {property.size} sqft
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div>
                            <div className="font-medium">{property.owner?.name}</div>
                            <div className="text-gray-500 dark:text-gray-400">{property.owner?.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            {property.type || property.propertyType || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          ৳{property.price?.toLocaleString()}/month
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            property.availabilityStatus === 'available' || property.availabilityStatus === 'Available'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                          }`}>
                            {property.availabilityStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDeleteProperty(property._id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
              </div>
              <PaginationControls pagination={paginations.properties} onPageChange={(page) => handlePageChange('properties', page)} />
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div>
            <SearchBar
              placeholder="Search reviews by reviewer email, target email, property name or comment..."
              value={searchTerms.reviews}
              onChange={(value) => updateSearchTerm('reviews', value)}
              onSearch={() => handleSearch('reviews')}
            />
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">All Reviews</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage property reviews and user ratings
                </p>
              </div>
              
              {/* Fixed height container with sticky scrollbar */}
              <div className="relative">
                <div className="overflow-x-auto admin-table-scroll max-h-[70vh]" style={{ paddingBottom: '20px' }}>
                  <div className="min-w-[1400px]">
                    <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" style={{ minWidth: '150px' }}>
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" style={{ minWidth: '200px' }}>
                        Reviewer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" style={{ minWidth: '200px' }}>
                        Target
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" style={{ minWidth: '100px' }}>
                        Rating
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" style={{ minWidth: '300px' }}>
                        Comment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" style={{ minWidth: '120px' }}>
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" style={{ minWidth: '100px' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.reviews.map((review) => (
                      <tr key={`${review.type}-${review._id}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            review.type === 'property' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            review.targetType === 'Owner' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          }`}>
                            {review.type === 'property' ? 'Property' : `${review.targetType} Rating`}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div>
                            <div className="font-medium">{review.reviewer?.name || 'Unknown'}</div>
                            <div className="text-gray-500 dark:text-gray-400">{review.reviewer?.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div>
                            {review.type === 'property' ? (
                              <>
                                <div className="font-medium">{review.target?.title || 'Unknown Property'}</div>
                                <div className="text-gray-500 dark:text-gray-400">{review.target?.location}</div>
                              </>
                            ) : (
                              <>
                                <div className="font-medium">{review.target?.name || 'Unknown User'}</div>
                                <div className="text-gray-500 dark:text-gray-400">{review.target?.email}</div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-400 mr-1" />
                            <span>{review.rating}/5</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs">
                          <div className="truncate" title={review.comment}>
                            {review.comment || 'No comment'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDeleteReview(review._id, review.type)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete Review"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <PaginationControls pagination={paginations.reviews} onPageChange={(page) => handlePageChange('reviews', page)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
