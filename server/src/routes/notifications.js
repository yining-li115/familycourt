const express = require('express');
const db = require('../utils/db');
const { requireAuth } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');

const router = express.Router();

// ─── GET /notifications ────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unread_only } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db('notifications')
      .where({ user_id: req.user.sub })
      .orderBy('created_at', 'desc')
      .limit(Number(limit))
      .offset(offset);

    if (unread_only === 'true') {
      query = query.where({ read: false });
    }

    const notifications = await query;
    const { count } = await db('notifications')
      .where({ user_id: req.user.sub })
      .where(unread_only === 'true' ? { read: false } : {})
      .count('id as count')
      .first();

    res.json({ data: notifications, total: Number(count), page: Number(page) });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /notifications/:id/read ────────────────────────────────────────

router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const n = await db('notifications')
      .where({ id: req.params.id, user_id: req.user.sub })
      .first();
    if (!n) throw httpError(404, '通知不存在');

    await db('notifications').where({ id: n.id }).update({ read: true });
    res.json({ message: '已标记为已读' });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /notifications/read-all ────────────────────────────────────────

router.patch('/read-all', requireAuth, async (req, res, next) => {
  try {
    await db('notifications').where({ user_id: req.user.sub, read: false }).update({ read: true });
    res.json({ message: '全部已读' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
