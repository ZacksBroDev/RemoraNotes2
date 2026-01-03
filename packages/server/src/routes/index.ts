import { Router } from 'express';
import authRoutes from './auth.js';
import usersRoutes from './users.js';
import contactsRoutes from './contacts.js';
import interactionsRoutes from './interactions.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/contacts', contactsRoutes);
router.use('/interactions', interactionsRoutes);

export default router;
