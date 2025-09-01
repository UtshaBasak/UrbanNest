import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Star, 
  Building2, 
  ArrowLeft,
  Edit,
  Save,
  X,
  Heart
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUser, getPropertiesByOwner, updateProfile, createUserRating, canRateUser, canViewTenantContact, getMyFavourites, addFavourite, removeFavourite } from '../utils/api';

const UserProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, updateProfile: updateAuthProfile } = useAuth();
  const curId = currentUser?._id || currentUser?.id;
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    profileImage: ''
  });
  const [updateLoading, setUpdateLoading] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [ratingSummary, setRatingSummary] = useState({ owner: { avg: 0, count: 0 }, tenant: { avg: 0, count: 0 } });
  const [rateValue, setRateValue] = useState(5);
  const [rateComment, setRateComment] = useState('');
  const [canViewPhone, setCanViewPhone] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const [tenantActivity, setTenantActivity] = useState({ bookingsCount: 0, reviewsCount: 0 });
  const [isOwnerFavourited, setIsOwnerFavourited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [showRatingForm, setShowRatingForm] = useState(false);

  const isOwnProfile = !!curId && String(curId) === String(id);

  useEffect(() => {
    if (id) {
      fetchUserProfile();
    }
  }, [id]);

  // Initialize owner favourite state when viewing an owner and tenant is logged in
  useEffect(() => {
    const initFav = async () => {
      try {
        if (!currentUser || currentUser.role !== 'tenant') { setIsOwnerFavourited(false); return; }
        if (!user || user.role !== 'owner') { setIsOwnerFavourited(false); return; }
        if (!id) { setIsOwnerFavourited(false); return; }
        const res = await getMyFavourites();
        const favs = res.data?.favourites || [];
        const has = favs.some(f => f.itemType === 'owner' && String(f.itemId) === String(id));
        setIsOwnerFavourited(has);
      } catch {
        setIsOwnerFavourited(false);
      }
    };
    initFav();
  }, [currentUser?.id, currentUser?.role, user?.role, id]);

  const toggleOwnerFavourite = async () => {
    if (!currentUser) { navigate('/login'); return; }
    if (currentUser.role !== 'tenant') { alert('Only tenants can use favourites'); return; }
    try {
      setFavLoading(true);
      if (isOwnerFavourited) {
        await removeFavourite({ itemType: 'owner', itemId: id });
        setIsOwnerFavourited(false);
        alert('Removed owner from favourites');
      } else {
        await addFavourite({ itemId: id, itemType: 'owner' });
        setIsOwnerFavourited(true);
        alert('Owner added to favourites');
      }
    } catch (e) {
      alert(e?.message || 'Failed to update favourite');
    } finally {
      setFavLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      
      // Always fetch to get fresh data and rating summary
      const response = await getUser(id);
      const fetchedUser = response.data.user;

      // Set profile fields
      setUser(fetchedUser);
      setEditForm({
        name: fetchedUser?.name || '',
        phone: fetchedUser?.phone || '',
        profileImage: fetchedUser?.profileImage || ''
      });

      // Rating summary
      if (response.data.ratingSummary) {
        setRatingSummary(response.data.ratingSummary);
      } else {
        setRatingSummary({ owner: { avg: 0, count: 0 }, tenant: { avg: 0, count: 0 } });
      }

      // Tenant activity counts
      if (response.data.tenantActivity) {
        setTenantActivity(response.data.tenantActivity);
      } else {
        setTenantActivity({ bookingsCount: 0, reviewsCount: 0 });
      }

      // Load owner properties using fetched user id
      if (fetchedUser?.role === 'owner') {
        try {
          const ownerId = fetchedUser._id || fetchedUser.id;
          const propertiesResponse = await getPropertiesByOwner(ownerId);
          setProperties(propertiesResponse.data.properties || []);
        } catch (error) {
          console.error('Error fetching properties:', error);
          setProperties([]);
        }
      } else {
        setProperties([]);
      }

    } catch (error) {
      setError('Failed to fetch user profile');
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check visibility for tenant's phone number
  useEffect(() => {
    const check = async () => {
      try {
        if (!currentUser || !id) { setCanViewPhone(false); return; }
        if (String(curId) === String(id)) { setCanViewPhone(true); return; }
        if (user?.role !== 'tenant') { setCanViewPhone(false); return; }
        const res = await canViewTenantContact(id);
        setCanViewPhone(!!res.data?.canView);
      } catch {
        setCanViewPhone(false);
      }
    };
    check();
  }, [id, curId, user?.role]);

  // Check eligibility to rate when viewing someone else's profile
  useEffect(() => {
    const check = async () => {
      try {
        if (!currentUser || !id || (String(curId) === String(id))) {
          setCanRate(false);
          return;
        }
        const ctx = (user?.role === 'owner') ? 'owner' : 'tenant';
        const res = await canRateUser(id, ctx);
        setCanRate(!!res.data?.canRate);
      } catch (e) {
        setCanRate(false);
      }
    };
    check();
    // re-check when target user role or id/currentUser changes
  }, [id, curId, user?.role]);

  const submitRating = async (e) => {
    e.preventDefault();
    if (!currentUser || String(curId) === String(id)) return;
    try {
      setRateLoading(true);
      await createUserRating({
        rateeId: id,
        rating: Number(rateValue),
        comment: rateComment,
        context: (user?.role === 'owner') ? 'owner' : 'tenant',
      });
      setRateComment('');
      await fetchUserProfile();
      alert('Rating submitted');
    } catch (err) {
      console.error('Submit rating error', err);
      alert(err?.message || 'Failed to submit rating');
    } finally {
      setRateLoading(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing
      setEditForm({
        name: user.name || '',
        phone: user.phone || '',
        profileImage: user.profileImage || ''
      });
    }
    setIsEditing(!isEditing);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setUpdateLoading(true);
      const response = await updateAuthProfile(editForm);
      setUser(response.user);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleImageFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      setEditForm(prev => ({ ...prev, profileImage: base64 }));
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4 mb-6"></div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center space-x-6">
                <div className="w-24 h-24 bg-neutral-200 dark:bg-neutral-700 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 text-lg mb-4">
              {error || 'User not found'}
            </div>
            <button
              onClick={() => navigate(-1)}
              className="text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Go Back
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
            onClick={() => navigate(-1)}
            className="flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
          <div className="flex items-center gap-3">
          {!isOwnProfile && user?.role === 'owner' && currentUser?.role === 'tenant' && (
            <button
              onClick={toggleOwnerFavourite}
              disabled={favLoading}
              aria-label={isOwnerFavourited ? 'Remove favourite owner' : 'Add favourite owner'}
              className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-md hover:shadow-lg transition-shadow"
              title={isOwnerFavourited ? 'Remove from favourites' : 'Add to favourites'}
            >
              <Heart className={`h-5 w-5 ${isOwnerFavourited ? 'text-red-500 fill-current' : 'text-neutral-600 dark:text-neutral-400'}`} />
            </button>
          )}
          </div>
        </div>

        {/* Two-column Layout: Left = Profile, Right = Details/Properties */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-start content-start">
          {/* Profile Card (Left) */}
          <div className="md:col-span-1 bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6 min-w-0 z-10">
            {isEditing ? (
              <form onSubmit={handleUpdateProfile}>
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 bg-cyan-100 dark:bg-cyan-900 rounded-full flex items-center justify-center">
                      {editForm.profileImage ? (
                        <img
                          src={editForm.profileImage}
                          alt={user.name}
                          className="w-24 h-24 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-12 w-12 text-cyan-600 dark:text-cyan-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                        Profile Photo
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFile(e.target.files?.[0])}
                        className="block w-full text-sm text-neutral-700 dark:text-neutral-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 dark:file:bg-cyan-900/40 dark:file:text-cyan-300"
                      />
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Upload a JPG or PNG image. The new photo will replace your current one.</p>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        disabled={updateLoading}
                        className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateLoading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex items-center space-x-6 mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 bg-cyan-100 dark:bg-cyan-900 rounded-full flex items-center justify-center">
                      {user.profileImage ? (
                        <img
                          src={user.profileImage}
                          alt={user.name}
                          className="w-24 h-24 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-12 w-12 text-cyan-600 dark:text-cyan-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                      {user.name}
                    </h1>
                    <div className="space-y-2">
                      <div className="flex items-center text-neutral-600 dark:text-neutral-400">
                        <Mail className="h-4 w-4 mr-2" />
                        {user.email}
                      </div>
                      {user.phone && canViewPhone && (
                        <div className="flex items-center text-neutral-600 dark:text-neutral-400">
                          <Phone className="h-4 w-4 mr-2" />
                          {user.phone}
                        </div>
                      )}
                      <div className="flex items-center text-neutral-600 dark:text-neutral-400">
                        <User className="h-4 w-4 mr-2" />
                        <span className="capitalize">{user.role}</span>
                      </div>
                      <div className="flex items-center text-neutral-600 dark:text-neutral-400">
                        <Calendar className="h-4 w-4 mr-2" />
                        Joined {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rating Summary */}
                <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-200 mt-2">
                  <Star className="h-4 w-4 mr-2 text-yellow-400" />
                  <div className="flex-1">
                    {user.role === 'owner' ? (
                      <span>
                        Owner Rating: {Number(ratingSummary.owner.avg || 0).toFixed(1)}
                        <span className="text-neutral-500 dark:text-neutral-400">
                          ({ratingSummary.owner.count || 0})
                        </span>
                      </span>
                    ) : (
                      <span>
                        Tenant Rating: {Number(ratingSummary.tenant.avg || 0).toFixed(1)}
                        <span className="text-neutral-500 dark:text-neutral-400">
                          ({ratingSummary.tenant.count || 0})
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => navigate(`/users/${id}/ratings`)}
                      className="inline-flex items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 py-1.5 px-3 text-xs font-medium"
                    >
                      View Rating Details
                    </button>
                    {/* Evaluate Owner Button (tenants viewing owners) */}
                    {!isEditing && currentUser && String(curId) !== String(id) && currentUser.role === 'tenant' && user.role === 'owner' && (
                      <button
                        onClick={() => setShowRatingForm(!showRatingForm)}
                        className="inline-flex items-center justify-center rounded-md bg-cyan-600 hover:bg-cyan-700 text-white py-1.5 px-3 text-xs font-medium transition-colors"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        {showRatingForm ? 'Cancel Evaluation' : 'Evaluate Owner'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Rating Form (only if eligible to rate and form is shown) */}
                {!isEditing && currentUser && String(curId) !== String(id) && showRatingForm && (
                  <div className="mt-6 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">
                      Evaluate {user.role === 'owner' ? 'Owner' : 'Tenant'}
                    </h3>
                    <form onSubmit={submitRating} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-neutral-600 dark:text-neutral-300">
                          Rating
                        </label>
                        <select
                          value={rateValue}
                          onChange={(e) => setRateValue(e.target.value)}
                          className="border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 bg-transparent"
                        >
                          {[5, 4, 3, 2, 1].map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={rateComment}
                        onChange={(e) => setRateComment(e.target.value)}
                        placeholder="Optional comment"
                        className="w-full border border-neutral-300 dark:border-neutral-600 rounded p-2 bg-transparent text-sm"
                        rows={3}
                      />
                      <button
                        type="submit"
                        disabled={rateLoading}
                        className="w-full inline-flex items-center justify-center rounded-md bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-3 text-sm font-medium disabled:opacity-50"
                      >
                        {rateLoading ? 'Submitting...' : 'Submit Rating'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Owner Details (Properties or Activity) */}
          <div className="md:col-span-2 space-y-6 self-start min-w-0 relative z-0">
            {/* Properties Section (for owners) */}
            {user.role === 'owner' && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6 relative">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                    {isOwnProfile ? 'My Properties' : `${user.name}'s Properties`}
                  </h2>
                  <div className="flex items-center text-neutral-600 dark:text-neutral-400">
                    <Building2 className="h-4 w-4 mr-1" />
                    {properties.length} {properties.length === 1 ? 'Property' : 'Properties'}
                  </div>
                </div>

                {properties.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-500 dark:text-neutral-400">
                      {isOwnProfile ? "You haven't added any properties yet." : "This user hasn't added any properties yet."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {properties.map((property) => (
                      <div
                        key={property._id}
                        onClick={() => navigate(`/property/${property._id}`)}
                        className="cursor-pointer border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <img
                          src={property.images?.[0] || '/api/placeholder/300/200'}
                          alt={property.title}
                          className="w-full h-40 object-cover"
                        />
                        <div className="p-4">
                          <h3 className="font-medium text-neutral-900 dark:text-white mb-1 line-clamp-1">
                            {property.title}
                          </h3>
                          <div className="flex items-center text-neutral-600 dark:text-neutral-400 mb-2">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span className="text-sm line-clamp-1">{property.location}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-lg font-semibold text-cyan-600 dark:text-cyan-400">
                              ${property.price?.toLocaleString()}
                              <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">/month</span>
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              property.availability === 'Available'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : property.availability === 'Booked'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                            }`}>
                              {property.availability}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Activity Section (for tenants) */}
            {user.role !== 'owner' && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
                  Activity
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-white">{tenantActivity.bookingsCount || 0}</div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">Bookings</div>
                  </div>
                  <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-white">{tenantActivity.reviewsCount || 0}</div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">Reviews</div>
                  </div>
                  <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center justify-center gap-2">
                      <Star className="h-6 w-6 text-yellow-400" />
                      <span>{Number(ratingSummary.tenant?.avg || 0).toFixed(1)}</span>
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">Avg Rating (as Tenant)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
