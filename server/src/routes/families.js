const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../utils/db');
const { requireAuth } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');
const { generateInviteCode } = require('../utils/inviteCode');

const router = express.Router();

// ─── Helper: check membership ─────────────────────────────────────────────

async function requireMembership(userId, familyId) {
  const row = await db('family_members').where({ user_id: userId, family_id: familyId }).first();
  if (!row) throw httpError(403, '您不属于该家庭');
  return row;
}

// ─── POST /families — 创建家庭 ──────────────────────────────────────────────

router.post(
  '/',
  requireAuth,
  [
    body('name').isLength({ min: 1, max: 50 }),
    body('alias').optional().isLength({ min: 1, max: 20 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = await db('users').where({ id: req.user.sub }).first();
      const invite_code = await generateInviteCode();

      const [family] = await db('families')
        .insert({ name: req.body.name, invite_code, admin_id: user.id })
        .returning('*');

      // Add creator to family_members
      await db('family_members').insert({
        user_id: user.id,
        family_id: family.id,
        alias: req.body.alias || null,
      });

      // Keep users.family_id updated for backward compat (navigation guard)
      if (!user.family_id) {
        await db('users')
          .where({ id: user.id })
          .update({ family_id: family.id, family_alias: req.body.alias || null, updated_at: db.fn.now() });
      }

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

      const family = await db('families')
        .where({ invite_code: req.body.invite_code.toUpperCase() })
        .first();
      if (!family) throw httpError(404, '邀请码无效');

      // Check if already a member
      const existing = await db('family_members')
        .where({ user_id: user.id, family_id: family.id })
        .first();
      if (existing) throw httpError(400, '您已在该家庭中');

      // Check family member limit (8 people max)
      const memberCount = await db('family_members')
        .where({ family_id: family.id })
        .count('id as count')
        .first();
      if (Number(memberCount.count) >= 8) throw httpError(400, '家庭成员已达上限（8人）');

      await db('family_members').insert({
        user_id: user.id,
        family_id: family.id,
        alias: req.body.alias,
      });

      // Keep users.family_id updated for backward compat
      if (!user.family_id) {
        await db('users').where({ id: user.id }).update({
          family_id: family.id,
          family_alias: req.body.alias,
          updated_at: db.fn.now(),
        });
      }

      res.json({ message: '加入成功', family });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /families — 获取用户所有家庭 ──────────────────────────────────────

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const memberships = await db('family_members')
      .where({ user_id: req.user.sub })
      .join('families', 'families.id', 'family_members.family_id')
      .select(
        'families.*',
        'family_members.alias as my_alias',
        'family_members.joined_at as my_joined_at'
      );

    res.json(memberships);
  } catch (err) {
    next(err);
  }
});

// ─── GET /families/me — 兼容旧接口，返回第一个家庭 ─────────────────────────

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

// ─── GET /families/me/members — 兼容旧接口 ───────────────────────────────
// IMPORTANT: must be before /:familyId/members to avoid "me" matching as familyId

router.get('/me/members', requireAuth, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.sub }).first();
    if (!user.family_id) throw httpError(404, '您还未加入任何家庭');

    const members = await db('family_members')
      .where('family_members.family_id', user.family_id)
      .join('users', 'users.id', 'family_members.user_id')
      .select(
        'users.id',
        'users.nickname',
        'users.avatar_url',
        'users.status',
        'family_members.alias as family_alias'
      );

    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ─── GET /families/:familyId/members ──────────────────────────────────────

router.get('/:familyId/members', requireAuth, async (req, res, next) => {
  try {
    await requireMembership(req.user.sub, req.params.familyId);

    const members = await db('family_members')
      .where('family_members.family_id', req.params.familyId)
      .join('users', 'users.id', 'family_members.user_id')
      .select(
        'users.id',
        'users.nickname',
        'users.avatar_url',
        'users.status',
        'family_members.alias as family_alias'
      );

    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /families/:familyId — 修改家庭信息（管理员）──────────────────────

router.patch(
  '/:familyId',
  requireAuth,
  [
    body('name').optional().isLength({ min: 1, max: 50 }),
    body('timeout_mins').optional().isInt({ min: 30, max: 480 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      await requireMembership(req.user.sub, req.params.familyId);

      const family = await db('families').where({ id: req.params.familyId }).first();
      if (!family) throw httpError(404, '家庭不存在');
      if (family.admin_id !== req.user.sub) throw httpError(403, '只有管理员可以修改家庭信息');

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

// ─── PATCH /families/:familyId/alias — 更新当前用户在家庭内的称呼 ─────────

router.patch(
  '/:familyId/alias',
  requireAuth,
  [body('alias').isLength({ min: 1, max: 20 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const [updated] = await db('family_members')
        .where({ user_id: req.user.sub, family_id: req.params.familyId })
        .update({ alias: req.body.alias })
        .returning('*');

      if (!updated) throw httpError(404, '您不属于该家庭');

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /families/:familyId/refresh-code — 刷新邀请码（管理员）──────────

router.post('/:familyId/refresh-code', requireAuth, async (req, res, next) => {
  try {
    await requireMembership(req.user.sub, req.params.familyId);

    const family = await db('families').where({ id: req.params.familyId }).first();
    if (!family) throw httpError(404, '家庭不存在');
    if (family.admin_id !== req.user.sub) throw httpError(403, '只有管理员可以刷新邀请码');

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

// ─── DELETE /families/:familyId/members/:userId — 移除成员（管理员）────────

router.delete('/:familyId/members/:userId', requireAuth, async (req, res, next) => {
  try {
    await requireMembership(req.user.sub, req.params.familyId);

    const family = await db('families').where({ id: req.params.familyId }).first();
    if (!family) throw httpError(404, '家庭不存在');
    if (family.admin_id !== req.user.sub) throw httpError(403, '只有管理员可以移除成员');

    const { userId } = req.params;
    if (userId === req.user.sub) throw httpError(400, '不能移除自己');

    const target = await db('family_members')
      .where({ user_id: userId, family_id: req.params.familyId })
      .first();
    if (!target) throw httpError(404, '成员不存在');

    await db('family_members')
      .where({ user_id: userId, family_id: req.params.familyId })
      .del();

    // If this was the user's primary family, clear it
    const user = await db('users').where({ id: userId }).first();
    if (user.family_id === req.params.familyId) {
      // Set to another family if exists, or null
      const otherMembership = await db('family_members')
        .where({ user_id: userId })
        .first();
      await db('users')
        .where({ id: userId })
        .update({
          family_id: otherMembership ? otherMembership.family_id : null,
          family_alias: null,
          updated_at: db.fn.now(),
        });
    }

    res.json({ message: '成员已移除' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
