import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Star, ArrowLeft } from 'lucide-react';
import { canReviewProperty, createReview, getProperty } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const PropertyReviewNew = () => {
  const { id } = useParams(); // property id
  const navigate = useNavigate();
  const { user } = useAuth();

  const [eligible, setEligible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [property, setProperty] = useState(null);

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        setChecking(true);
        // Must be logged-in tenant
        if (!user || user.role !== 'tenant') {
          setEligible(false);
          setError('Only tenants can review properties.');
          return;
        }
        const [eligRes, propRes] = await Promise.all([
          canReviewProperty(id),
          getProperty(id)
        ]);
        setProperty(propRes?.data?.property || null);
        const allowed = !!eligRes?.data?.canReview;
        setEligible(allowed);
        if (!allowed) {
          setError('You are not eligible to review this property. You must have completed at least one booking.');
        }
      } catch (e) {
        setEligible(false);
        setError(e?.message || 'Failed to verify eligibility');
      } finally {
        setChecking(false);
      }
    };
    if (id) init();
  }, [id, user?._id, user?.role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!eligible) return;
    try {
      setSubmitting(true);
      await createReview({ property: id, rating: Number(rating), comment });
      // Redirect to the property's reviews page
      navigate(`/properties/${id}/reviews`);
    } catch (e) {
      setError(e?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (value) => {
    return [1,2,3,4,5].map((v) => (
      <button
        key={v}
        type="button"
        onMouseEnter={() => setHoverRating(v)}
        onMouseLeave={() => setHoverRating(0)}
        onClick={() => setRating(v)}
        className="p-1"
        aria-label={`Rate ${v} star${v>1?'s':''}`}
      >
        <Star className={(hoverRating || rating) >= v ? 'h-6 w-6 text-yellow-400 fill-current' : 'h-6 w-6 text-neutral-400'} />
      </button>
    ));
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="h-6 w-40 bg-neutral-200 dark:bg-neutral-700 rounded mb-4 animate-pulse" />
          <div className="h-64 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </button>
          <Link
            to={`/properties/${id}/reviews`}
            className="text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            View all reviews
          </Link>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-1">Review Property</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            {property?.title ? `Share your experience about "${property.title}"` : 'Share your experience'}
          </p>

          {!eligible && (
            <div className="p-4 rounded-md bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 mb-6">
              {error || 'You are not eligible to review this property.'}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Your rating
              </label>
              <div className="flex items-center gap-1">
                {renderStars(rating)}
                <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">{rating} / 5</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Your review (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
                placeholder="What did you like or dislike? Any tips for future tenants?"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(`/properties/${id}`)}
                className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!eligible || submitting}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PropertyReviewNew;
