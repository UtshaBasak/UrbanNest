import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyLeaveRequests, decideLeaveRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const statusPill = (status) => {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
  }
};

const LeaveRequests = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [decisionById, setDecisionById] = useState({});

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await listMyLeaveRequests();
      setItems(res?.data?.leaveRequests || []);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDecision = async (id, approve) => {
    const state = decisionById[id] || { condition: 'end_of_month', note: '' };
    try {
      await decideLeaveRequest(id, {
        decision: approve ? 'approve' : 'reject',
        condition: state.condition,
        note: state.note,
      });
      await fetchItems();
    } catch (e) {
      alert(e?.message || 'Failed to submit decision');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Leave Requests</h1>
          {user?.role === 'tenant' && (
            <Link
              to="/leave-requests/new"
              className="inline-flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
            >
              New Leave Request
            </Link>
          )}
        </div>

        {loading && <p className="text-neutral-600 dark:text-neutral-300">Loading...</p>}
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

        {!loading && items.length === 0 && (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6 text-center text-neutral-600 dark:text-neutral-300">
            No leave requests yet.
          </div>
        )}

        <div className="space-y-4">
          {items.map((lr) => (
            <div key={lr._id} className="bg-white dark:bg-neutral-800 rounded-lg shadow p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusPill(lr.status)}`}>{lr.status}</span>
                    {lr.condition && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        {lr.condition}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    Booking: <span className="font-medium">{lr.booking?.property?.title || 'Property'}</span>
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Period: {new Date(lr.booking?.startDate).toLocaleDateString()} - {new Date(lr.booking?.endDate).toLocaleDateString()}
                  </p>
                  {lr.message && (
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Message: {lr.message}</p>
                  )}
                  {lr.decisionNote && (
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Note: {lr.decisionNote}</p>
                  )}
                  {lr.effectiveEndDate && (
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      Effective End: {new Date(lr.effectiveEndDate).toLocaleString()}
                    </p>
                  )}
                </div>

                {user?.role !== 'tenant' && lr.status === 'pending' && (
                  <div className="w-full md:w-80 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300">Condition</label>
                      <select
                        className="mt-1 w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-md p-2"
                        value={decisionById[lr._id]?.condition || 'end_of_month'}
                        onChange={(e) => setDecisionById((s) => ({ ...s, [lr._id]: { ...(s[lr._id] || {}), condition: e.target.value } }))}
                      >
                        <option value="immediate">Immediate</option>
                        <option value="end_of_month">End of this month</option>
                        <option value="end_of_current_booking">End of current booking</option>
                        <option value="end_of_next_month">End of next month</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300">Note (optional)</label>
                      <textarea
                        className="mt-1 w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-md p-2"
                        rows={2}
                        value={decisionById[lr._id]?.note || ''}
                        onChange={(e) => setDecisionById((s) => ({ ...s, [lr._id]: { ...(s[lr._id] || {}), note: e.target.value } }))}
                        placeholder="Add a note for the tenant..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDecision(lr._id, true)}
                        className="inline-flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDecision(lr._id, false)}
                        className="inline-flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeaveRequests;
