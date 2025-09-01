import React, { useEffect, useState, useRef } from 'react';
import { getMyNotifications, markNotificationRead, markNotificationUnread, markAllNotificationsRead, markAllNotificationsUnread, deleteNotification } from '../utils/api';
import { Bell, CheckCircle2, ExternalLink, RefreshCw, Trash2, BellOff, Check } from 'lucide-react';

const POLL_MS = 15000; // 15s

const Notifications = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const timerRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAllExplicit, setSelectAllExplicit] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getMyNotifications({ unreadOnly });
      setItems(res.data.notifications || []);
    } catch (e) {
      setError('Failed to load notifications');
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => timerRef.current && clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  // Keep selection in sync when items change
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const idsInList = new Set(items.map((n) => n._id));
    const next = new Set();
    selectedIds.forEach((id) => { if (idsInList.has(id)) next.add(id); });
    if (next.size !== selectedIds.size) setSelectedIds(next);
  }, [items]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch (e) {
      alert('Failed to mark as read');
    }
  };

  const handleMarkUnread = async (id) => {
    try {
      await markNotificationUnread(id);
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: false } : n)));
    } catch (e) {
      alert('Failed to mark as unread');
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      alert('Failed to mark all as read');
    }
  };

  const handleMarkAllUnread = async () => {
    try {
      await markAllNotificationsUnread();
      setItems((prev) => prev.map((n) => ({ ...n, read: false })));
    } catch (e) {
      alert('Failed to mark all as unread');
    }
  };

  const toggleSelect = (id) => {
    console.log('Toggling notification:', id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        console.log('Removing from selection:', id);
        next.delete(id);
      } else {
        console.log('Adding to selection:', id);
        next.add(id);
      }
      console.log('New selection:', Array.from(next));
      return next;
    });
    // Individual toggles should not mark select-all as explicitly checked
    setSelectAllExplicit(false);
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const selectAllRef = useRef(null);
  useEffect(() => {
    if (selectAllRef.current) {
      // Do not show indeterminate automatically; only user action controls this checkbox
      selectAllRef.current.indeterminate = false;
    }
  }, [selectAllExplicit, allSelected]);
  const toggleSelectAll = () => {
    if (allSelected && selectAllExplicit) {
      setSelectedIds(new Set());
      setSelectAllExplicit(false);
    } else {
      setSelectedIds(new Set(items.map((n) => n._id)));
      setSelectAllExplicit(true);
    }
  };

  const hasUnread = items.some((n) => !n.read);

  const handleMarkAllToggle = async () => {
    if (hasUnread) {
      await handleMarkAll();
    } else {
      await handleMarkAllUnread();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setBulkLoading(true);
      const ids = Array.from(selectedIds);
      // Optimistic UI: remove immediately
      setItems((prev) => prev.filter((n) => !selectedIds.has(n._id)));
      setSelectedIds(new Set());
      // Perform deletes sequentially to avoid overwhelming server
      for (const id of ids) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await deleteNotification(id);
        } catch (e) {
          // If any delete fails, reload to be safe
          // eslint-disable-next-line no-console
          console.error('Delete failed for notification', id, e);
        }
      }
    } catch (e) {
      alert('Bulk delete failed');
      // Reload from server to ensure consistency
      load();
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Bell className="h-6 w-6" /> Notifications
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load()}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleMarkAllToggle}
              className={`p-1.5 rounded-lg ${hasUnread ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600'}`}
              title={hasUnread ? 'Mark all as read' : 'Mark all as unread'}
              aria-label={hasUnread ? 'Mark all as read' : 'Mark all as unread'}
            >
              {hasUnread ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Filters and Bulk actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 select-none">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  className={`appearance-none h-4 w-4 rounded-full border-2 cursor-pointer transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-0 ${
                    unreadOnly
                      ? 'border-green-500 dark:border-green-400 bg-white dark:bg-neutral-800'
                      : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800'
                  }`}
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  aria-checked={unreadOnly ? 'true' : 'false'}
                />
                {unreadOnly && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400"></div>
                  </div>
                )}
              </div>
              Unread only
            </label>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 select-none">
              <div className="relative flex items-center justify-center">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className={`appearance-none h-4 w-4 rounded-full border-2 cursor-pointer transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-0 ${
                    (selectAllExplicit && allSelected)
                      ? 'border-green-500 dark:border-green-400 bg-white dark:bg-neutral-800'
                      : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800'
                  }`}
                  checked={selectAllExplicit && allSelected}
                  onChange={toggleSelectAll}
                  aria-checked={selectAllExplicit && allSelected ? 'true' : 'false'}
                />
                {(selectAllExplicit && allSelected) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400"></div>
                  </div>
                )}
              </div>
              Select all
            </label>
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || bulkLoading}
              className="p-1.5 rounded-lg bg-red-600 text-white disabled:opacity-50 hover:bg-red-700 inline-flex items-center"
              title={bulkLoading ? 'Deleting…' : selectedIds.size > 1 ? `Delete ${selectedIds.size} selected` : selectedIds.size === 1 ? 'Delete selected' : 'Delete'}
              aria-label="Delete selected"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-100 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-neutral-600 dark:text-neutral-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-neutral-600 dark:text-neutral-400">No notifications.</div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => (
              <div
                key={n._id}
                className={`border rounded-lg p-4 transition-colors ${selectedIds.has(n._id)
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'
                  : n.read
                    ? 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    : 'bg-blue-50/60 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className="relative flex items-center justify-center mt-1">
                        <input
                          type="checkbox"
                          className={`appearance-none h-4 w-4 rounded-full border-2 cursor-pointer transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-0 ${
                            selectedIds.has(n._id)
                              ? 'border-green-500 dark:border-green-400 bg-white dark:bg-neutral-800'
                              : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800'
                          }`}
                          checked={selectedIds.has(n._id)}
                          onChange={(e) => {
                            console.log('Checkbox changed:', e.target.checked, 'for notification:', n._id);
                            toggleSelect(n._id);
                            e.stopPropagation();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Select notification"
                        />
                        {selectedIds.has(n._id) && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400"></div>
                          </div>
                        )}
                      </div>
                      <div>
                        {selectedIds.has(n._id) && (
                          <div className="mb-1 inline-flex items-center gap-1 text-green-700 dark:text-green-300 text-xs font-medium">
                            <Check className="h-3.5 w-3.5" /> Selected
                          </div>
                        )}
                        <h3 className="font-medium text-neutral-900 dark:text-white">{n.title}</h3>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1">{n.message}</p>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {n.link && (
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 underline decoration-transparent hover:decoration-current underline-offset-4 decoration-2 transition-colors text-sm"
                        title="View"
                        aria-label="View"
                      >
                        View
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {!n.read ? (
                      <button
                        onClick={() => handleMarkRead(n._id)}
                        className="p-1.5 rounded-md border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkUnread(n._id)}
                        className="p-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        title="Mark as unread"
                        aria-label="Mark as unread"
                      >
                        <BellOff className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
