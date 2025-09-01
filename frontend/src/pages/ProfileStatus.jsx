import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getPropertiesByOwner, getMyBookings, getMyTransactions, getUserRatingSummary, createMonthlyPayment, deleteTransaction, getUser } from '../utils/api';
import { Calendar, DollarSign, MapPin, ChevronRight, Star } from 'lucide-react';

const Section = ({ title, children }) => (
  <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-6">
    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">{title}</h2>
    {children}
  </div>
);

const ProfileStatus = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ownerProps, setOwnerProps] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [ratingSummary, setRatingSummary] = useState({ owner: { avg: 0, count: 0 }, tenant: { avg: 0, count: 0 } });
  const [ownerDetails, setOwnerDetails] = useState({}); // Cache for owner details by property ID
  const isOwner = user?.role === 'owner';
  // Track selected year for each booking's monthly breakdown
  const [selectedYearByBooking, setSelectedYearByBooking] = useState({});

  // Filters and UI state
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Tenant payment form state
  const [payBookingId, setPayBookingId] = useState('');
  const [payMonthName, setPayMonthName] = useState('');
  const [payMonth, setPayMonth] = useState('');
  const [payYear, setPayYear] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payExpected, setPayExpected] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const tasks = [];
        let propsIdx = -1, bookingsIdx = -1, transactionsIdx = -1, ratingIdx = -1;
        if (isOwner) {
          propsIdx = tasks.push(getPropertiesByOwner(user._id || user.id)) - 1;
        }
        bookingsIdx = tasks.push(getMyBookings()) - 1;
        transactionsIdx = tasks.push(getMyTransactions({
          search: search || undefined,
          month: filterMonth || undefined,
          year: filterYear || undefined,
          status: filterStatus || undefined
        })) - 1;
        ratingIdx = tasks.push(getUserRatingSummary(user._id || user.id)) - 1;
        const res = await Promise.allSettled(tasks);
        if (propsIdx > -1) setOwnerProps(res[propsIdx].status === 'fulfilled' ? (res[propsIdx].value.data.properties || []) : []);
        if (bookingsIdx > -1) setBookings(res[bookingsIdx].status === 'fulfilled' ? (res[bookingsIdx].value.data.bookings || []) : []);
        if (transactionsIdx > -1) setTransactions(res[transactionsIdx].status === 'fulfilled' ? (res[transactionsIdx].value.data.transactions || []) : []);
        if (ratingIdx > -1) {
          const def = { owner: { avg: 0, count: 0 }, tenant: { avg: 0, count: 0 } };
          if (res[ratingIdx].status === 'fulfilled') {
            setRatingSummary(res[ratingIdx].value.data?.summary || def);
          } else {
            setRatingSummary(def);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user, isOwner, search, filterMonth, filterYear, filterStatus, refreshKey]);

  // Compute payment summary for a booking from this page's transactions
  const computeBookingPaymentSummary = (booking) => {
    if (!booking) return { months: [], expectedTotal: 0, paidTotal: 0, dueTotal: 0, totalBookingCost: 0 };
    const price = Number(booking?.property?.price || 0);
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    if (isNaN(start) || isNaN(end) || price <= 0) {
      return { months: [], expectedTotal: 0, paidTotal: 0, dueTotal: 0, totalBookingCost: 0 };
    }
    // Build list of months between start and end inclusive
    const months = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= endCursor) {
      const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      months.push({
        year: cursor.getFullYear(),
        month: cursor.getMonth() + 1,
        label: monthLabel,
        expected: price,
        paid: 0
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    // Calculate total booking cost (monthly_rent × total_months_booked)
    const totalBookingCost = months.length * price;
    
    // Sum payments from transactions for this booking grouped by month/year
    const txns = (transactions || []).filter(t => (t.booking === booking._id) || (t.booking?._id === booking._id));
    txns.forEach(t => {
      const created = new Date(t.createdAt);
      const year = t.year || (isNaN(created) ? undefined : created.getFullYear());
      const month = t.month || (isNaN(created) ? undefined : created.getMonth() + 1);
      const amount = Number(t.amount || t.totalPaid || 0);
      if (!year || !month || !amount) return;
      const entry = months.find(mm => mm.year === year && mm.month === month);
      if (entry) entry.paid += amount;
    });
    const expectedTotal = months.reduce((s, mm) => s + mm.expected, 0);
    const paidTotal = months.reduce((s, mm) => s + Math.min(mm.paid, mm.expected), 0);
    const dueTotal = Math.max(expectedTotal - paidTotal, 0);
    return { months, expectedTotal, paidTotal, dueTotal, totalBookingCost };
  };

  // Fetch owner details for properties
  const fetchOwnerDetails = async (propertyId, ownerId) => {
    if (!ownerId || ownerDetails[propertyId]) return;
    try {
      const response = await getUser(ownerId);
      if (response?.data?.user) {
        setOwnerDetails(prev => ({ ...prev, [propertyId]: response.data.user }));
      }
    } catch (error) {
      console.error('Failed to fetch owner details:', error);
    }
  };

  // Fetch owner details for all bookings
  useEffect(() => {
    if (!isOwner && bookings.length > 0) {
      bookings.forEach(booking => {
        const propertyId = booking.property?._id;
        const ownerId = booking.property?.owner?._id || booking.property?.owner;
        if (propertyId && ownerId) {
          fetchOwnerDetails(propertyId, ownerId);
        }
      });
    }
  }, [bookings, isOwner]);

  // No category grouping per requirement
  const ownerList = useMemo(() => (isOwner ? ownerProps : []), [ownerProps, isOwner]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-6 w-40 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-4" />
          <div className="h-48 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Profile Status</h1>
        </div>

        {/* My Rating */}
        <Section title="My Rating">
          <div className="flex items-center gap-3 text-neutral-800 dark:text-neutral-100">
            <Star className="h-5 w-5 text-yellow-400" />
            {isOwner ? (
              <div>
                <span className="font-medium">Owner Rating:</span> {Number(ratingSummary.owner.avg || 0).toFixed(1)}
                <span className="text-neutral-500 dark:text-neutral-400"> ({ratingSummary.owner.count || 0})</span>
              </div>
            ) : (
              <div>
                <span className="font-medium">Tenant Rating:</span> {Number(ratingSummary.tenant.avg || 0).toFixed(1)}
                <span className="text-neutral-500 dark:text-neutral-400"> ({ratingSummary.tenant.count || 0})</span>
              </div>
            )}
          </div>
        </Section>

        {isOwner ? (
          <>
            <Section title="Owned Properties">
              {ownerList.length === 0 ? (
                <div className="text-neutral-500 dark:text-neutral-400">No properties yet.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ownerList.map(p => (
                    <div key={p._id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-neutral-900 dark:text-white line-clamp-1">{p.title}</div>
                          <div className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center mt-1">
                            <MapPin className="h-4 w-4 mr-1" /> {p.location || '—'}
                          </div>
                          <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                            ${(p.price || 0).toLocaleString()} / month
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/property/${p._id}`)}
                          className="ml-4 p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Recent Transactions">
              {transactions.length === 0 ? (
                <div className="text-neutral-500 dark:text-neutral-400">No transactions.</div>
              ) : (
                <div className="space-y-2">
                  {transactions.slice(0, 10).map(t => (
                    <div key={t._id} className="flex items-center justify-between border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <div>
                          <div className="text-sm text-neutral-900 dark:text-white">${(t.amount || 0).toLocaleString()} • {t.status || 'pending'}</div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-400">{t.property?.title || 'Property'}</div>
                        </div>
                      </div>
                      <div className="text-xs text-neutral-500">{new Date(t.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        ) : (
          <>
            <Section title="My Rental History">
              {bookings.length === 0 ? (
                <div className="text-neutral-500 dark:text-neutral-400">No bookings yet.</div>
              ) : (
                <div className="space-y-3">
                  {bookings.map(b => {
                    const summary = computeBookingPaymentSummary(b);
                    return (
                      <div key={b._id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-cyan-600" />
                            <div>
                              <div className="text-sm text-neutral-900 dark:text-white">
                                <button 
                                  onClick={() => navigate(`/properties/${b.property?._id}`)}
                                  className="hover:text-cyan-600 hover:underline transition-colors"
                                >
                                  {b.property?.title || 'Property'}
                                </button>
                                <span className="mx-2">•</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  b.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                                  b.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                  b.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300'
                                }`}>
                                  {b.status || 'Unknown'}
                                </span>
                              </div>
                              <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                                {(() => {
                                  const propertyId = b.property?._id;
                                  const owner = ownerDetails[propertyId];
                                  const ownerId = b.property?.owner?._id || b.property?.owner;
                                  return (
                                    <span>
                                      Owner: {owner ? (
                                        <button 
                                          onClick={() => navigate(`/users/${ownerId}`)}
                                          className="text-cyan-600 hover:text-cyan-700 hover:underline transition-colors"
                                        >
                                          {owner.name || owner.email || 'Unknown'}
                                        </button>
                                      ) : (
                                        <span className="text-neutral-500">Loading...</span>
                                      )}
                                      <span className="ml-3">• {new Date(b.createdAt).toLocaleDateString()}</span>
                                    </span>
                                  );
                                })()} 
                              </div>
                            </div>
                          </div>
                          <button onClick={() => navigate(`/properties/${b.property?._id}`)} className="text-xs text-cyan-600 hover:underline">View</button>
                        </div>
                        {/* Payment summary - Fixed independent section */}
                        <div className="mt-3 mb-4 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 h-[120px] flex-shrink-0">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm h-full">
                            <div className="bg-white dark:bg-neutral-900 rounded-md p-3 border border-neutral-200 dark:border-neutral-600 flex flex-col justify-center">
                              <div className="text-neutral-500 dark:text-neutral-400 text-xs font-medium mb-1">Monthly Rent</div>
                              <div className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">${Number(b?.property?.price || 0).toLocaleString()}</div>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 rounded-md p-3 border border-neutral-200 dark:border-neutral-600 flex flex-col justify-center">
                              <div className="text-neutral-500 dark:text-neutral-400 text-xs font-medium mb-1">Total Cost</div>
                              <div className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">${summary.expectedTotal.toLocaleString()}</div>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 rounded-md p-3 border border-neutral-200 dark:border-neutral-600 flex flex-col justify-center">
                              <div className="text-neutral-500 dark:text-neutral-400 text-xs font-medium mb-1">Paid</div>
                              <div className="font-semibold text-lg text-green-600 dark:text-green-400">${summary.paidTotal.toLocaleString()}</div>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 rounded-md p-3 border border-neutral-200 dark:border-neutral-600 flex flex-col justify-center">
                              <div className="text-neutral-500 dark:text-neutral-400 text-xs font-medium mb-1">Due</div>
                              <div className="font-semibold text-lg text-red-600 dark:text-red-400">${summary.dueTotal.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                        {summary.months.length > 0 && (() => {
                          const years = Array.from(new Set(summary.months.map(mm => mm.year))).sort((a,b)=>a-b);
                          const defaultYear = years[years.length - 1];
                          const selectedYear = selectedYearByBooking[b._id] ?? defaultYear;
                          const monthsToShow = summary.months.filter(mm => mm.year === selectedYear);
                          return (
                            <>
                              <div className="mt-2 flex gap-2 flex-wrap">
                                {years.map(y => (
                                  <button
                                    key={y}
                                    type="button"
                                    onClick={() => setSelectedYearByBooking(prev => ({ ...prev, [b._id]: y }))}
                                    aria-pressed={y === selectedYear}
                                    className={`text-xs px-2 py-1 rounded border transition-colors ${y === selectedYear ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600'}`}
                                  >
                                    {y}
                                  </button>
                                ))}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {monthsToShow.map(m => {
                                  const paidEnough = m.paid >= m.expected && m.expected > 0;
                                  const partial = m.paid > 0 && m.paid < m.expected;
                                  const cls = paidEnough
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                    : partial
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
                                  return (
                                    <span key={`${m.year}-${m.month}`} className={`text-xs px-2 py-1 rounded ${cls}`}>
                                      {m.label}: Paid ${m.paid.toLocaleString()} out of ${m.expected.toLocaleString()}
                                      {(m.expected - m.paid) > 0 && ` | Due $${(m.expected - m.paid).toLocaleString()}`}
                                    </span>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Tenant Payment Form */}
            <Section title="Make a Payment">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <select className="border rounded p-2 dark:bg-neutral-800 dark:border-neutral-700" value={payBookingId} onChange={(e) => {
                  const bookingId = e.target.value;
                  setPayBookingId(bookingId);
                  const b = (bookings || []).find(x => x._id === bookingId);
                  if (b && b.property && typeof b.property.price === 'number') {
                    // Check if there's a partial payment for current month/year
                    const currentMonth = Number(payMonth);
                    const currentYear = Number(payYear);
                    if (currentMonth && currentYear) {
                      const existingTxn = (transactions || []).find(t => 
                        (t.booking === bookingId || t.booking?._id === bookingId) &&
                        t.month === currentMonth && t.year === currentYear
                      );
                      if (existingTxn) {
                        const paid = Number(existingTxn.totalPaid || existingTxn.amount || 0);
                        const expected = Number(existingTxn.totalExpected || b.property.price);
                        const due = Math.max(expected - paid, 0);
                        setPayAmount(due > 0 ? String(due) : String(b.property.price));
                      } else {
                        setPayAmount(String(b.property.price));
                      }
                    } else {
                      setPayAmount(String(b.property.price));
                    }
                  }
                }}>
                  <option value="">Select Booking</option>
                  {bookings.map(b => (
                    <option key={b._id} value={b._id}>{b.property?.title} ({new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()})</option>
                  ))}
                </select>
                <input className="border rounded p-2 dark:bg-neutral-800 dark:border-neutral-700" placeholder="Month Name (e.g., January)" value={payMonthName} onChange={e => setPayMonthName(e.target.value)} />
                <input className="border rounded p-2 dark:bg-neutral-800 dark:border-neutral-700" placeholder="Month # (1-12)" value={payMonth} onChange={(e) => {
                  const month = e.target.value;
                  setPayMonth(month);
                  // Auto-adjust amount based on due for this month
                  if (payBookingId && month && payYear) {
                    const b = (bookings || []).find(x => x._id === payBookingId);
                    const existingTxn = (transactions || []).find(t => 
                      (t.booking === payBookingId || t.booking?._id === payBookingId) &&
                      t.month === Number(month) && t.year === Number(payYear)
                    );
                    if (existingTxn && b?.property?.price) {
                      const paid = Number(existingTxn.totalPaid || existingTxn.amount || 0);
                      const expected = Number(existingTxn.totalExpected || b.property.price);
                      const due = Math.max(expected - paid, 0);
                      setPayAmount(due > 0 ? String(due) : String(b.property.price));
                    } else if (b?.property?.price) {
                      setPayAmount(String(b.property.price));
                    }
                  }
                }} />
                <input className="border rounded p-2 dark:bg-neutral-800 dark:border-neutral-700" placeholder="Year (e.g., 2025)" value={payYear} onChange={(e) => {
                  const year = e.target.value;
                  setPayYear(year);
                  // Auto-adjust amount based on due for this year/month
                  if (payBookingId && payMonth && year) {
                    const b = (bookings || []).find(x => x._id === payBookingId);
                    const existingTxn = (transactions || []).find(t => 
                      (t.booking === payBookingId || t.booking?._id === payBookingId) &&
                      t.month === Number(payMonth) && t.year === Number(year)
                    );
                    if (existingTxn && b?.property?.price) {
                      const paid = Number(existingTxn.totalPaid || existingTxn.amount || 0);
                      const expected = Number(existingTxn.totalExpected || b.property.price);
                      const due = Math.max(expected - paid, 0);
                      setPayAmount(due > 0 ? String(due) : String(b.property.price));
                    } else if (b?.property?.price) {
                      setPayAmount(String(b.property.price));
                    }
                  }
                }} />
                <input className="border rounded p-2 dark:bg-neutral-800 dark:border-neutral-700" placeholder="Amount Paid" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                <input className="border rounded p-2 dark:bg-neutral-800 dark:border-neutral-700" placeholder="Total Expected (optional)" value={payExpected} onChange={e => setPayExpected(e.target.value)} />
              </div>
              <div className="mt-3">
                <button
                  disabled={submitting}
                  onClick={async () => {
                    if (!payBookingId || !payAmount) return;
                    try {
                      setSubmitting(true);
                      const b = (bookings || []).find(x => x._id === payBookingId);
                      const derivedExpected = b && b.property && typeof b.property.price === 'number' ? Number(b.property.price) : undefined;
                      const monthIdx = payMonth ? Number(payMonth) : undefined;
                      const computedMonthName = payMonthName || (monthIdx && monthIdx >= 1 && monthIdx <= 12
                        ? new Date(2000, monthIdx - 1, 1).toLocaleString(undefined, { month: 'long' })
                        : undefined);
                      await createMonthlyPayment({
                        bookingId: payBookingId,
                        month: payMonth ? Number(payMonth) : undefined,
                        year: payYear ? Number(payYear) : undefined,
                        monthName: computedMonthName,
                        amount: Number(payAmount),
                        totalExpected: payExpected ? Number(payExpected) : derivedExpected,
                        paymentMethod: 'credit_card'
                      });
                      // reset
                      setPayAmount('');
                      setPayExpected('');
                      setPayMonth('');
                      setPayYear('');
                      setPayMonthName('');
                      setRefreshKey(k => k + 1);
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-60"
                >
                  {submitting ? 'Submitting...' : 'Submit Payment'}
                </button>
              </div>
            </Section>

            <Section title="My Transactions">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
                <input className="border rounded p-2 dark:bg-neutral-800 dark:border-neutral-700" placeholder="Search by property/owner/month" value={search} onChange={e => setSearch(e.target.value)} />
                <input className="border rounded p-2 dark:bg-neutral-800 dark:border-neutral-700" placeholder="Month #" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
                <input className="border rounded p-2 dark:bg-neutral-800 dark:border-neutral-700" placeholder="Year" value={filterYear} onChange={e => setFilterYear(e.target.value)} />
                <select className="border rounded p-2 dark:bg-neutral-800 dark:border-neutral-700" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid (Partial)</option>
                  <option value="pending">Pending</option>
                </select>
                <button className="border rounded p-2 dark:border-neutral-700" onClick={() => { setSearch(''); setFilterMonth(''); setFilterYear(''); setFilterStatus(''); }}>Clear</button>
              </div>
              {transactions.length === 0 ? (
                <div className="text-neutral-500 dark:text-neutral-400">No transactions.</div>
              ) : (
                <div className="space-y-2">
                  {transactions.map(t => {
                    const expected = Number(t.totalExpected ?? t.amount ?? 0);
                    const paid = Number(t.totalPaid ?? t.amount ?? 0);
                    const fullyPaid = paid >= expected && expected > 0;
                    const partiallyPaid = paid > 0 && paid < expected;
                    const statusLabel = fullyPaid ? 'Fully Paid' : partiallyPaid ? 'Partially Paid' : (t.status || 'Not Paid');
                    return (
                    <div key={t._id} className="flex items-center justify-between border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <div>
                          <div className="text-sm text-neutral-900 dark:text-white">{t.monthName ? `${t.monthName} • ` : ''}{statusLabel}</div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-400">{t.property?.title || 'Property'} • Paid ${paid.toLocaleString()} {expected ? `of $${expected.toLocaleString()}` : ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-neutral-500">{new Date(t.createdAt).toLocaleString()}</div>
                        <button className="text-xs text-red-600 hover:underline" onClick={async () => {
                          await deleteTransaction(t._id);
                          setRefreshKey(k => k + 1);
                        }}>Delete</button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileStatus;
