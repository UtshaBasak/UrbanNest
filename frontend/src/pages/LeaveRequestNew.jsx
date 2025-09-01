import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { createLeaveRequest, getMyBookings } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const LeaveRequestNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [message, setMessage] = useState('');
  const bookingId = params.get('bookingId') || '';

  const [submitting, setSubmitting] = useState(false);
  const [bookings, setBookings] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await getMyBookings();
        setBookings(res?.data?.bookings || []);
      } catch (e) {
        console.error('Failed to load bookings', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const approvedBookings = useMemo(() => (bookings || []).filter(b => b.status === 'approved'), [bookings]);

  const [selectedBookingId, setSelectedBookingId] = useState(bookingId || '');

  // Ensure selection is set once bookings arrive; prefer query param if valid
  React.useEffect(() => {
    if (!approvedBookings || approvedBookings.length === 0) return;
    // If current selection is invalid or empty, set a sensible default
    const exists = selectedBookingId && approvedBookings.some(b => b._id === selectedBookingId);
    const queryValid = bookingId && approvedBookings.some(b => b._id === bookingId);
    if (!exists) {
      setSelectedBookingId(queryValid ? bookingId : approvedBookings[0]._id);
    }
  }, [approvedBookings, bookingId, selectedBookingId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBookingId) {
      alert('Select a booking');
      return;
    }
    try {
      setSubmitting(true);
      await createLeaveRequest({ bookingId: selectedBookingId, message });
      alert('Leave request submitted');
      navigate('/leave-requests');
    } catch (err) {
      console.error(err);
      alert(err?.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || user.role !== 'tenant') {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-neutral-600 dark:text-neutral-300">Only tenants can submit leave requests.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-4">Request to Leave</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Booking</label>
              <select
                className="mt-1 w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-md p-2"
                value={selectedBookingId}
                onChange={(e) => setSelectedBookingId(e.target.value)}
                disabled={loading}
              >
                {(approvedBookings || []).length === 0 && (
                  <option value="">No active bookings</option>
                )}
                {(approvedBookings || []).map(b => (
                  <option key={b._id} value={b._id}>
                    {b.property?.title || 'Property'} ({new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()})
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500 mt-1">Only active (approved) bookings are eligible.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Message to Owner (optional)</label>
              <textarea
                className="mt-1 w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-md p-2"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explain why you need to leave early..."
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting || !selectedBookingId}
                className="inline-flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
              <Link to="/leave-requests" className="text-cyan-600 hover:underline">View My Leave Requests</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestNew;
