import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { getProperty, getPropertyReviews } from '../utils/api';

const PropertyReviews = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ averageRating: 0, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [pRes, rRes] = await Promise.all([
          getProperty(id),
          getPropertyReviews(id, { limit: 100 }),
        ]);
        setProperty(pRes.data.property || null);
        const reviewsData = rRes.data.reviews || [];
        setReviews(reviewsData);
        
        // Calculate accurate average rating from all reviews
        const totalRating = reviewsData.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = reviewsData.length > 0 ? totalRating / reviewsData.length : 0;
        
        setStats({ 
          averageRating: averageRating, 
          totalReviews: reviewsData.length 
        });
      } catch (e) {
        setError('Failed to load reviews');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const renderStars = (rating) => {
    return [1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`h-4 w-4 ${
          star <= rating ? 'text-yellow-400 fill-current' : 'text-neutral-300 dark:text-neutral-600'
        }`}
      />
    ));
  };

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
          {property && (
            <Link
              to={`/property/${id}`}
              className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              View Property
            </Link>
          )}
        </div>

        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-2">
          Reviews for {property ? property.title : 'Property'}
        </h1>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {renderStars(Math.round(stats.averageRating || 0))}
            </div>
            <span className="text-lg font-medium text-neutral-900 dark:text-white">
              {(stats.averageRating || 0).toFixed(1)}
            </span>
          </div>
          <span className="text-neutral-600 dark:text-neutral-400">
            ({stats.totalReviews} review{stats.totalReviews !== 1 ? 's' : ''})
          </span>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-600 dark:text-red-400">{error}</div>
        ) : reviews.length === 0 ? (
          <div className="text-neutral-600 dark:text-neutral-400">No reviews yet.</div>
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r._id} className="bg-white dark:bg-neutral-800 rounded-lg shadow p-4">
                <div className="flex items-start gap-4">
                  {r.tenant?.profileImage ? (
                    <img
                      src={r.tenant.profileImage}
                      alt={r.tenant?.name || 'Tenant'}
                      className="w-10 h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 font-semibold">
                      {(r.tenant?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-medium text-neutral-900 dark:text-white">{r.tenant?.name || 'Unknown'}</span>
                      <span className="text-neutral-500 dark:text-neutral-400">• {new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">Rating:</span>
                      <div className="flex items-center">
                        {renderStars(r.rating)}
                      </div>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">({r.rating}/5)</span>
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

export default PropertyReviews;
