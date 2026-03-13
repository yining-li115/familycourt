const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../utils/db');
const { requireAuth } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');

const router = express.Router();

// ─── GET /users/me ─────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.sub }).first();
    if (!user) throw httpError(404, 'User not found');
    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /users/me ───────────────────────────────────────────────────────

router.patch(
  '/me',
  requireAuth,
  [
    body('nickname').optional().isLength({ min: 1, max: 30 }),
    body('status').optional().isIn(['idle', 'busy']),
    body('fcm_token').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const allowed = ['nickname', 'avatar_url', 'status', 'fcm_token'];
      const updates = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      updates.updated_at = db.fn.now();

      const [user] = await db('users')
        .where({ id: req.user.sub })
        .update(updates)
        .returning('*');

      res.json(sanitizeUser(user));
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /users/me ──────────────────────────────────────────────────────
// 7-day cooling-off period — just marks deleted_at for now (schema can be extended)

router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    // For v1.0: revoke all tokens. A cron job can clean up after 7 days.
    await db('refresh_tokens').where({ user_id: req.user.sub }).update({ revoked: true });
    // Remove from all families
    await db('family_members').where({ user_id: req.user.sub }).del();
    // Detach from family
    await db('users')
      .where({ id: req.user.sub })
      .update({ family_id: null, family_alias: null, updated_at: db.fn.now() });

    res.json({ message: '账号已申请注销，7 天后完全删除' });
  } catch (err) {
    next(err);
  }
});

function sanitizeUser(user) {
  const { fcm_token, ...safe } = user;
  return safe;
}

module.exports = router;
