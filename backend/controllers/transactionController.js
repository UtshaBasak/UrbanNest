import Transaction from '../models/Transaction.js';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import { createNotification } from './notificationController.js';

// @desc Get user transactions with grouping and filtering
// @route GET /api/transactions/my
// @access Private
export const getMyTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search, month, year, grouped = 'false' } = req.query;
    const query = {};

    if (req.user.role === 'tenant') {
      query.tenant = req.user._id;
    } else if (req.user.role === 'owner') {
      // Get transactions for properties owned by this user
      const userProperties = await Property.find({ owner: req.user._id }).select('_id');
      query.property = { $in: userProperties.map(p => p._id) };
    }

    // Apply filters
    if (status) query.status = status;
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    let transactions = await Transaction.find(query)
      .populate('tenant', 'name email profileImage')
      .populate('property', 'title location owner')
      .populate('booking', 'startDate endDate')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Apply search filter after population
    if (search) {
      const searchLower = search.toLowerCase();
      transactions = transactions.filter(txn => 
        txn.tenant?.name?.toLowerCase().includes(searchLower) ||
        txn.property?.title?.toLowerCase().includes(searchLower) ||
        txn.property?.location?.toLowerCase().includes(searchLower) ||
        txn.monthName?.toLowerCase().includes(searchLower) ||
        txn.description?.toLowerCase().includes(searchLower)
      );
    }

    const total = await Transaction.countDocuments(query);

    // Group transactions if requested
    let groupedData = null;
    if (grouped === 'true') {
      if (req.user.role === 'tenant') {
        // Group by owner, then by property
        const groups = {};
        for (const txn of transactions) {
          const ownerId = txn.property?.owner?.toString();
          const propertyId = txn.property?._id?.toString();
          if (!ownerId || !propertyId) continue;
          
          if (!groups[ownerId]) {
            groups[ownerId] = {
              owner: txn.property.owner,
              properties: {}
            };
          }
          if (!groups[ownerId].properties[propertyId]) {
            groups[ownerId].properties[propertyId] = {
              property: txn.property,
              transactions: []
            };
          }
          groups[ownerId].properties[propertyId].transactions.push(txn);
        }
        groupedData = groups;
      } else {
        // Group by property, then by tenant
        const groups = {};
        for (const txn of transactions) {
          const propertyId = txn.property?._id?.toString();
          const tenantId = txn.tenant?._id?.toString();
          if (!propertyId || !tenantId) continue;
          
          if (!groups[propertyId]) {
            groups[propertyId] = {
              property: txn.property,
              tenants: {}
            };
          }
          if (!groups[propertyId].tenants[tenantId]) {
            groups[propertyId].tenants[tenantId] = {
              tenant: txn.tenant,
              transactions: []
            };
          }
          groups[propertyId].tenants[tenantId].transactions.push(txn);
        }
        groupedData = groups;
      }
    }

    res.json({
      data: {
        transactions,
        groupedData,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get my transactions error:', error);
    res.status(500).json({ message: 'Server error while fetching transactions' });
  }
};

// @desc Update transaction status (mock payment)
// @route PUT /api/transactions/:id/pay
// @access Private (Tenant)
export const processPayment = async (req, res) => {
  try {
    const { paymentMethod = 'credit_card', desiredStatus } = req.body;
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Check if user owns the transaction
    if (transaction.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Determine new status; support explicit desiredStatus or default flow from pending->paid/unpaid
    const allowed = ['paid', 'unpaid', 'advanced'];
    let newStatus = 'paid';
    if (desiredStatus && allowed.includes(desiredStatus)) {
      newStatus = desiredStatus;
    }

    // Only allow transition from pending/unpaid/advanced to a new state by the tenant
    if (!['pending', 'unpaid', 'advanced'].includes(transaction.status)) {
      return res.status(400).json({ message: 'Transaction cannot be updated in its current state' });
    }

    transaction.status = newStatus; // align with Transaction schema enum
    transaction.paymentMethod = paymentMethod;
    if (newStatus === 'paid' || newStatus === 'advanced') {
      transaction.paymentDate = new Date();
    }

    await transaction.save();

    // Update booking status if fully paid
    if (newStatus === 'paid') {
      await Booking.findByIdAndUpdate(transaction.booking, { status: 'completed' });
    }

    const updatedTransaction = await Transaction.findById(transaction._id)
      .populate('tenant', 'name email')
      .populate('property', 'title location')
      .populate('booking', 'startDate endDate');

    // Notify tenant and property owner
    try {
      const booking = await Booking.findById(transaction.booking).populate('tenant', 'name').populate('property', 'title owner');
      const property = await Property.findById(booking.property._id).populate('owner', 'name');

      const statusText = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
      // Notify tenant
      await createNotification({
        user: transaction.tenant,
        title: `Transaction ${statusText}`,
        message: `Your transaction for ${property.title} is ${statusText}.`,
        link: `/dashboard?tab=transactions`,
        meta: { transactionId: transaction._id, bookingId: transaction.booking, propertyId: property._id }
      });
      // Notify owner
      await createNotification({
        user: property.owner._id,
        title: `Tenant payment ${statusText}`,
        message: `A tenant's payment for ${property.title} is ${statusText}.`,
        link: `/dashboard?tab=transactions`,
        meta: { transactionId: transaction._id, bookingId: transaction.booking, propertyId: property._id }
      });
    } catch (e) {
      console.error('Payment notification error:', e.message);
    }

    res.json({
      message: `Transaction marked as ${newStatus}`,
      data: { transaction: updatedTransaction }
    });

  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ message: 'Server error while processing payment' });
  }
};

// @desc Get transaction by ID
// @route GET /api/transactions/:id
// @access Private
export const getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price owner')
      .populate('booking', 'startDate endDate status');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Check access rights
    const isOwner = transaction.tenant._id.toString() === req.user._id.toString();
    const isPropertyOwner = Boolean(transaction.property?.owner) && transaction.property.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isPropertyOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ data: { transaction } });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ message: 'Server error while fetching transaction' });
  }
};

// ========================= NEW: Monthly Payments =========================

// @desc Create a monthly rent payment transaction
// @route POST /api/transactions/monthly-pay
// @access Private (Tenant)
export const createMonthlyPayment = async (req, res) => {
  try {
    const { bookingId, month, year, monthName, amount, paymentMethod = 'credit_card', totalExpected } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({ message: 'bookingId and amount are required' });
    }

    const booking = await Booking.findById(bookingId).populate('property', 'title owner price');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Tenant can only pay for their own booking
    if (booking.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const paidAmount = Number(amount);
    const expectedAmount = Number(totalExpected) || booking.property.price || paidAmount;
    
    // Check if there's already a transaction for this month/year/booking
    let existingTxn = null;
    if (month && year) {
      existingTxn = await Transaction.findOne({
        booking: booking._id,
        month: Number(month),
        year: Number(year)
      });
    }

    // Prevent overpayment - check remaining due amount
    const currentPaid = existingTxn ? (existingTxn.totalPaid || 0) : 0;
    const remainingDue = Math.max(expectedAmount - currentPaid, 0);
    
    if (paidAmount > remainingDue) {
      return res.status(400).json({ 
        message: `Payment amount ($${paidAmount}) exceeds remaining due amount ($${remainingDue})`,
        remainingDue: remainingDue,
        currentPaid: currentPaid,
        totalExpected: expectedAmount
      });
    }

    let txn;
    if (existingTxn) {
      // Update existing transaction (partial payment)
      existingTxn.totalPaid = (existingTxn.totalPaid || 0) + paidAmount;
      existingTxn.totalExpected = expectedAmount;
      existingTxn.amount = existingTxn.totalPaid; // Update amount to reflect total paid so far
      existingTxn.paymentDate = new Date();
      existingTxn.paymentMethod = paymentMethod;
      
      // Update status based on payment completion
      if (existingTxn.totalPaid >= existingTxn.totalExpected) {
        existingTxn.status = 'paid';
      } else {
        existingTxn.status = 'unpaid'; // partially paid
      }
      
      await existingTxn.save();
      txn = existingTxn;
    } else {
      // Create new transaction
      const status = paidAmount >= expectedAmount ? 'paid' : 'unpaid';
      txn = new Transaction({
        tenant: req.user._id,
        property: booking.property._id,
        booking: booking._id,
        amount: paidAmount,
        month: month ? Number(month) : undefined,
        year: year ? Number(year) : undefined,
        monthName: monthName || '',
        totalExpected: expectedAmount,
        totalPaid: paidAmount,
        status,
        paymentMethod,
        paymentDate: new Date(),
        description: monthName ? `Monthly rent for ${booking.property.title} - ${monthName}` : `Payment for ${booking.property.title}`
      });
      await txn.save();
    }

    // Notify owner
    try {
      const statusText = txn.totalPaid >= txn.totalExpected ? 'Fully Paid' : `Partially Paid ($${txn.totalPaid}/$${txn.totalExpected})`;
      await createNotification({
        user: booking.property.owner,
        title: 'Rent payment received',
        message: `${req.user.name || 'Tenant'} paid $${paidAmount.toLocaleString()} for ${booking.property.title}${monthName ? ` (${monthName})` : ''}. Status: ${statusText}`,
        link: `/dashboard?tab=transactions&transactionId=${txn._id}`,
        meta: { transactionId: txn._id, bookingId: booking._id, propertyId: booking.property._id }
      });
    } catch (e) {
      console.error('Monthly payment notification error:', e.message);
    }

    const populated = await Transaction.findById(txn._id)
      .populate('tenant', 'name email')
      .populate('property', 'title location')
      .populate('booking', 'startDate endDate');

    res.status(201).json({ message: 'Payment recorded successfully', data: { transaction: populated } });
  } catch (err) {
    console.error('Create monthly payment error:', err);
    res.status(500).json({ message: 'Server error while creating payment' });
  }
};

// @desc Get transactions by property (owner only)
// @route GET /api/transactions/property/:propertyId
// @access Private (Owner)
export const getTransactionsByProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    // Ensure requester is the owner of the property
    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (property.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const transactions = await Transaction.find({ property: propertyId })
      .populate('tenant', 'name email')
      .populate('booking', 'startDate endDate')
      .sort({ createdAt: -1 });

    res.json({ data: { transactions } });
  } catch (err) {
    res.status(500).json({ message: 'Server error while fetching transactions by property' });
  }
};

// @desc Delete a transaction
// @route DELETE /api/transactions/:id
// @access Private (Tenant can delete own; Owner can delete transactions for their property)
export const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const txn = await Transaction.findById(id).populate('property', 'owner');
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });

    const isTenant = txn.tenant.toString() === req.user._id.toString();
    const isOwner = txn.property.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isTenant && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Transaction.deleteOne({ _id: id });
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ message: 'Server error while deleting transaction' });
  }
};