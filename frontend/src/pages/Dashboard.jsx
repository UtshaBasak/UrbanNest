import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Calendar, 
  Star, 
  Users, 
  Plus, 
  Eye, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  getPropertiesByOwner, 
  getMyBookings, 
  getMyReviews,
  getMyPropertiesReviews,
  updateBookingStatus,
  deleteProperty,
  deleteBooking,
  deleteReview
} from '../utils/api';
import AdminDashboard from './AdminDashboard';

// Helper function for booking status colors
const getBookingStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    case 'completed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300';
  }
};

const Dashboard = () => {
  const { user } = useAuth();
  
  // If user is admin, render admin dashboard
  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }
  
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState({
    properties: [],
    bookings: [],
    reviews: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalBookings: 0,
    totalReviews: 0
  });

  // Read query params for deep-link: tab
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) setActiveTab(tab);
  }, [location.search]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, refreshKey]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const promises = [];

      if (user.role === 'owner') {
        promises.push(getPropertiesByOwner(user._id || user.id));
        promises.push(getMyBookings());
        promises.push(getMyPropertiesReviews()); // Get reviews for owner's properties
      } else {
        promises.push(getMyBookings());
        promises.push(getMyReviews()); // Get reviews written by tenant
      }

      const results = await Promise.allSettled(promises);
      
      let properties = [];
      let bookings = [];
      let reviews = [];

      if (user.role === 'owner') {
        properties = results[0].status === 'fulfilled' ? results[0].value.data.properties || [] : [];
        bookings = results[1].status === 'fulfilled' ? results[1].value.data.bookings || [] : [];
        reviews = results[2].status === 'fulfilled' ? results[2].value.data.reviews || [] : [];
      } else {
        bookings = results[0].status === 'fulfilled' ? results[0].value.data.bookings || [] : [];
        reviews = results[1].status === 'fulfilled' ? results[1].value.data.reviews || [] : [];
      }

      setData({ properties, bookings, reviews });
      
      // Calculate stats
      setStats({
        totalProperties: properties.length,
        totalBookings: bookings.length,
        totalReviews: reviews.length
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingStatusUpdate = async (bookingId, status) => {
    try {
      await updateBookingStatus(bookingId, status);
      fetchDashboardData(); // Refresh data
      if (status === 'approved') {
        alert('Booking approved successfully!');
      } else if (status === 'rejected') {
        alert('Booking rejected successfully!');
      }
    } catch (error) {
      console.error('Error updating booking status:', error);
      // Show specific conflict message if available
      const errorMessage = error?.message || 'Failed to update booking status';
      alert(errorMessage);
    }
  };

  const handleDeleteProperty = async (propertyId) => {
    if (window.confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
      try {
        await deleteProperty(propertyId);
        fetchDashboardData(); // Refresh data
        alert('Property deleted successfully');
      } catch (error) {
        console.error('Error deleting property:', error);
        alert('Failed to delete property');
      }
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      try {
        await deleteBooking(bookingId);
        fetchDashboardData(); // Refresh data
        alert('Booking deleted successfully');
      } catch (error) {
        console.error('Error deleting booking:', error);
        alert('Failed to delete booking');
      }
    }
  };

  const getBookingStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded mb-2"></div>
                  <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
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
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Welcome back, {user?.name}!
            </p>
          </div>
          {user?.role === 'owner' && (
            <div className="mt-4 sm:mt-0 flex items-center gap-3">
              <Link
                to="/profile-settings"
                className="inline-flex items-center px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium rounded-lg transition-colors"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Link>
              <Link
                to="/properties/new"
                className="inline-flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Link>
              <Link
                to="/leave-requests"
                className="inline-flex items-center px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-medium rounded-lg transition-colors"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Manage Leave Requests
              </Link>
            </div>
          )}
          {user?.role === 'tenant' && (
            <div className="mt-4 sm:mt-0 flex items-center gap-3">
              <Link
                to="/profile-settings"
                className="inline-flex items-center px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium rounded-lg transition-colors"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Link>
              <Link
                to="/properties"
                className="inline-flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Book Property
              </Link>
              {/* Removed Make Monthly Payment button for tenant */}
              <Link
                to="/leave-requests/new"
                className="inline-flex items-center px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-medium rounded-lg transition-colors"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Request Leave
              </Link>
              <Link
                to="/leave-requests"
                className="inline-flex items-center px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium rounded-lg transition-colors"
              >
                My Leave Requests
              </Link>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {user?.role === 'owner' && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-900 rounded-lg">
                  <Building2 className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    My Properties
                  </p>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {stats.totalProperties}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  My Bookings
                </p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {stats.totalBookings}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <Star className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  {user.role === 'owner' ? 'Property Reviews' : 'My Reviews'}
                </p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {stats.totalReviews}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md">
          <div className="border-b border-neutral-200 dark:border-neutral-700">
            <nav className="flex space-x-8 px-6">
              {user?.role === 'owner' && (
                <button
                  onClick={() => setActiveTab('properties')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'properties'
                      ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                      : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
                >
                  My Properties
                </button>
              )}
              <button
                onClick={() => setActiveTab('bookings')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'bookings'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                {user?.role === 'owner' ? 'Booking Requests' : 'My Bookings'}
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'reviews'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                {user.role === 'owner' ? 'Property Reviews' : 'My Reviews'}
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Properties Tab */}
            {activeTab === 'properties' && user?.role === 'owner' && (
              <div className="space-y-4">
                {data.properties.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-500 dark:text-neutral-400">
                      You haven't added any properties yet.
                    </p>
                    <Link
                      to="/properties/new"
                      className="mt-4 inline-flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Property
                    </Link>
                  </div>
                ) : (
                  data.properties.map((property) => (
                    <div key={property._id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <img
                            src={property.images?.[0] || '/api/placeholder/100/100'}
                            alt={property.title}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <div>
                            <h3 className="font-medium text-neutral-900 dark:text-white">
                              {property.title}
                            </h3>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400">
                              {property.location}
                            </p>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400">
                              {(typeof property.size === 'number') && `${property.size} sqft`}
                              {(typeof property.bedrooms === 'number') && `${typeof property.size === 'number' ? ' • ' : ''}${property.bedrooms} bed`}
                              {(typeof property.bathrooms === 'number') && `${(typeof property.size === 'number' || typeof property.bedrooms === 'number') ? ' • ' : ''}${property.bathrooms} bath`}
                            </p>
                            <p className="text-lg font-semibold text-cyan-600 dark:text-cyan-400">
                              ${property.price?.toLocaleString()}/month
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/properties/${property._id}`}
                            className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-cyan-600 dark:hover:text-cyan-400"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            to={`/properties/${property._id}/edit`}
                            className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleDeleteProperty(property._id)}
                            className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              <div className="space-y-4">
                {data.bookings.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-500 dark:text-neutral-400">
                      {user?.role === 'owner' ? 'No booking requests yet.' : 'You haven\'t made any bookings yet.'}
                    </p>
                  </div>
                ) : (
                  data.bookings.map((booking) => {
                    return (
                      <div key={booking._id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Link 
                                to={`/properties/${booking.property?._id}`}
                                className="font-medium text-neutral-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                              >
                                {booking.property?.title || 'Property'}
                              </Link>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                getBookingStatusColor(booking.status)
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
                              <div>
                                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                                  {user?.role === 'owner' ? 'Tenant:' : 'Owner:'}
                                </span>
                                <Link 
                                  to={`/users/${user?.role === 'owner' ? booking.tenant?._id || booking.tenant?.id : booking.property?.owner?._id || booking.property?.owner?.id}`}
                                  className="block text-cyan-600 dark:text-cyan-400 hover:underline mt-1"
                                >
                                  {user?.role === 'owner'
                                    ? `${booking.tenant?.name || booking.tenant?.fullName || booking.tenant?.email || 'Tenant'}`
                                    : `${booking.property?.owner?.name || booking.property?.owner?.fullName || booking.property?.ownerName || booking.property?.owner?.email || 'Owner'}`}
                                </Link>
                              </div>
                              <div>
                                <span className="font-medium text-neutral-700 dark:text-neutral-300">Booking Period:</span>
                                <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                                  {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            
                            {booking.message && (
                              <div className="mt-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-md">
                                <span className="font-medium text-neutral-700 dark:text-neutral-300">Request Message:</span>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                  {booking.message}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {user?.role === 'tenant' && booking.status === 'approved' && (
                              <>
                                <Link
                                  to={`/leave-requests/new?bookingId=${booking._id}`}
                                  className="inline-flex items-center px-2.5 py-1.5 text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md"
                                  title="Request to leave this booking"
                                >
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  Request Leave
                                </Link>
                                <Link
                                  to={`/properties/${booking.property?._id}/reviews/new`}
                                  className="inline-flex items-center px-2.5 py-1.5 text-sm bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-100 border border-cyan-300 dark:border-cyan-600 hover:bg-cyan-200 dark:hover:bg-cyan-800 rounded-md"
                                  title="Write a review for this property"
                                >
                                  <Star className="h-4 w-4 mr-1" />
                                  Write Review
                                </Link>
                              </>
                            )}
                            {user?.role === 'owner' && booking.status === 'pending' && (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleBookingStatusUpdate(booking._id, 'approved')}
                                  className="p-1 text-green-600 hover:text-green-700"
                                  title="Approve"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleBookingStatusUpdate(booking._id, 'rejected')}
                                  className="p-1 text-red-600 hover:text-red-700"
                                  title="Reject"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                            {/* Delete booking button for authorized users */}
                            <button
                              onClick={() => handleDeleteBooking(booking._id)}
                              className="p-1 text-red-600 hover:text-red-700"
                              title="Delete Booking"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {data.reviews.length === 0 ? (
                  <div className="text-center py-8">
                    <Star className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-500 dark:text-neutral-400">
                      No reviews yet.
                    </p>
                  </div>
                ) : (
                  data.reviews.map((review) => (
                    <div key={review._id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <div className="flex items-center mr-4">
                              {renderStars(review.rating)}
                            </div>
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 className="font-medium text-neutral-900 dark:text-white mb-1">
                            {user.role === 'owner' 
                              ? `Review for: ${review.property?.title || 'Property'}`
                              : review.property?.title || 'Property'
                            }
                          </h3>
                          {user.role === 'owner' && review.tenant && (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                              By: {review.tenant.name}
                            </p>
                          )}
                          <p className="text-neutral-600 dark:text-neutral-400">
                            {review.comment}
                          </p>
                        </div>
                        {/* Delete review button - only for review authors (tenants who wrote the review) */}
                        {user.role === 'tenant' && (
                          <button
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this review?')) {
                                try {
                                  await deleteReview(review._id);
                                  fetchDashboardData();
                                  alert('Review deleted successfully');
                                } catch (error) {
                                  console.error('Error deleting review:', error);
                                  alert('Failed to delete review');
                                }
                              }
                            }}
                            className="p-1 text-red-600 hover:text-red-700"
                            title="Delete Review"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
