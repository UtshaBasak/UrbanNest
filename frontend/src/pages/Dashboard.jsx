import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Calendar, 
  Star, 
  DollarSign, 
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
  getMyTransactions,
  updateBookingStatus,
  deleteProperty,
  createMonthlyPayment,
  deleteTransaction,
  deleteBooking
} from '../utils/api';

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

// Helper function to determine tenant residence status
const getTenantResidenceStatus = (booking) => {
  if (!booking || booking.status !== 'approved') {
    return { status: 'No Active Residence', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300' };
  }

  // Normalize to date-only to avoid timezone/time-of-day issues
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDay = new Date(booking.startDate);
  startDay.setHours(0, 0, 0, 0);

  const endDay = new Date(booking.endDate);
  endDay.setHours(0, 0, 0, 0);

  if (today < startDay) {
    return { status: 'Upcoming Residence', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' };
  } else if (today > endDay) {
    return { status: 'Past Residence', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' };
  } else {
    return { status: 'Currently Active Residence', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' };
  }
};

const Dashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState({
    properties: [],
    bookings: [],
    reviews: [],
    transactions: []
  });
  const [loading, setLoading] = useState(true);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({ bookingId: '', month: '', year: '', amount: '' });
  const [paySubmitting, setPaySubmitting] = useState(false);
  // Transactions filters (applied)
  const [tSearch, setTSearch] = useState('');
  const [tMonth, setTMonth] = useState('');
  const [tYear, setTYear] = useState('');
  const [tStatus, setTStatus] = useState('');
  // Draft filters (typing does not trigger fetch)
  const [tSearchDraft, setTSearchDraft] = useState('');
  const [tMonthDraft, setTMonthDraft] = useState('');
  const [tYearDraft, setTYearDraft] = useState('');
  const [tStatusDraft, setTStatusDraft] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const highlightRef = useRef(null);
  const [highlightId, setHighlightId] = useState('');
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalBookings: 0,
    totalReviews: 0,
    totalEarnings: 0
  });
  // Track selected year for each booking's monthly breakdown
  const [selectedYearByBooking, setSelectedYearByBooking] = useState({});

  // Compute payment summary for a booking using current transactions
  const computeBookingPaymentSummary = (booking) => {
    if (!booking) return { months: [], expectedTotal: 0, paidTotal: 0, dueTotal: 0 };
    const price = Number(booking?.property?.price || 0);
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    if (isNaN(start) || isNaN(end) || price <= 0) {
      return { months: [], expectedTotal: 0, paidTotal: 0, dueTotal: 0 };
    }
    // Build list of months between start and end inclusive
    const months = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= endCursor) {
      months.push({
        year: cursor.getFullYear(),
        month: cursor.getMonth() + 1,
        label: cursor.toLocaleString(undefined, { month: 'short', year: 'numeric' }),
        expected: price,
        paid: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    // Sum payments from transactions for this booking grouped by month/year
    const txns = (data.transactions || []).filter(t => (t.booking === booking._id) || (t.booking?._id === booking._id));
    txns.forEach(t => {
      const y = Number(t.year || (t.date && new Date(t.date).getFullYear())) || undefined;
      const m = Number(t.month || (t.date && (new Date(t.date).getMonth() + 1))) || undefined;
      // Fallback: if month/year not present, attempt from createdAt
      const created = new Date(t.createdAt);
      const year = y || (isNaN(created) ? undefined : created.getFullYear());
      const month = m || (isNaN(created) ? undefined : created.getMonth() + 1);
      const amount = Number(t.totalPaid || t.amount || 0);
      if (!year || !month || amount <= 0) return;
      const entry = months.find(mm => mm.year === year && mm.month === month);
      if (entry) entry.paid = amount; // Use totalPaid directly, not cumulative
    });
    const expectedTotal = months.reduce((s, mm) => s + mm.expected, 0);
    const paidTotal = months.reduce((s, mm) => s + Math.min(mm.paid, mm.expected), 0);
    const dueTotal = Math.max(expectedTotal - paidTotal, 0);
    return { months, expectedTotal, paidTotal, dueTotal };
  };

  // Read query params for deep-link: tab & transactionId
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const txId = params.get('transactionId');
    if (tab) setActiveTab(tab);
    if (txId) setHighlightId(txId);
  }, [location.search]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, tSearch, tMonth, tYear, tStatus, refreshKey]);

  // Keep draft inputs in sync when applied filters change externally
  useEffect(() => {
    setTSearchDraft(tSearch);
    setTMonthDraft(tMonth);
    setTYearDraft(tYear);
    setTStatusDraft(tStatus);
  }, [tSearch, tMonth, tYear, tStatus]);

  // Scroll to highlighted transaction when available
  useEffect(() => {
    if (activeTab === 'transactions' && highlightId) {
      const el = document.getElementById(`tx-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeTab, highlightId, data.transactions]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const promises = [];

      if (user.role === 'owner') {
        promises.push(getPropertiesByOwner(user._id || user.id));
      }
      
      promises.push(getMyBookings());
      promises.push(getMyReviews());
      promises.push(getMyTransactions({
        search: tSearch || undefined,
        month: tMonth || undefined,
        year: tYear || undefined,
        status: tStatus || undefined,
      }));

      const results = await Promise.allSettled(promises);
      
      let properties = [];
      let bookings = [];
      let reviews = [];
      let transactions = [];

      if (user.role === 'owner') {
        properties = results[0].status === 'fulfilled' ? results[0].value.data.properties || [] : [];
        bookings = results[1].status === 'fulfilled' ? results[1].value.data.bookings || [] : [];
        reviews = results[2].status === 'fulfilled' ? results[2].value.data.reviews || [] : [];
        transactions = results[3].status === 'fulfilled' ? results[3].value.data.transactions || [] : [];
      } else {
        bookings = results[0].status === 'fulfilled' ? results[0].value.data.bookings || [] : [];
        reviews = results[1].status === 'fulfilled' ? results[1].value.data.reviews || [] : [];
        transactions = results[2].status === 'fulfilled' ? results[2].value.data.transactions || [] : [];
      }

      setData({ properties, bookings, reviews, transactions });
      
      // Calculate stats
      setStats({
        totalProperties: properties.length,
        totalBookings: bookings.length,
        totalReviews: reviews.length,
        totalEarnings: transactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + (t.totalPaid || t.amount || 0), 0)
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayModal = () => {
    // Pre-fill year/month with current
    const now = new Date();
    setPayForm(prev => ({ ...prev, month: String(now.getMonth() + 1).padStart(2, '0'), year: String(now.getFullYear()) }));
    setPayModalOpen(true);
  };

  const handleSubmitMonthlyPayment = async (e) => {
    e.preventDefault();
    if (!payForm.bookingId || !payForm.month || !payForm.year || !payForm.amount) {
      alert('Please fill all fields');
      return;
    }

    const paymentAmount = Number(payForm.amount);
    const month = Number(payForm.month);
    const year = Number(payForm.year);

    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than zero');
      return;
    }

    try {
      setPaySubmitting(true);
      const b = (data.bookings || []).find(x => x._id === payForm.bookingId);
      const expected = b && b.property && typeof b.property.price === 'number' ? Number(b.property.price) : undefined;
      
      if (!expected || expected <= 0) {
        alert('Unable to determine monthly rent for this booking');
        return;
      }

      // Check existing payments for this month/year/booking
      const existingTxn = (data.transactions || []).find(t => 
        (t.booking === payForm.bookingId || t.booking?._id === payForm.bookingId) &&
        t.month === month && t.year === year
      );

      let currentPaid = 0;
      if (existingTxn) {
        currentPaid = Number(existingTxn.totalPaid || existingTxn.amount || 0);
      }

      const totalAfterPayment = currentPaid + paymentAmount;
      
      // Strict validation: prevent overpayments
      if (totalAfterPayment > expected) {
        const maxAllowed = expected - currentPaid;
        alert(`Payment would exceed monthly rent. Maximum allowed: $${maxAllowed.toLocaleString()}`);
        return;
      }

      // Prevent duplicate payments for fully paid months
      if (currentPaid >= expected) {
        alert('This month is already fully paid. No additional payment needed.');
        return;
      }

      // Optional month name for readability
      const monthIdx = Number(payForm.month);
      const monthName = (!isNaN(monthIdx) && monthIdx >= 1 && monthIdx <= 12) ? new Date(2000, monthIdx - 1, 1).toLocaleString(undefined, { month: 'long' }) : undefined;
      
      await createMonthlyPayment({
        bookingId: payForm.bookingId,
        month: month,
        year: year,
        monthName,
        amount: paymentAmount,
        totalExpected: expected,
        paymentMethod: 'credit_card',
      });
      
      setPayModalOpen(false);
      setPayForm({ bookingId: '', month: '', year: '', amount: '' });
      await fetchDashboardData();
      
      const newTotal = currentPaid + paymentAmount;
      const isFullyPaid = newTotal >= expected;
      alert(`Payment recorded successfully! ${isFullyPaid ? 'Month is now fully paid.' : `Remaining due: $${(expected - newTotal).toLocaleString()}`}`);
    } catch (err) {
      console.error('Monthly payment error:', err);
      alert(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await deleteTransaction(id);
      await fetchDashboardData();
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error('Delete transaction error:', err);
      alert('Failed to delete transaction');
    }
  };

  const handleBookingStatusUpdate = async (bookingId, status) => {
    try {
      await updateBookingStatus(bookingId, status);
      fetchDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error updating booking status:', error);
      alert('Failed to update booking status');
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
    if (window.confirm('Are you sure you want to delete this booking? This will also delete all related transactions.')) {
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
              {user.role === 'tenant' && (
                <button
                  onClick={handleOpenPayModal}
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Make Monthly Payment
                </button>
              )}
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
                    Properties
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
                  Bookings
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
                  Reviews
                </p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {stats.totalReviews}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <DollarSign className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  {user?.role === 'owner' ? 'Earnings' : 'Spent'}
                </p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  ${stats.totalEarnings.toLocaleString()}
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
                Reviews
              </button>
              <button
                onClick={() => setActiveTab('rental-status')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'rental-status'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                Rental Status
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'transactions'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                Transactions
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
                              <Link
                                to={`/leave-requests/new?bookingId=${booking._id}`}
                                className="inline-flex items-center px-2.5 py-1.5 text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md"
                                title="Request to leave this booking"
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Request Leave
                              </Link>
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
                            {review.property?.title || 'Property'}
                          </h3>
                          <p className="text-neutral-600 dark:text-neutral-400">
                            {review.comment}
                          </p>
                        </div>
                        {/* Delete review button for review author */}
                        {review.user?._id === user?._id && (
                          <button
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this review?')) {
                                try {
                                  const { deleteReview } = await import('../utils/api');
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

            {/* Rental Status Tab */}
            {activeTab === 'rental-status' && (
              <div className="space-y-4">
                {data.bookings.filter(b => b.status === 'approved').length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-500 dark:text-neutral-400">
                      No active rentals yet.
                    </p>
                  </div>
                ) : (
                  data.bookings.filter(b => b.status === 'approved').map((booking) => {
                    const summary = computeBookingPaymentSummary(booking);
                    return (
                      <div key={booking._id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Link 
                                to={`/properties/${booking.property?._id}`}
                                className="text-lg font-semibold text-neutral-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                              >
                                {booking.property?.title || 'Property'}
                              </Link>
                              {(() => {
                                const residenceStatus = getTenantResidenceStatus(booking);
                                return (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${residenceStatus.color}`}>
                                    {residenceStatus.status}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
                                <span className="font-medium text-neutral-700 dark:text-neutral-300">Rental Period:</span>
                                <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                                  {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Payment summary - Fixed independent section with auto-sizing */}
                        <div className="mt-4 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                            <div className="bg-white dark:bg-neutral-900 rounded-md p-3 border border-neutral-200 dark:border-neutral-600 min-h-[80px] flex flex-col justify-center">
                              <div className="text-neutral-500 dark:text-neutral-400 text-xs font-medium mb-1">Monthly Rent</div>
                              <div className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">${Number(booking?.property?.price || 0).toLocaleString()}</div>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 rounded-md p-3 border border-neutral-200 dark:border-neutral-600 min-h-[80px] flex flex-col justify-center">
                              <div className="text-neutral-500 dark:text-neutral-400 text-xs font-medium mb-1">Total Cost</div>
                              <div className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">${summary.expectedTotal.toLocaleString()}</div>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 rounded-md p-3 border border-neutral-200 dark:border-neutral-600 min-h-[80px] flex flex-col justify-center">
                              <div className="text-neutral-500 dark:text-neutral-400 text-xs font-medium mb-1">Paid</div>
                              <div className="font-semibold text-lg text-green-600 dark:text-green-400">${summary.paidTotal.toLocaleString()}</div>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 rounded-md p-3 border border-neutral-200 dark:border-neutral-600 min-h-[80px] flex flex-col justify-center">
                              <div className="text-neutral-500 dark:text-neutral-400 text-xs font-medium mb-1">Due</div>
                              <div className="font-semibold text-lg text-red-600 dark:text-red-400">${summary.dueTotal.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Year selector + Monthly breakdown */}
                        {summary.months.length > 0 && (() => {
                          // unique years
                          const years = Array.from(new Set(summary.months.map(mm => mm.year))).sort((a,b)=>a-b);
                          const defaultYear = years[years.length - 1];
                          const selectedYear = selectedYearByBooking[booking._id] ?? defaultYear;
                          const monthsToShow = summary.months.filter(mm => mm.year === selectedYear);
                          return (
                            <>
                              <div className="mt-4 flex gap-2 flex-wrap">
                                {years.map(y => (
                                  <button
                                    key={y}
                                    type="button"
                                    onClick={() => setSelectedYearByBooking(prev => ({ ...prev, [booking._id]: y }))}
                                    aria-pressed={y === selectedYear}
                                    className={`text-xs px-2 py-1 rounded border transition-colors ${y === selectedYear ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600'}`}
                                  >
                                    {y}
                                  </button>
                                ))}
                              </div>
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {monthsToShow.map(m => {
                                  const paidEnough = m.paid >= m.expected && m.expected > 0;
                                  const partial = m.paid > 0 && m.paid < m.expected;
                                  const cls = paidEnough
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                    : partial
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
                                  const statusLabel = paidEnough ? 'Fully Paid' : partial ? 'Partial' : 'Due';
                                  return (
                                    <div key={`${m.year}-${m.month}`} className={`text-xs px-3 py-2 rounded-md ${cls} flex items-center justify-between min-w-[200px]`}>
                                      <span className="font-medium">{m.label}: {statusLabel}</span>
                                      <span className="text-xs opacity-75">
                                        ${m.paid.toLocaleString()} / ${m.expected.toLocaleString()}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                        
                        {/* Delete booking button for authorized users */}
                        <div className="flex justify-end mt-4">
                          <button
                            onClick={() => handleDeleteBooking(booking._id)}
                            className="px-3 py-1.5 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500/60 transition-colors"
                          >
                            Delete Booking
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <input className="border border-neutral-300 dark:border-neutral-600 rounded p-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" placeholder="Search" value={tSearchDraft} onChange={e => setTSearchDraft(e.target.value)} />
                  <input className="border border-neutral-300 dark:border-neutral-600 rounded p-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" placeholder="Month #" value={tMonthDraft} onChange={e => setTMonthDraft(e.target.value)} />
                  <input className="border border-neutral-300 dark:border-neutral-600 rounded p-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" placeholder="Year" value={tYearDraft} onChange={e => setTYearDraft(e.target.value)} />
                  <select className="border border-neutral-300 dark:border-neutral-600 rounded p-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" value={tStatusDraft} onChange={e => setTStatusDraft(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid (Partial)</option>
                    <option value="pending">Pending</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      className="px-3 rounded p-2 bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                      onClick={() => {
                        setTSearch(tSearchDraft);
                        setTMonth(tMonthDraft);
                        setTYear(tYearDraft);
                        setTStatus(tStatusDraft);
                      }}
                    >
                      Apply
                    </button>
                    <button className="px-3 rounded p-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400/40" onClick={() => {
                      setTSearch(''); setTMonth(''); setTYear(''); setTStatus('');
                      setTSearchDraft(''); setTMonthDraft(''); setTYearDraft(''); setTStatusDraft('');
                    }}>Clear</button>
                  </div>
                </div>

                {data.transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-500 dark:text-neutral-400">
                      No transactions yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {user.role === 'owner' ? (
                      // Group by property then tenant
                      Object.entries(
                        (data.transactions || []).reduce((acc, t) => {
                          const propKey = t.property?._id || 'unknown';
                          const tenantKey = t.tenant?._id || 'unknown';
                          if (!acc[propKey]) acc[propKey] = { property: t.property, tenants: {} };
                          if (!acc[propKey].tenants[tenantKey]) acc[propKey].tenants[tenantKey] = { tenant: t.tenant, items: [] };
                          acc[propKey].tenants[tenantKey].items.push(t);
                          return acc;
                        }, {})
                      ).map(([propId, group]) => (
                        <div key={propId} className="border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800">
                          <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                            <h3 className="font-semibold text-neutral-900 dark:text-white">{group.property?.title || 'Property'}</h3>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400">Owner view • {Object.keys(group.tenants).length} tenant(s)</p>
                          </div>
                          <div className="p-4 space-y-4">
                            {Object.entries(group.tenants).map(([tenantId, tg]) => (
                              <div key={tenantId} className="bg-neutral-50 dark:bg-neutral-800/60 rounded-md p-3">
                                <div className="mb-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">Tenant: {tg.tenant?.name || tg.tenant?.fullName || tg.tenant?.email || 'Tenant'}</div>
                                <div className="space-y-2">
                                  {tg.items.map((t) => {
                                    const expected = Number(
                                      (t.totalExpected ?? t.expected ?? t.property?.price ?? 0)
                                    );
                                    const paid = Number(t.totalPaid ?? t.amount ?? 0);
                                    const fullyPaid = paid >= expected && expected > 0;
                                    const partiallyPaid = paid > 0 && paid < expected;
                                    const statusLabel = fullyPaid ? 'Fully Paid' : partiallyPaid ? 'Partially Paid' : (t.status || 'Not Paid');
                                    const statusColor = fullyPaid ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 
                                                       partiallyPaid ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' : 
                                                       'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
                                    const refProp = t._id === highlightId ? { ref: highlightRef } : {};
                                    return (
                                      <div key={t._id} {...refProp} id={`tx-${t._id}`} className={`flex items-center justify-between border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 bg-white dark:bg-neutral-900 ${t._id === highlightId ? 'ring-2 ring-cyan-500' : ''}`}>
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                            {statusLabel}
                                          </span>
                                          <div className="text-sm text-neutral-900 dark:text-white">{t.monthName || 'Payment'}</div>
                                        </div>
                                        <div>
                                          <p className="text-xs text-neutral-600 dark:text-neutral-400">
                                            Paid: ${paid.toLocaleString()} out of ${expected.toLocaleString()}
                                            {(expected - paid) > 0 && ` | Due: $${(expected - paid).toLocaleString()}`}
                                            <span className="ml-2">• {new Date(t.createdAt).toLocaleString()}</span>
                                          </p>
                                        </div>
                                        <button
                                          onClick={() => handleDeleteTransaction(t._id)}
                                          className="px-3 py-1.5 text-xs rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400/40"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      // Tenant flat list
                      data.transactions.map((transaction) => {
                        const expected = Number(
                          (transaction.totalExpected ?? transaction.expected ?? transaction.property?.price ?? 0)
                        );
                        const paid = Number(transaction.totalPaid ?? transaction.amount ?? 0);
                        const fullyPaid = paid >= expected && expected > 0;
                        const partiallyPaid = paid > 0 && paid < expected;
                        const statusLabel = fullyPaid ? 'Fully Paid' : partiallyPaid ? 'Partially Paid' : (transaction.status || 'Not Paid');
                        const refProp = transaction._id === highlightId ? { ref: highlightRef } : {};
                        return (
                          <div key={transaction._id} {...refProp} id={`tx-${transaction._id}`} className={`border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 bg-white dark:bg-neutral-800 ${transaction._id === highlightId ? 'ring-2 ring-cyan-500' : ''}`}>
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <h3 className="font-medium text-neutral-900 dark:text-white">
                                  {transaction.property?.title || 'Property'}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    fullyPaid ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 
                                    partiallyPaid ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' : 
                                    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                  }`}>
                                    {statusLabel}
                                  </span>
                                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                    {transaction.monthName || 'Payment'}
                                  </span>
                                </div>
                                {(transaction.month && transaction.year) && (
                                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Period: {transaction.month}/{transaction.year}</p>
                                )}
                                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                                  Paid: ${paid.toLocaleString()} out of ${expected.toLocaleString()}
                                  {(expected - paid) > 0 && ` | Due: $${(expected - paid).toLocaleString()}`}
                                  <span className="ml-2">• {new Date(transaction.createdAt).toLocaleString()}</span>
                                </p>
                              </div>
                              <div className="text-right flex items-center gap-3">
                                <button
                                  onClick={() => handleDeleteTransaction(transaction._id)}
                                  className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400/40"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Tenant Monthly Payment Modal */}
      {payModalOpen && user?.role === 'tenant' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Make Monthly Payment</h3>
            <form onSubmit={handleSubmitMonthlyPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Booking</label>
                <select
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
                  value={payForm.bookingId}
                  onChange={(e) => {
                    const bookingId = e.target.value;
                    let amount = payForm.amount;
                    const b = (data.bookings || []).find(x => x._id === bookingId);
                    if (b && b.property && typeof b.property.price === 'number') {
                      // Check if there's a partial payment for current month/year
                      const currentMonth = Number(payForm.month);
                      const currentYear = Number(payForm.year);
                      if (currentMonth && currentYear) {
                        const existingTxn = (data.transactions || []).find(t => 
                          (t.booking === bookingId || t.booking?._id === bookingId) &&
                          t.month === currentMonth && t.year === currentYear
                        );
                        if (existingTxn) {
                          const paid = Number(existingTxn.totalPaid || existingTxn.amount || 0);
                          const expected = Number(existingTxn.totalExpected || b.property.price);
                          const due = Math.max(expected - paid, 0);
                          amount = due > 0 ? String(due) : String(b.property.price);
                        } else {
                          amount = String(b.property.price);
                        }
                      } else {
                        amount = String(b.property.price);
                      }
                    }
                    setPayForm(prev => ({ ...prev, bookingId, amount }));
                  }}
                  required
                >
                  <option value="" disabled>Select a booking</option>
                  {(data.bookings || []).map(b => (
                    <option key={b._id} value={b._id}>
                      {b.property?.title || 'Property'} ({new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Month</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    placeholder="MM"
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
                    value={payForm.month}
                    onChange={(e) => {
                      const month = e.target.value;
                      setPayForm(prev => ({ ...prev, month }));
                      // Auto-adjust amount based on due for this month
                      if (payForm.bookingId && month && payForm.year) {
                        const b = (data.bookings || []).find(x => x._id === payForm.bookingId);
                        const existingTxn = (data.transactions || []).find(t => 
                          (t.booking === payForm.bookingId || t.booking?._id === payForm.bookingId) &&
                          t.month === Number(month) && t.year === Number(payForm.year)
                        );
                        if (existingTxn && b?.property?.price) {
                          const paid = Number(existingTxn.totalPaid || existingTxn.amount || 0);
                          const expected = Number(existingTxn.totalExpected || b.property.price);
                          const due = Math.max(expected - paid, 0);
                          setPayForm(prev => ({ ...prev, amount: due > 0 ? String(due) : String(b.property.price) }));
                        } else if (b?.property?.price) {
                          setPayForm(prev => ({ ...prev, amount: String(b.property.price) }));
                        }
                      }
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Year</label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    placeholder="YYYY"
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
                    value={payForm.year}
                    onChange={(e) => {
                      const year = e.target.value;
                      setPayForm(prev => ({ ...prev, year }));
                      // Auto-adjust amount based on due for this year/month
                      if (payForm.bookingId && payForm.month && year) {
                        const b = (data.bookings || []).find(x => x._id === payForm.bookingId);
                        const existingTxn = (data.transactions || []).find(t => 
                          (t.booking === payForm.bookingId || t.booking?._id === payForm.bookingId) &&
                          t.month === Number(payForm.month) && t.year === Number(year)
                        );
                        if (existingTxn && b?.property?.price) {
                          const paid = Number(existingTxn.totalPaid || existingTxn.amount || 0);
                          const expected = Number(existingTxn.totalExpected || b.property.price);
                          const due = Math.max(expected - paid, 0);
                          setPayForm(prev => ({ ...prev, amount: due > 0 ? String(due) : String(b.property.price) }));
                        } else if (b?.property?.price) {
                          setPayForm(prev => ({ ...prev, amount: String(b.property.price) }));
                        }
                      }
                    }}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
                  value={payForm.amount}
                  onChange={(e) => setPayForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400 text-white font-medium py-2 px-4 rounded-lg"
                >
                  {paySubmitting ? 'Submitting...' : 'Pay' }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Dashboard;
