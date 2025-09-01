import express from 'express';
import { body } from 'express-validator';
import {
  getMyTransactions,
  processPayment,
  getTransaction,
  createMonthlyPayment,
  getTransactionsByProperty,
  deleteTransaction
} from '../controllers/transactionController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// Validation rules
const paymentValidation = [
  body('paymentMethod').optional().isIn(['credit_card', 'debit_card', 'bank_transfer', 'cash']).withMessage('Invalid payment method')
];

// Routes
router.get('/my', authenticateToken, getMyTransactions);
router.get('/:id', authenticateToken, getTransaction);
router.get('/property/:propertyId', authenticateToken, authorize('owner','admin'), getTransactionsByProperty);

router.put('/:id/pay', 
  authenticateToken, 
  authorize('tenant'), 
  paymentValidation, 
  processPayment
);

router.post('/monthly-pay', 
  authenticateToken, 
  authorize('tenant','admin'), 
  createMonthlyPayment
);

router.delete('/:id', 
  authenticateToken, 
  deleteTransaction
);

export default router;