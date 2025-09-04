import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getPropertiesByOwner, getMyBookings, getUserRatingSummary, getUser, listUserRatings } from '../utils/api';
import { Calendar, MapPin, ChevronRight, Star } from 'lucide-react';

const Section = ({ title, children }) => (
  <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">{title}</h2>
    {children}
  </div>
);

const ProfileStatus = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ownerProps, setOwnerProps] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [ratingSummary, setRatingSummary] = useState({ owner: { avg: 0, count: 0 }, tenant: { avg: 0, count: 0 } });
  const [ownerDetails, setOwnerDetails] = useState({}); // Cache for owner details by property ID
  const [userRatings, setUserRatings] = useState([]);
  const isOwner = user?.role === 'owner';

  // Filters and UI state
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Tenant payment form state
  const [payBookingId, setPayBookingId] = useState('');
  const [payMonthName, setPayMonthName] = useState('');
  const [payMonth, setPayMonth] = useState('');
  const [payYear, setPayYear] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payExpected, setPayExpected] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const tasks = [];
        let propsIdx = -1, bookingsIdx = -1, ratingIdx = -1, ratingsListIdx = -1;
        if (isOwner) {
          propsIdx = tasks.push(getPropertiesByOwner(user._id || user.id)) - 1;
        }
        bookingsIdx = tasks.push(getMyBookings()) - 1;
        ratingIdx = tasks.push(getUserRatingSummary(user._id || user.id)) - 1;
        ratingsListIdx = tasks.push(listUserRatings(user._id || user.id)) - 1;
        const res = await Promise.allSettled(tasks);
        if (propsIdx > -1) setOwnerProps(res[propsIdx].status === 'fulfilled' ? (res[propsIdx].value.data.properties || []) : []);
        if (bookingsIdx > -1) setBookings(res[bookingsIdx].status === 'fulfilled' ? (res[bookingsIdx].value.data.bookings || []) : []);
        if (ratingIdx > -1) {
          const def = { owner: { avg: 0, count: 0 }, tenant: { avg: 0, count: 0 } };
          if (res[ratingIdx].status === 'fulfilled') {
            setRatingSummary(res[ratingIdx].value.data?.summary || def);
          } else {
            setRatingSummary(def);
          }
        }
        if (ratingsListIdx > -1) {
          setUserRatings(res[ratingsListIdx].status === 'fulfilled' ? (res[ratingsListIdx].value.data.ratings || []) : []);
        }
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user, isOwner, search, refreshKey]);

  // Fetch owner details for properties
  const fetchOwnerDetails = async (propertyId, ownerId) => {
    if (!ownerId || ownerDetails[propertyId]) return;
    try {
      const response = await getUser(ownerId);
      if (response?.data?.user) {
        setOwnerDetails(prev => ({ ...prev, [propertyId]: response.data.user }));
      }
    } catch (error) {
      console.error('Failed to fetch owner details:', error);
    }
  };

  // Fetch owner details for all bookings
  useEffect(() => {
    if (!isOwner && bookings.length > 0) {
      bookings.forEach(booking => {
        const propertyId = booking.property?._id;
        const ownerId = booking.property?.owner?._id || booking.property?.owner;
        if (propertyId && ownerId) {
          fetchOwnerDetails(propertyId, ownerId);
        }
      });
    }
  }, [bookings, isOwner]);

  // No category grouping per requirement
  const ownerList = useMemo(() => (isOwner ? ownerProps : []), [ownerProps, isOwner]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-6 w-40 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-4" />
          <div className="h-48 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">My Profile</h1>
        </div>

        {/* User Information */}
        <Section title="User Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-neutral-700 dark:text-neutral-200">Name:</span>
              <span className="ml-2 text-neutral-900 dark:text-white">{user?.name || '-'}</span>
            </div>
            <div>
              <span className="font-medium text-neutral-700 dark:text-neutral-200">Email Address:</span>
              <span className="ml-2 text-neutral-900 dark:text-white">{user?.email || '-'}</span>
            </div>
            <div>
              <span className="font-medium text-neutral-700 dark:text-neutral-200">Role:</span>
              <span className="ml-2 text-neutral-900 dark:text-white capitalize">{user?.role || '-'}</span>
            </div>
            {user?.phone && (
              <div>
                <span className="font-medium text-neutral-700 dark:text-neutral-200">Phone Number:</span>
                <span className="ml-2 text-neutral-900 dark:text-white">{user.phone}</span>
              </div>
            )}
            {/* Add more fields as needed */}
          </div>
        </Section>

        {/* My Rating */}
        <Section title="My Rating">
          <div className="flex items-center gap-3 text-neutral-800 dark:text-neutral-100 mb-4">
            <Star className="h-5 w-5 text-yellow-400" />
            {isOwner ? (
              <div>
                <span className="font-medium">Owner Rating:</span> {Number(ratingSummary.owner.avg || 0).toFixed(1)}
                <span className="text-neutral-500 dark:text-neutral-400"> ({ratingSummary.owner.count || 0})</span>
              </div>
            ) : (
              <div>
                <span className="font-medium">Tenant Rating:</span> {Number(ratingSummary.tenant.avg || 0).toFixed(1)}
                <span className="text-neutral-500 dark:text-neutral-400"> ({ratingSummary.tenant.count || 0})</span>
              </div>
            )}
          </div>
          {/* Individual Ratings List */}
          {userRatings.length === 0 ? (
            <div className="text-neutral-500 dark:text-neutral-400">No individual ratings yet.</div>
          ) : (
            <div className="space-y-4">
              {userRatings.map(rating => (
                <div key={rating._id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    {[1,2,3,4,5].map(star => (
                      <Star key={star} className={`h-4 w-4 ${star <= Math.round(rating.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-neutral-300 dark:text-neutral-700'}`} fill={star <= Math.round(rating.rating) ? 'currentColor' : 'none'} />
                    ))}
                    <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">{new Date(rating.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-neutral-700 dark:text-neutral-200 mb-1">
                    {rating.comment || <span className="italic text-neutral-400">No comment</span>}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    By: {rating.rater?.name || 'Unknown'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {isOwner ? (
          <>
            <Section title="Owned Properties">
              {ownerList.length === 0 ? (
                <div className="text-neutral-500 dark:text-neutral-400">No properties yet.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ownerList.map(p => (
                    <div key={p._id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-neutral-900 dark:text-white line-clamp-1">{p.title}</div>
                          <div className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center mt-1">
                            <MapPin className="h-4 w-4 mr-1" /> {p.location || '—'}
                          </div>
                          <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                            ৳{(p.price || 0).toLocaleString()} / month
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/property/${p._id}`)}
                          className="ml-4 p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ProfileStatus;
