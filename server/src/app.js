require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const familyRoutes = require('./routes/families');
const caseRoutes = require('./routes/cases');
const notificationRoutes = require('./routes/notifications');
const { errorHandler } = require('./middleware/errorHandler');

// Initialize BullMQ worker (side effect — starts listening)
require('./queues/caseQueue');

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Routes ────────────────────────────────────────────────────────────────

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/families', familyRoutes);
app.use('/cases', caseRoutes);
app.use('/notifications', notificationRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error handler (must be last) ─────────────────────────────────────────

app.use(errorHandler);

// ─── Start server ──────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Family Court API running on port ${PORT}`);
  console.log(`[Server] ENV: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
