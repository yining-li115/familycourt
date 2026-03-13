const express = require('express');
const { body, validationResult } = require('express-validator');
const redis = require('../utils/redis');
const db = require('../utils/db');
const { signAccess, signRefresh, verify } = require('../utils/jwt');
const { sendVerificationCode } = require('../utils/sms');
const { requireAuth } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');

const router = express.Router();

// ─── POST /auth/send-code ──────────────────────────────────────────────────

router.post(
  '/send-code',
  [body('phone').isMobilePhone().withMessage('Invalid phone number')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { phone } = req.body;

      // Rate limit: max 5 sends per phone per 10 minutes
      const rateLimitKey = `ratelimit:sms:${phone}`;
      const sends = await redis.incr(rateLimitKey);
      if (sends === 1) await redis.expire(rateLimitKey, 600);
      if (sends > 5) throw httpError(429, '发送太频繁，请稍后再试');

      // Check if there's already a recent code (within 60s) — prevent spam
      const existing = await redis.get(`verify:${phone}`);
      if (existing) {
        const { sentAt } = JSON.parse(existing);
        if (Date.now() - sentAt < 60 * 1000) {
          throw httpError(429, '验证码已发送，请等待 60 秒后重试');
        }
      }

      const code = (process.env.SMS_PROVIDER === 'mock')
        ? '123456'
        : String(Math.floor(100000 + Math.random() * 900000));
      await redis.set(
        `verify:${phone}`,
        JSON.stringify({ code, attempts: 0, sentAt: Date.now() }),
        'EX',
        300 // 5 minutes TTL
      );

      await sendVerificationCode(phone, code);

      res.json({ message: '验证码已发送' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /auth/verify ─────────────────────────────────────────────────────

router.post(
  '/verify',
  [
    body('phone').isMobilePhone(),
    body('code').isLength({ min: 6, max: 6 }).isNumeric(),
    body('nickname').optional().isLength({ min: 1, max: 30 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { phone, code, nickname, fcm_token } = req.body;

      const raw = await redis.get(`verify:${phone}`);
      if (!raw) throw httpError(400, '验证码不存在或已过期');

      const verifyData = JSON.parse(raw);

      if (verifyData.attempts >= 5) {
        await redis.del(`verify:${phone}`);
        throw httpError(400, '验证码错误次数过多，请重新获取');
      }

      if (verifyData.code !== code) {
        verifyData.attempts += 1;
        await redis.set(`verify:${phone}`, JSON.stringify(verifyData), 'KEEPTTL');
        throw httpError(400, '验证码错误');
      }

      await redis.del(`verify:${phone}`);

      // Upsert user
      let user = await db('users').where({ phone }).first();
      if (!user) {
        const [newUser] = await db('users')
          .insert({
            phone,
            nickname: nickname || `用户${phone.slice(-4)}`,
            fcm_token: fcm_token || null,
          })
          .returning('*');
        user = newUser;
      } else if (fcm_token) {
        await db('users').where({ id: user.id }).update({ fcm_token, updated_at: db.fn.now() });
        user.fcm_token = fcm_token;
      }

      const payload = { sub: user.id, phone: user.phone };
      const accessToken = signAccess(payload);
      const refreshToken = signRefresh(payload);

      // Store refresh token
      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30);
      await db('refresh_tokens').insert({
        user_id: user.id,
        token: refreshToken,
        expires_at: refreshExpiresAt.toISOString(),
      });

      res.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        user: sanitizeUser(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /auth/refresh ────────────────────────────────────────────────────

router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) throw httpError(400, 'refresh_token is required');

    const stored = await db('refresh_tokens')
      .where({ token: refresh_token, revoked: false })
      .where('expires_at', '>', new Date().toISOString())
      .first();

    if (!stored) throw httpError(401, 'Invalid or expired refresh token');

    const decoded = verify(refresh_token);
    const user = await db('users').where({ id: decoded.sub }).first();
    if (!user) throw httpError(401, 'User not found');

    const payload = { sub: user.id, phone: user.phone };
    const newAccessToken = signAccess(payload);

    res.json({ access_token: newAccessToken });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /auth/logout ───────────────────────────────────────────────────

router.delete('/logout', requireAuth, async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await db('refresh_tokens')
        .where({ user_id: req.user.sub, token: refresh_token })
        .update({ revoked: true });
    }
    res.json({ message: '已登出' });
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function sanitizeUser(user) {
  const { fcm_token, ...safe } = user;
  return safe;
}

module.exports = router;
