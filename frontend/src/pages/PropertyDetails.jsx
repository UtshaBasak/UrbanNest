import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Star, Calendar, User, Phone, Mail, ArrowLeft, Heart, Share2, Pencil, Trash } from 'lucide-react';
import { getProperty, createBooking, getPropertyReviews, deleteProperty, createReview, canReviewProperty, getMyFavourites, addFavourite, removeFavourite } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const PropertyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [property, setProperty] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingData, setBookingData] = useState({
    startDate: '',
    endDate: '',
    message: ''
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [isFavourited, setIsFavourited] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPropertyDetails();
      fetchPropertyReviews();
    }
  }, [id]);

  // Photo viewer keyboard shortcuts
  useEffect(() => {
    if (!showPhotoViewer) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowPhotoViewer(false);
      if (!property?.images || property.images.length === 0) return;
      if (e.key === 'ArrowRight') setCurrentImageIndex((i) => Math.min(i + 1, property.images.length - 1));
      if (e.key === 'ArrowLeft') setCurrentImageIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPhotoViewer, property?.images?.length]);

  // Initialize favourites state from server (tenant only)
  useEffect(() => {
    const initFav = async () => {
      try {
        if (!user || user.role !== 'tenant' || !id) {
          setIsFavourited(false);
          return;
        }
        const res = await getMyFavourites();
        const favs = res.data?.favourites || [];
        const has = favs.some(f => f.itemType === 'property' && String(f.itemId || f.property?._id) === String(id));
        setIsFavourited(has);
      } catch (e) {
        setIsFavourited(false);
      }
    };
    initFav();
  }, [user?.role, user?._id, id]);

  const handleToggleFavourite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'tenant') {
      alert('Only tenants can use favourites');
      return;
    }
    try {
      if (isFavourited) {
        await removeFavourite({ itemType: 'property', itemId: id });
        setIsFavourited(false);
        alert('Removed from favourites');
      } else {
        await addFavourite({ itemId: id, itemType: 'property' });
        setIsFavourited(true);
        alert('Added to favourites');
      }
    } catch (e) {
      alert(e?.message || 'Failed to update favourites');
    }
  };

  // Check eligibility to review this property (tenant with completed rental)
  useEffect(() => {
    const check = async () => {
      try {
        if (!user || user.role !== 'tenant' || !id) {
          setCanReview(false);
          return;
        }
        const res = await canReviewProperty(id);
        setCanReview(!!res.data?.canReview);
      } catch (e) {
        setCanReview(false);
      }
    };
    check();
  }, [user?.role, user?._id, id]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      setReviewSubmitting(true);
      const res = await createReview({ property: id, rating: Number(reviewForm.rating), comment: reviewForm.comment });
      const newReview = res.data?.review;
      if (newReview) {
        setReviews((prev) => [newReview, ...prev]);
        setReviewForm({ rating: 5, comment: '' });
        alert('Review submitted');
      }
    } catch (err) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: property?.title || 'Property Details', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard');
    } catch (e) {
      // Fallback if clipboard API is not available or permission denied
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Link copied to clipboard');
      } catch (err) {
        alert('Unable to share this link');
      }
    }
  };

  const fetchPropertyDetails = async () => {
    try {
      setLoading(true);
      const response = await getProperty(id);
      setProperty(response.data.property);
    } catch (error) {
      setError('Failed to fetch property details');
      console.error('Error fetching property:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPropertyReviews = async () => {
    try {
      const response = await getPropertyReviews(id);
      setReviews(response.data.reviews || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setBookingLoading(true);
      // Basic client-side validation
      const start = new Date(bookingData.startDate);
      const end = new Date(bookingData.endDate);
      if (!(bookingData.startDate && bookingData.endDate) || isNaN(start) || isNaN(end) || end <= start) {
        alert('Please select valid start and end dates. End date must be after start date.');
        setBookingLoading(false);
        return;
      }
      await createBooking({
        property: id,
        startDate: bookingData.startDate,
        endDate: bookingData.endDate,
        message: bookingData.message
      });
      setShowBookingModal(false);
      setBookingData({ startDate: '', endDate: '', message: '' });
      alert('Booking request submitted successfully!');
    } catch (error) {
      alert(error?.message || 'Failed to submit booking request. Please try again.');
      console.error('Booking error:', error);
    } finally {
      setBookingLoading(false);
    }
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
            <div className="h-96 bg-neutral-200 dark:bg-neutral-700 rounded mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
              </div>
              <div className="h-64 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 text-lg mb-4">
              {error || 'Property not found'}
            </div>
            <button
              onClick={() => navigate('/properties')}
              className="text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Back to Properties
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/properties')}
            className="flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Properties
          </button>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleToggleFavourite}
              aria-label={isFavourited ? 'Remove from favourites' : 'Add to favourites'}
              className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-md hover:shadow-lg transition-shadow"
            >
              <Heart
                className={`h-5 w-5 ${isFavourited ? 'text-red-500 fill-current' : 'text-neutral-600 dark:text-neutral-400'}`}
              />
            </button>
            <button
              onClick={handleShare}
              aria-label="Share property"
              className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-md hover:shadow-lg transition-shadow"
            >
              <Share2 className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="mb-8">
          <div className="relative h-96 rounded-lg overflow-hidden">
            <img
              src={property.images?.[0] || '/api/placeholder/800/400'}
              alt={property.title}
              className="w-full h-full object-cover"
            />
            {property.images && property.images.length > 0 && (
              <button
                type="button"
                onClick={() => { setCurrentImageIndex(0); setShowPhotoViewer(true); }}
                className="absolute top-4 right-4 bg-black/60 text-white text-sm px-3 py-1 rounded hover:bg-black/70"
              >
                View all photos
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Property Details */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
                    {property.title}
                  </h1>
                  <div className="flex items-center text-neutral-600 dark:text-neutral-400 mb-2">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{property.location}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                    {property.currentTenant?.name && (
                      <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700">Tenant: {property.currentTenant.name}</span>
                    )}
                  </div>
                  {(() => {
                    const avg = reviews.length > 0 ? Math.round(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) : 0;
                    return (
                      <div className="flex items-center">
                        <div className="flex items-center mr-2">
                          {renderStars(avg)}
                        </div>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {reviews.length > 0 ? `(${reviews.length} reviews)` : 'No reviews yet'}
                        </span>
                        <button
                          onClick={() => navigate(`/properties/${id}/reviews`)}
                          className="ml-3 text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                        >
                          View all reviews
                        </button>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/map?propertyId=${property._id}`)}
                    className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                  >
                    View Location
                  </button>
                </div>
              </div>
              {/* Single availability tag above monthly rent */}
              {(property.availabilityStatus || property.availability) && (
                <div className="mb-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAvailabilityColor(property.availabilityStatus || property.availability)}`}>
                    {property.availabilityStatus || property.availability}
                  </span>
                </div>
              )}
              <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400 mb-4">
                ${property.price?.toLocaleString()}
                <span className="text-lg font-normal text-neutral-500 dark:text-neutral-400">/month</span>
              </div>
              <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-400 mb-4 gap-4">
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
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {property.description}
              </p>
            </div>

            {/* Owner Information */}
            {property.owner && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
                  Property Owner
                </h2>
                <div className="flex items-center">
                  {(() => {
                    const imgRaw = property.owner?.profileImage || property.owner?.photo || property.owner?.avatarUrl;
                    const src = imgRaw ? (imgRaw.startsWith('data:') || imgRaw.startsWith('http') ? imgRaw : `data:image/jpeg;base64,${imgRaw}`) : null;
                    return src ? (
                      <img
                        src={src}
                        alt={property.owner?.name || 'Owner'}
                        className="w-12 h-12 rounded-full object-cover mr-4 border border-neutral-200 dark:border-neutral-700"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900 rounded-full flex items-center justify-center mr-4">
                        <User className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                      </div>
                    );
                  })()}
                  <div className="flex-1">
                    <h3 className="font-medium text-neutral-900 dark:text-white">
                      {property.owner.name}
                    </h3>
                    <div className="flex items-center text-neutral-600 dark:text-neutral-400 text-sm">
                      <Mail className="h-4 w-4 mr-1" />
                      {property.owner.email}
                    </div>
                    {property.owner.phone && (
                      <div className="flex items-center text-neutral-600 dark:text-neutral-400 text-sm">
                        <Phone className="h-4 w-4 mr-1" />
                        {property.owner.phone}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => navigate(`/users/${property.owner._id || property.owner.id}`)}
                      className="inline-flex items-center px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium transition-colors"
                    >
                      <User className="h-4 w-4 mr-1" />
                      View Owner Profile
                    </button>
                  </div>
                </div>

                {/* Tenant Review Form - disabled per requirement */}
              </div>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                    Reviews ({reviews.length})
                  </h2>
                </div>
                <div className="space-y-4">
                  {reviews.slice(0, 3).map((review) => (
                    <div key={review._id} className="border-b border-neutral-200 dark:border-neutral-700 pb-4 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900 rounded-full flex items-center justify-center mr-3">
                            <User className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                          </div>
                          <span className="font-medium text-neutral-900 dark:text-white">
                            {review.tenant?.name || 'Anonymous'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          {renderStars(review.rating)}
                        </div>
                      </div>
                      <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                        {review.comment}
                      </p>
                    </div>
                  ))}
                </div>
                {reviews.length > 3 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => navigate(`/properties/${id}/reviews`)}
                      className="inline-flex items-center px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium transition-colors"
                    >
                      View All Reviews ({reviews.length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Booking / Owner Actions Card */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6 sticky top-8 space-y-4">
              {/* Owner actions if current user owns this property */}
              {user && (user.role === 'owner' || user.role === 'admin') && (String(property.owner?._id || property.owner) === String(user._id)) && (
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">Manage Listing</h2>
                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate(`/properties/${property._id}/edit`)}
                      className="flex-1 inline-flex items-center justify-center gap-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg py-2 px-3 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
                          try {
                            await deleteProperty(property._id);
                            alert('Property deleted');
                            navigate('/properties');
                          } catch (e) {
                            alert('Failed to delete property');
                          }
                        }
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 px-3 transition-colors"
                    >
                      <Trash className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Booking card for logged-in tenants only, when property is Available */}
              {(user && user.role === 'tenant') && (
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">Book This Property</h2>
                  {(property.availabilityStatus || property.availability) === 'Available' ? (
                    <button
                      onClick={() => setShowBookingModal(true)}
                      className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      Book Now
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full bg-gray-400 text-white font-medium py-3 px-4 rounded-lg cursor-not-allowed"
                    >
                      {property.availabilityStatus || property.availability}
                    </button>
                  )}
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 text-center">
                    You won't be charged yet
                  </p>
                </div>
              )}

              {/* Review Property action (eligible tenants only) */}
              {user && user.role === 'tenant' && canReview && (
                <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                  <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">Your Experience</h3>
                  <button
                    onClick={() => navigate(`/properties/${id}/reviews/new`)}
                    className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                  >
                    Review Property
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
              Request Booking
            </h3>
            <form onSubmit={handleBookingSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={bookingData.startDate}
                  onChange={(e) => setBookingData(prev => ({ ...prev, startDate: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={bookingData.endDate}
                  onChange={(e) => setBookingData(prev => ({ ...prev, endDate: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={bookingData.message}
                  onChange={(e) => setBookingData(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                  placeholder="Tell the owner why you'd like to book this property..."
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {bookingLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Photo Viewer Overlay */}
      {showPhotoViewer && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowPhotoViewer(false)}
        >
          <div className="relative w-full max-w-6xl max-h-[92vh] bg-neutral-900 rounded-lg" onClick={(e) => e.stopPropagation()}>
            {/* Close */}
            <button
              onClick={() => setShowPhotoViewer(false)}
              className="absolute top-3 right-3 bg-black/60 text-white px-3 py-1 rounded"
              aria-label="Close"
            >
              Close
            </button>

            {/* Main image */}
            <div className="flex items-center justify-center px-4 pt-10 pb-3">
              <img
                src={property.images?.[currentImageIndex] || '/api/placeholder/1200/800'}
                alt={property.title}
                className="max-h-[65vh] w-auto max-w-full object-contain select-none"
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.src = '/api/placeholder/1200/800'; }}
              />
              {/* Prev/Next */}
              {property.images && property.images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex((i) => Math.max(i - 1, 0))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 text-white px-3 py-2 rounded"
                    aria-label="Previous"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex((i) => Math.min(i + 1, property.images.length - 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 text-white px-3 py-2 rounded"
                    aria-label="Next"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {property.images && property.images.length > 1 && (
              <div className="px-4 pb-4 overflow-x-auto">
                <div className="flex gap-2">
                  {property.images.filter(Boolean).map((src, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`border-2 ${idx === currentImageIndex ? 'border-white' : 'border-transparent'} rounded`}
                      aria-label={`View photo ${idx + 1}`}
                    >
                      <img
                        src={src}
                        alt={`${property.title} ${idx + 1}`}
                        className="h-20 w-28 object-cover rounded"
                        onError={(e) => { e.currentTarget.src = '/api/placeholder/200/140'; }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetails;
