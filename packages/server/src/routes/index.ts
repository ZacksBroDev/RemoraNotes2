import { Router } from 'express';
import authRoutes from './auth.js';
import usersRoutes from './users.js';
import contactsRoutes from './contacts.js';
import interactionsRoutes from './interactions.js';
import remindersRoutes from './reminders.js';
import calendarRoutes from './calendar.js';

const router = Router();

// Root endpoint - API info
router.get('/', (_req, res) => {
  res.json({
    name: 'RemoraNotes API',
    version: '0.1.0',
    status: 'running',
    endpoints: {
      health: '/api/v1/health',
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      contacts: '/api/v1/contacts',
      interactions: '/api/v1/interactions',
      reminders: '/api/v1/reminders',
      calendar: '/api/v1/calendar',
    },
  });
});

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/contacts', contactsRoutes);
router.use('/interactions', interactionsRoutes);
router.use('/reminders', remindersRoutes);
router.use('/calendar', calendarRoutes);

export default router;
