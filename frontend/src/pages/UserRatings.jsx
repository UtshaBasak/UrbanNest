import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { listUserRatings, getUser } from '../utils/api';

const UserRatings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [uRes, rRes] = await Promise.all([
          getUser(id),
          listUserRatings(id, { limit: 100 }),
        ]);
        setUser(uRes.data.user || null);
        setRatings(rRes.data.ratings || []);
      } catch (e) {
        setError('Failed to load rating details');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            Back
          </button>
          {user && (
            <Link
              to={`/users/${id}`}
              className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              View Profile
            </Link>
          )}
        </div>

        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-4">
          Ratings for {user ? user.name : 'User'}
        </h1>

        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-600 dark:text-red-400">{error}</div>
        ) : ratings.length === 0 ? (
          <div className="text-neutral-600 dark:text-neutral-400">No ratings yet.</div>
        ) : (
          <ul className="space-y-4">
            {ratings.map((r) => (
              <li key={r._id} className="bg-white dark:bg-neutral-800 rounded-lg shadow p-4">
                <div className="flex items-start gap-4">
                  {r.rater?.profileImage ? (
                    <img
                      src={r.rater.profileImage}
                      alt={r.rater?.name || 'Rater'}
                      className="w-10 h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 font-semibold">
                      {(r.rater?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-medium text-neutral-900 dark:text-white">{r.rater?.name || 'Unknown'}</span>
                      {r.rater?.role && (
                        <span className="text-neutral-500 dark:text-neutral-400">• {r.rater.role}</span>
                      )}
                      <span className="text-neutral-500 dark:text-neutral-400">• {new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-neutral-800 dark:text-neutral-200">
                      <span className="font-semibold">Rating:</span> {r.rating}
                      {r.context && (
                        <span className="ml-2 text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded">
                          {r.context}
                        </span>
                      )}
                    </div>
                    {r.comment && (
                      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                        {r.comment}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default UserRatings;
