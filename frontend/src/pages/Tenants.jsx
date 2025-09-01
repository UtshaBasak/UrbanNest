import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUsers, getMyBookings, createUserRating } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Tenants = () => {
  const { user: currentUser } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eligibleTenantIds, setEligibleTenantIds] = useState(() => new Set());
  const [rateModal, setRateModal] = useState({ open: false, target: null });
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await getUsers({ role: 'tenant' });
        setTenants(res.data.users || []);
      } catch (e) {
        setError('Failed to fetch tenants');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load approved bookings for current owner to determine who can be rated
  useEffect(() => {
    const loadEligible = async () => {
      try {
        if (!currentUser || currentUser.role !== 'owner') return;
        const res = await getMyBookings({ status: 'approved', limit: 100 });
        const ids = new Set();
        (res.data.bookings || []).forEach(b => {
          if (b.tenant && (b.tenant._id || b.tenant)) {
            ids.add(b.tenant._id || b.tenant);
          }
        });
        setEligibleTenantIds(ids);
      } catch (e) {
        // silent fail; rating buttons simply won't show
      }
    };
    loadEligible();
  }, [currentUser]);

  const canRate = useMemo(() => currentUser && currentUser.role === 'owner', [currentUser]);

  const openRate = (tenant) => {
    setRateModal({ open: true, target: tenant });
    setRatingValue(5);
    setRatingComment('');
  };

  const submitRating = async () => {
    if (!rateModal.target) return;
    try {
      setSubmitting(true);
      await createUserRating({
        rateeId: rateModal.target._id,
        rating: Number(ratingValue),
        comment: ratingComment,
        context: 'tenant',
      });
      setRateModal({ open: false, target: null });
      // Optionally, refresh list or show toast; keeping minimal
    } catch (e) {
      alert(e.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">Tenants</h1>
        {error && <div className="mb-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded">{error}</div>}
        {loading ? (
          <div>Loading...</div>
        ) : tenants.length === 0 ? (
          <div className="text-neutral-500 dark:text-neutral-400">No tenants found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tenants.map((t) => (
              <div key={t._id} className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
                <div className="flex items-center gap-4">
                  {t.profileImage ? (
                    <img src={t.profileImage} alt={t.name || 'Tenant'} className="w-12 h-12 rounded-full object-cover border border-neutral-200 dark:border-neutral-700" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 font-semibold">
                      {(t.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{t.name}</h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.email}</p>
                    <div className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                      <span className="font-medium">Rating:</span>{' '}
                      <span title={`Average tenant rating`}>
                        {Number(t.avgRatingTenant || 0).toFixed(1)}
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400"> ({t.ratingCountTenant || 0})</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <Link
                    to={`/users/${t._id}`}
                    className="inline-flex items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 py-2 px-3 text-sm font-medium"
                  >
                    View Details
                  </Link>
                  {canRate && eligibleTenantIds.has(t._id) && (
                    <button
                      onClick={() => openRate(t)}
                      className="inline-flex items-center justify-center rounded-md bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-3 text-sm font-medium"
                    >
                      Rate Tenant
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rating Modal */}
      {rateModal.open && rateModal.target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Rate {rateModal.target.name}</h3>
            <label className="block text-sm text-neutral-700 dark:text-neutral-300 mb-2">Rating (1-5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={ratingValue}
              onChange={(e) => setRatingValue(e.target.value)}
              className="w-full mb-4 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent px-3 py-2 text-neutral-900 dark:text-white focus:outline-none"
            />
            <label className="block text-sm text-neutral-700 dark:text-neutral-300 mb-2">Comment (optional)</label>
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              className="w-full mb-4 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent px-3 py-2 text-neutral-900 dark:text-white focus:outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRateModal({ open: false, target: null })}
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 py-2 px-4 text-sm"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={submitRating}
                className="inline-flex items-center justify-center rounded-md bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 text-sm"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tenants;
