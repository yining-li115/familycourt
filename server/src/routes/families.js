const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../utils/db');
const { requireAuth } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');
const { generateInviteCode } = require('../utils/inviteCode');

const router = express.Router();

// ─── POST /families — 创建家庭 ──────────────────────────────────────────────

router.post(
  '/',
  requireAuth,
  [body('name').isLength({ min: 1, max: 50 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = await db('users').where({ id: req.user.sub }).first();
      if (user.family_id) throw httpError(400, '您已在一个家庭中，v1.0 不支持多家庭');

      const invite_code = await generateInviteCode();

      const [family] = await db('families')
        .insert({ name: req.body.name, invite_code, admin_id: user.id })
        .returning('*');

      // Update user's family
      await db('users')
        .where({ id: user.id })
        .update({ family_id: family.id, updated_at: db.fn.now() });

      res.status(201).json(family);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /families/join — 加入家庭 ────────────────────────────────────────

router.post(
  '/join',
  requireAuth,
  [
    body('invite_code').isLength({ min: 6, max: 6 }),
    body('alias').isLength({ min: 1, max: 20 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = await db('users').where({ id: req.user.sub }).first();
      if (user.family_id) throw httpError(400, '您已在一个家庭中');

      const family = await db('families')
        .where({ invite_code: req.body.invite_code.toUpperCase() })
        .first();
      if (!family) throw httpError(404, '邀请码无效');

      // Check family member limit (8 people max)
      const memberCount = await db('users')
        .where({ family_id: family.id })
        .count('id as count')
        .first();
      if (Number(memberCount.count) >= 8) throw httpError(400, '家庭成员已达上限（8人）');

      await db('users').where({ id: user.id }).update({
        family_id: family.id,
        family_alias: req.body.alias,
        updated_at: db.fn.now(),
      });

      res.json({ message: '加入成功', family });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /families/me ──────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.sub }).first();
    if (!user.family_id) throw httpError(404, '您还未加入任何家庭');

    const family = await db('families').where({ id: user.family_id }).first();
    res.json(family);
  } catch (err) {
    next(err);
  }
});

// ─── GET /families/me/members ──────────────────────────────────────────────

router.get('/me/members', requireAuth, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.sub }).first();
    if (!user.family_id) throw httpError(404, '您还未加入任何家庭');

    const members = await db('users')
      .where({ family_id: user.family_id })
      .select('id', 'nickname', 'family_alias', 'avatar_url', 'status');

    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /families/me — 修改家庭信息（管理员）──────────────────────────────

router.patch(
  '/me',
  requireAuth,
  [
    body('name').optional().isLength({ min: 1, max: 50 }),
    body('timeout_mins').optional().isInt({ min: 30, max: 480 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = await db('users').where({ id: req.user.sub }).first();
      if (!user.family_id) throw httpError(404, '您还未加入任何家庭');

      const family = await db('families').where({ id: user.family_id }).first();
      if (family.admin_id !== user.id) throw httpError(403, '只有管理员可以修改家庭信息');

      const updates = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.timeout_mins) updates.timeout_mins = req.body.timeout_mins;

      const [updated] = await db('families')
        .where({ id: family.id })
        .update(updates)
        .returning('*');

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /families/me/refresh-code — 刷新邀请码（管理员）────────────────────

router.post('/me/refresh-code', requireAuth, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.sub }).first();
    if (!user.family_id) throw httpError(404, '您还未加入任何家庭');

    const family = await db('families').where({ id: user.family_id }).first();
    if (family.admin_id !== user.id) throw httpError(403, '只有管理员可以刷新邀请码');

    const newCode = await generateInviteCode();
    const [updated] = await db('families')
      .where({ id: family.id })
      .update({ invite_code: newCode })
      .returning('*');

    res.json({ invite_code: updated.invite_code });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /families/me/members/:userId — 移除成员（管理员）─────────────────

router.delete('/me/members/:userId', requireAuth, async (req, res, next) => {
  try {
    const admin = await db('users').where({ id: req.user.sub }).first();
    if (!admin.family_id) throw httpError(404, '您还未加入任何家庭');

    const family = await db('families').where({ id: admin.family_id }).first();
    if (family.admin_id !== admin.id) throw httpError(403, '只有管理员可以移除成员');

    const { userId } = req.params;
    if (userId === admin.id) throw httpError(400, '不能移除自己');

    const target = await db('users')
      .where({ id: userId, family_id: admin.family_id })
      .first();
    if (!target) throw httpError(404, '成员不存在');

    await db('users')
      .where({ id: userId })
      .update({ family_id: null, family_alias: null, updated_at: db.fn.now() });

    res.json({ message: '成员已移除' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
