import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUsers, getMyBookings, createUserRating } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 12;
// Bookings that make the other party eligible for rating
const RATEABLE_BOOKING_STATUSES = ['approved', 'completed'];

const Owners = () => {
  const { user: currentUser } = useAuth();
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [eligibleOwnerIds, setEligibleOwnerIds] = useState(() => new Set());
  const [rateModal, setRateModal] = useState({ open: false, target: null });
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await getUsers({ role: 'owner', page, limit: PAGE_SIZE });
        if (cancelled) return;
        setOwners(res.data.users || []);
        const pg = res.data.pagination || {};
        setPagination({ total: pg.total || 0, page: pg.page || page, pages: pg.pages || 1 });
      } catch (e) {
        if (!cancelled) setError('Failed to fetch owners');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [page]);

  // Load approved/completed bookings for current tenant to determine which owners can be rated
  useEffect(() => {
    const loadEligible = async () => {
      try {
        if (!currentUser || currentUser.role !== 'tenant') {
          setEligibleOwnerIds(new Set());
          return;
        }
        const res = await getMyBookings({ limit: 100 });
        const ids = new Set();
        (res.data.bookings || [])
          .filter(b => RATEABLE_BOOKING_STATUSES.includes(b.status))
          .forEach(b => {
            const id = b.property?.owner?._id || b.property?.owner;
            if (id) ids.add(String(id));
          });
        setEligibleOwnerIds(ids);
      } catch (e) {
        // silent
      }
    };
    loadEligible();
  }, [currentUser?._id, currentUser?.id, currentUser?.role]);

  const canRate = useMemo(() => currentUser && currentUser.role === 'tenant', [currentUser]);

  const openRate = (owner) => {
    setRateModal({ open: true, target: owner });
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
        context: 'owner',
      });
      setRateModal({ open: false, target: null });
    } catch (e) {
      alert(e.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">Owners</h1>
        {error && <div className="mb-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded-sm">{error}</div>}
        {loading ? (
          <div>Loading...</div>
        ) : owners.length === 0 ? (
          <div className="text-neutral-500 dark:text-neutral-400">No owners found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {owners.map((o) => (
              <div key={o._id} className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-4">
                  {o.profileImage ? (
                    <img src={o.profileImage} alt={o.name || 'Owner'} className="w-12 h-12 rounded-full object-cover border border-neutral-200 dark:border-neutral-700" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 font-semibold">
                      {(o.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{o.name}</h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{o.email}</p>
                    <div className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                      <span className="font-medium">Rating:</span>{' '}
                      <span title={`Average owner rating`}>
                        {Number(o.avgRatingOwner || 0).toFixed(1)}
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400"> ({o.ratingCountOwner || 0})</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <Link
                    to={`/users/${o._id}`}
                    className="inline-flex items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 py-2 px-3 text-sm font-medium"
                  >
                    View Details
                  </Link>
                  <Link
                    to={`/owners/${o._id}/properties`}
                    className="inline-flex items-center justify-center rounded-md bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-3 text-sm font-medium"
                  >
                    View Properties
                  </Link>
                  {canRate && eligibleOwnerIds.has(String(o._id)) && (
                    <button
                      onClick={() => openRate(o)}
                      className="inline-flex items-center justify-center rounded-md bg-amber-600 hover:bg-amber-700 text-white py-2 px-3 text-sm font-medium"
                    >
                      Rate Owner
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 py-2 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 py-2 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
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
            className="w-full mb-4 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent px-3 py-2 text-neutral-900 dark:text-white focus:outline-hidden"
          />
          <label className="block text-sm text-neutral-700 dark:text-neutral-300 mb-2">Comment (optional)</label>
          <textarea
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
            className="w-full mb-4 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent px-3 py-2 text-neutral-900 dark:text-white focus:outline-hidden"
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
    </>
  );
};

export default Owners;
