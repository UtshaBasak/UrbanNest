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
  deletePropertyById 
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
      className="absolute right-2 top-1.5 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
    >
      Search
    </button>
  </div>
);

// StatCard component defined outside to prevent re-creation on each render
const StatCard = ({ title, value, icon: Icon, color = 'blue' }) => (
  <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-${color}-500`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
      <Icon className={`h-8 w-8 text-${color}-500`} />
    </div>
  </div>
);

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [data, setData] = useState({
    owners: [],
    tenants: [],
    properties: []
  });
  const [searchTerms, setSearchTerms] = useState({
    owners: '',
    tenants: '',
    properties: ''
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchAdminData();
  }, [refreshKey]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(searchTimeouts.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, ownersRes, tenantsRes, propertiesRes] = await Promise.allSettled([
        getAdminStats(),
        getOwners(),
        getTenants(),
        getAdminProperties()
      ]);

      setStats(statsRes.status === 'fulfilled' ? statsRes.value.data.stats : {});
      setData({
        owners: ownersRes.status === 'fulfilled' ? ownersRes.value.data.owners : [],
        tenants: tenantsRes.status === 'fulfilled' ? tenantsRes.value.data.tenants : [],
        properties: propertiesRes.status === 'fulfilled' ? propertiesRes.value.data.properties : []
      });
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userType) => {
    if (window.confirm(`Are you sure you want to delete this ${userType}? This action cannot be undone and will delete all related data.`)) {
      try {
        await deleteUserById(userId);
        setRefreshKey(prev => prev + 1);
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
        setRefreshKey(prev => prev + 1);
        alert('Property deleted successfully');
      } catch (error) {
        console.error('Error deleting property:', error);
        alert('Failed to delete property: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleSearch = async (searchType) => {
    try {
      const searchTerm = searchTerms[searchType];
      let result;
      
      switch (searchType) {
        case 'owners':
          result = await getOwners({ search: searchTerm });
          setData(prev => ({ ...prev, owners: result.data.owners }));
          break;
        case 'tenants':
          result = await getTenants({ search: searchTerm });
          setData(prev => ({ ...prev, tenants: result.data.tenants }));
          break;
        case 'properties':
          result = await getAdminProperties({ search: searchTerm });
          setData(prev => ({ ...prev, properties: result.data.properties }));
          break;
      }
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  // Debounced search with useRef to maintain timeout reference
  const searchTimeouts = React.useRef({});

  const updateSearchTerm = (type, value) => {
    setSearchTerms(prev => ({ ...prev, [type]: value }));
    
    // Clear existing timeout for this search type
    if (searchTimeouts.current[type]) {
      clearTimeout(searchTimeouts.current[type]);
    }

    // Set new timeout for debounced search
    searchTimeouts.current[type] = setTimeout(async () => {
      try {
        if (value.trim()) {
          let result;
          switch (type) {
            case 'owners':
              result = await getOwners({ search: value });
              setData(prev => ({ ...prev, owners: result.data.owners }));
              break;
            case 'tenants':
              result = await getTenants({ search: value });
              setData(prev => ({ ...prev, tenants: result.data.tenants }));
              break;
            case 'properties':
              result = await getAdminProperties({ search: value });
              setData(prev => ({ ...prev, properties: result.data.properties }));
              break;
          }
        } else {
          // If search term is empty, refetch all data for that type
          let result;
          switch (type) {
            case 'owners':
              result = await getOwners();
              setData(prev => ({ ...prev, owners: result.data.owners }));
              break;
            case 'tenants':
              result = await getTenants();
              setData(prev => ({ ...prev, tenants: result.data.tenants }));
              break;
            case 'properties':
              result = await getAdminProperties();
              setData(prev => ({ ...prev, properties: result.data.properties }));
              break;
          }
        }
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
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'owners', label: 'Owner Information', icon: UserCheck },
              { id: 'tenants', label: 'Tenant Information', icon: UserX },
              { id: 'properties', label: 'Property Information', icon: Building2 }
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
            <StatCard title="Total Bookings" value={stats.totalBookings || 0} icon={Home} color="red" />
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
                            <div className="flex-shrink-0 h-10 w-10">
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
                            <div className="flex-shrink-0 h-10 w-10">
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
            </div>
          </div>
        )}

        {/* Properties Tab */}
        {activeTab === 'properties' && (
          <div>
            <SearchBar
              placeholder="Search properties by title, description, or location..."
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
                            <div className="flex-shrink-0 h-10 w-10">
                              <img
                                className="h-10 w-10 rounded object-cover"
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
