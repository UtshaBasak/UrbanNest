import Booking from '../models/Booking.js';
import Transaction from '../models/Transaction.js';
import Property from '../models/Property.js';
import { createNotification } from '../controllers/notificationController.js';

// Helper: previous month start and end dates
function getPreviousMonthRange(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11 for current month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const start = new Date(prevYear, prevMonth, 1, 0, 0, 0, 0);
  const end = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999); // last day of prev month
  return { start, end, prevMonthNumber: prevMonth + 1, prevYear };
}

async function checkMonthlyDuesAndNotify() {
  try {
    const now = new Date();
    const { start, end, prevMonthNumber, prevYear } = getPreviousMonthRange(now);

    // Only run reminders after the month ended, and every 2 days thereafter
    if (now <= end) return;
    const daysSinceEnd = Math.floor((now - end) / (1000 * 60 * 60 * 24));
    if (daysSinceEnd < 2) return;
    if (daysSinceEnd % 2 !== 0) return; // run every 2 days

    // Find bookings overlapping previous month and approved
    const bookings = await Booking.find({
      status: 'approved',
      startDate: { $lte: end },
      endDate: { $gte: start }
    }).populate([
      { path: 'tenant', select: 'name email' },
      { path: 'property', select: 'title owner price', populate: { path: 'owner', select: 'name email' } }
    ]);

    for (const b of bookings) {
      if (!b?.property) continue;
      const expected = Number(b.property.price || 0);
      if (!expected || expected <= 0) continue;

      const existing = await Transaction.findOne({
        booking: b._id,
        month: prevMonthNumber,
        year: prevYear
      });

      const totalPaid = Number(existing?.totalPaid || 0);
      const totalExpected = Number(existing?.totalExpected || expected);
      const due = Math.max(totalExpected - totalPaid, 0);
      if (due <= 0) continue; // fully paid

      const monthLabel = new Date(prevYear, prevMonthNumber - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
      const msg = `Monthly rent due for ${b.property.title} (${monthLabel}). Paid $${totalPaid.toLocaleString()} of $${totalExpected.toLocaleString()}. Due $${due.toLocaleString()}.`;

      // Notify tenant
      await createNotification({
        user: b.tenant?._id || b.tenant,
        title: 'Rent due reminder',
        message: msg,
        link: `/dashboard?tab=transactions`,
        meta: { bookingId: b._id, propertyId: b.property._id, month: prevMonthNumber, year: prevYear }
      });

      // Notify owner
      await createNotification({
        user: b.property.owner?._id || b.property.owner,
        title: 'Tenant due reminder',
        message: msg,
        link: `/dashboard?tab=transactions`,
        meta: { bookingId: b._id, propertyId: b.property._id, month: prevMonthNumber, year: prevYear }
      });
    }
  } catch (err) {
    console.error('Monthly due reminders error:', err?.message || err);
  }
}

let intervalId;
export function startRemindersScheduler() {
  // Run once at startup (non-blocking)
  setTimeout(() => { checkMonthlyDuesAndNotify(); }, 10_000);
  // Then check daily at ~02:00 server time
  const oneHour = 60 * 60 * 1000;
  // Run every 12 hours to be resilient (it’ll self-throttle to every other day using daysSinceEnd % 2)
  intervalId = setInterval(checkMonthlyDuesAndNotify, 12 * oneHour);
  console.log('Reminder scheduler started');
}

export function stopRemindersScheduler() {
  if (intervalId) clearInterval(intervalId);
}
