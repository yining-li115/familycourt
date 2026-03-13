const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../utils/db');
const { requireAuth } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');
const { generateCaseNumber } = require('../utils/caseNumber');
const { createNotification, createNotificationsForUsers } = require('../services/notification');
const { scheduleAiJobs, cancelAiJobs } = require('../queues/caseQueue');

const router = express.Router();

// ─── Permission helper ─────────────────────────────────────────────────────

function getCaseRole(case_, userId) {
  if (case_.plaintiff_id === userId) return 'plaintiff';
  if (case_.defendant_id === userId) return 'defendant';
  // Multi-party support
  if (case_._plaintiffIds && case_._plaintiffIds.includes(userId)) return 'plaintiff';
  if (case_._defendantIds && case_._defendantIds.includes(userId)) return 'defendant';
  if (case_.judge_id === userId) return 'judge';
  return 'bystander';
}

/** Load case with party arrays attached */
async function loadCaseWithParties(caseId) {
  const case_ = await db('cases').where({ id: caseId }).first();
  if (!case_) return null;
  const parties = await db('case_parties').where({ case_id: caseId });
  case_._plaintiffIds = parties.filter(p => p.role === 'plaintiff').map(p => p.user_id);
  case_._defendantIds = parties.filter(p => p.role === 'defendant').map(p => p.user_id);
  case_._parties = parties;
  return case_;
}

/**
 * Filter case fields based on viewer's role.
 * Implements the permission matrix from CLAUDE.md.
 */
function filterCaseForRole(case_, role, inquiries = []) {
  const base = {
    id: case_.id,
    case_number: case_.case_number,
    status: case_.status,
    category: case_.category,
    family_id: case_.family_id,
    is_ai_judge: case_.is_ai_judge,
    is_public: case_.is_public,
    created_at: case_.created_at,
    updated_at: case_.updated_at,
  };

  if (role === 'bystander' && !case_.is_public) {
    return base; // only number + status
  }

  // Plaintiff, defendant, judge (or public)
  const full = {
    ...base,
    plaintiff_id: case_.plaintiff_id,
    defendant_id: case_.defendant_id,
    judge_id: case_.judge_id,
    plaintiff_emotion: case_.plaintiff_emotion,
    defendant_emotion: case_.defendant_emotion,
    deadline_answer: case_.deadline_answer,
    ai_takeover_at: case_.ai_takeover_at,
    withdrawn: case_.withdrawn,
    withdraw_reason: case_.withdrawn ? case_.withdraw_reason : undefined,
  };

  // plaintiff_statement: defendant sees it always; plaintiff after defendant submits
  if (role === 'judge' || role === 'defendant' || case_.is_public) {
    full.plaintiff_statement = case_.plaintiff_statement;
  } else if (role === 'plaintiff' && case_.defendant_statement) {
    // Plaintiff can see their own statement; once defendant answers, they can see both
    full.plaintiff_statement = case_.plaintiff_statement;
  } else if (role === 'plaintiff') {
    full.plaintiff_statement = case_.plaintiff_statement;
  }

  // defendant_statement: visible after it's submitted (to judge and plaintiff)
  if (role === 'judge' || case_.is_public) {
    full.defendant_statement = case_.defendant_statement;
  } else if (role === 'plaintiff' && case_.defendant_statement) {
    full.defendant_statement = case_.defendant_statement;
  } else if (role === 'defendant') {
    full.defendant_statement = case_.defendant_statement;
  }

  // fact_finding
  if (role !== 'bystander') {
    full.fact_finding = case_.fact_finding;
    full.fact_finding_is_ai = case_.fact_finding_is_ai;
  }

  // claim and response
  if (role !== 'bystander') {
    full.plaintiff_claim = case_.plaintiff_claim;
    full.claim_category = case_.claim_category;
    full.defendant_response = case_.defendant_response;
    full.defendant_response_reason = case_.defendant_response_reason;
  }

  // mediation
  if (role !== 'bystander') {
    full.mediation_plan = case_.mediation_plan;
    full.mediation_plan_is_ai = case_.mediation_plan_is_ai;
    full.plaintiff_mediation_response = case_.plaintiff_mediation_response;
    full.defendant_mediation_response = case_.defendant_mediation_response;
  }

  // verdict
  full.verdict = case_.verdict;

  // Filter inquiries by role
  if (inquiries.length > 0) {
    if (role === 'judge') {
      full.inquiries = inquiries;
    } else if (role === 'plaintiff') {
      full.inquiries = inquiries.filter(
        (i) => i.target === 'plaintiff' || i.is_visible_to_both
      );
    } else if (role === 'defendant') {
      full.inquiries = inquiries.filter(
        (i) => i.target === 'defendant' || i.is_visible_to_both
      );
    }
  }

  return full;
}

// ─── GET alias helper ──────────────────────────────────────────────────────

async function getMemberAlias(userId) {
  if (!userId) return '未知';
  const u = await db('users').where({ id: userId }).select('nickname', 'family_alias').first();
  return u?.family_alias || u?.nickname || '未知';
}

// ─── POST /cases — 立案 ────────────────────────────────────────────────────

router.post(
  '/',
  requireAuth,
  [
    // Support both single defendant_id and array defendant_ids
    body('defendant_id').optional().isUUID(),
    body('defendant_ids').optional().isArray({ min: 1 }),
    body('defendant_ids.*').optional().isUUID(),
    body('plaintiff_ids').optional().isArray(),
    body('plaintiff_ids.*').optional().isUUID(),
    body('judge_id').optional({ nullable: true }).isUUID(),
    body('category').isIn(['chores', 'spending', 'education', 'verbal', 'other']),
    body('plaintiff_statement').isLength({ min: 1, max: 2000 }),
    body('plaintiff_emotion').optional().isInt({ min: 1, max: 10 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = await db('users').where({ id: req.user.sub }).first();
      if (!user.family_id) throw httpError(400, '请先加入家庭');

      const { judge_id, category, plaintiff_statement, plaintiff_emotion } = req.body;

      // Resolve defendant list (support both old single and new array format)
      const defendantIds = req.body.defendant_ids || (req.body.defendant_id ? [req.body.defendant_id] : []);
      if (defendantIds.length === 0) throw httpError(400, '请选择至少一名被告');

      // Resolve plaintiff list (default: just the filer)
      const plaintiffIds = req.body.plaintiff_ids || [];
      const allPlaintiffIds = [user.id, ...plaintiffIds.filter(id => id !== user.id)];

      // Validate no one is both plaintiff and defendant
      const overlap = allPlaintiffIds.filter(id => defendantIds.includes(id));
      if (overlap.length > 0) throw httpError(400, '同一人不能同时是原告和被告');

      if (defendantIds.includes(user.id)) throw httpError(400, '不能起诉自己');

      // Validate all defendants are in same family
      const defendants = await db('users')
        .whereIn('id', defendantIds)
        .where({ family_id: user.family_id });
      if (defendants.length !== defendantIds.length) throw httpError(400, '部分被告不在您的家庭中');

      // Primary defendant (first in list) for backward compatibility
      const primaryDefendantId = defendantIds[0];

      // Determine judge
      let resolvedJudgeId = judge_id || null;
      let isAiJudge = false;

      const members = await db('users').where({ family_id: user.family_id });
      const partyIds = [...allPlaintiffIds, ...defendantIds];
      const availableJudges = members.filter((m) => !partyIds.includes(m.id));

      if (availableJudges.length === 0) {
        isAiJudge = true;
        resolvedJudgeId = null;
      } else if (resolvedJudgeId) {
        const judgeInFamily = availableJudges.find((m) => m.id === resolvedJudgeId);
        if (!judgeInFamily) throw httpError(400, '指定的法官不在家庭中或为当事人');
      }

      const case_number = await generateCaseNumber();
      const family = await db('families').where({ id: user.family_id }).first();

      const newCase = await db.transaction(async (trx) => {
        const [c] = await trx('cases')
          .insert({
            family_id: user.family_id,
            case_number,
            status: isAiJudge ? 'pending_defendant' : 'pending_judge_accept',
            category,
            plaintiff_id: user.id,
            defendant_id: primaryDefendantId,
            judge_id: resolvedJudgeId,
            is_ai_judge: isAiJudge,
            plaintiff_statement,
            plaintiff_emotion: plaintiff_emotion || null,
          })
          .returning('*');

        // Insert all parties into case_parties
        const partyRows = [
          ...allPlaintiffIds.map(uid => ({
            case_id: c.id,
            user_id: uid,
            role: 'plaintiff',
            statement: uid === user.id ? plaintiff_statement : null,
            emotion: uid === user.id ? (plaintiff_emotion || null) : null,
            statement_at: uid === user.id ? new Date() : null,
          })),
          ...defendantIds.map(uid => ({
            case_id: c.id,
            user_id: uid,
            role: 'defendant',
          })),
        ];
        await trx('case_parties').insert(partyRows);

        return c;
      });

      // Notifications
      const plaintiffAlias = await getMemberAlias(user.id);
      if (isAiJudge) {
        await createNotificationsForUsers(defendantIds, {
          caseId: newCase.id,
          type: 'case_accepted',
          title: `你被 ${plaintiffAlias} 起诉了`,
          body: '请查看原告陈述并提交你的答辩。',
        });
      } else if (resolvedJudgeId) {
        await createNotification({
          userId: resolvedJudgeId,
          caseId: newCase.id,
          type: 'case_filed',
          title: `${plaintiffAlias} 发起了一起诉讼`,
          body: '请前往受理案件。',
        });
        await scheduleAiJobs(newCase.id, family.timeout_mins || 120);
      }

      // Return case with party info
      newCase._plaintiffIds = allPlaintiffIds;
      newCase._defendantIds = defendantIds;
      res.status(201).json(newCase);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /cases — 获取家庭案件列表 ────────────────────────────────────────

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.sub }).first();
    if (!user.family_id) throw httpError(400, '请先加入家庭');

    const cases = await db('cases')
      .where({ family_id: user.family_id })
      .orderBy('created_at', 'desc');

    // Load parties for all cases
    const caseIds = cases.map(c => c.id);
    const allParties = caseIds.length > 0
      ? await db('case_parties').whereIn('case_id', caseIds)
      : [];

    const filtered = cases.map((c) => {
      const parties = allParties.filter(p => p.case_id === c.id);
      c._plaintiffIds = parties.filter(p => p.role === 'plaintiff').map(p => p.user_id);
      c._defendantIds = parties.filter(p => p.role === 'defendant').map(p => p.user_id);
      c._parties = parties;
      const result = filterCaseForRole(c, getCaseRole(c, user.id));
      result.plaintiff_ids = c._plaintiffIds;
      result.defendant_ids = c._defendantIds;
      return result;
    });
    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

// ─── GET /cases/:id — 获取案件详情 ────────────────────────────────────────

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.sub }).first();
    const case_ = await loadCaseWithParties(req.params.id);
    if (!case_) throw httpError(404, '案件不存在');
    if (case_.family_id !== user.family_id) throw httpError(403, '无权访问');

    const inquiries = await db('inquiries').where({ case_id: case_.id }).orderBy('created_at');
    const role = getCaseRole(case_, user.id);
    const result = filterCaseForRole(case_, role, inquiries);
    result.plaintiff_ids = case_._plaintiffIds;
    result.defendant_ids = case_._defendantIds;
    result.parties = case_._parties;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /cases/:id/accept — 法官受理 ───────────────────────────────────

router.patch(
  '/:id/accept',
  requireAuth,
  [body('deadline_hours').isInt({ min: 24, max: 72 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const case_ = await db('cases').where({ id: req.params.id }).first();
      if (!case_) throw httpError(404, '案件不存在');
      if (case_.judge_id !== req.user.sub) throw httpError(403, '您不是本案法官');
      if (case_.status !== 'pending_judge_accept') throw httpError(400, '案件状态不允许此操作');

      const deadlineAnswer = new Date();
      deadlineAnswer.setHours(deadlineAnswer.getHours() + req.body.deadline_hours);

      const [updated] = await db('cases')
        .where({ id: case_.id })
        .update({
          status: 'pending_defendant',
          deadline_answer: deadlineAnswer.toISOString(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      // Cancel AI takeover since judge accepted
      await cancelAiJobs(case_.id);

      // Notify all defendants
      const parties = await db('case_parties').where({ case_id: case_.id, role: 'defendant' });
      const defendantUserIds = parties.length > 0
        ? parties.map(p => p.user_id)
        : [case_.defendant_id];
      const plaintiffAlias = await getMemberAlias(case_.plaintiff_id);
      await createNotificationsForUsers(defendantUserIds, {
        caseId: case_.id,
        type: 'case_accepted',
        title: `你被 ${plaintiffAlias} 起诉了`,
        body: `请在 ${req.body.deadline_hours} 小时内查看原告陈述并提交答辩。`,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /cases/:id/recuse — 法官回避 ───────────────────────────────────

router.patch('/:id/recuse', requireAuth, async (req, res, next) => {
  try {
    const case_ = await db('cases').where({ id: req.params.id }).first();
    if (!case_) throw httpError(404, '案件不存在');
    if (case_.judge_id !== req.user.sub) throw httpError(403, '您不是本案法官');
    if (case_.status !== 'pending_judge_accept') throw httpError(400, '案件状态不允许此操作');

    await cancelAiJobs(case_.id);

    const [updated] = await db('cases')
      .where({ id: case_.id })
      .update({ judge_id: null, status: 'pending_judge_accept', updated_at: db.fn.now() })
      .returning('*');

    // Notify plaintiff to reassign judge
    await createNotification({
      userId: case_.plaintiff_id,
      caseId: case_.id,
      type: 'judge_recused',
      title: '法官申请回避',
      body: '原指定法官已申请回避，请重新指定法官或等待 AI 接管。',
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /cases/:id/defend — 被告答辩 ───────────────────────────────────

router.patch(
  '/:id/defend',
  requireAuth,
  [
    body('defendant_statement').isLength({ min: 1, max: 2000 }),
    body('defendant_emotion').optional().isInt({ min: 1, max: 10 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const case_ = await loadCaseWithParties(req.params.id);
      if (!case_) throw httpError(404, '案件不存在');
      const isDefendant = case_.defendant_id === req.user.sub ||
        (case_._defendantIds && case_._defendantIds.includes(req.user.sub));
      if (!isDefendant) throw httpError(403, '您不是本案被告');
      if (case_.status !== 'pending_defendant') throw httpError(400, '案件状态不允许此操作');

      // Save this defendant's statement to case_parties
      await db('case_parties')
        .where({ case_id: case_.id, user_id: req.user.sub })
        .update({
          statement: req.body.defendant_statement,
          emotion: req.body.defendant_emotion || null,
          statement_at: db.fn.now(),
        });

      // Check if all defendants have submitted
      const defendantParties = await db('case_parties')
        .where({ case_id: case_.id, role: 'defendant' });
      const allDefended = defendantParties.every(p => p.statement_at != null);

      // Update main case: use primary defendant's statement for backward compat
      const updateData = { updated_at: db.fn.now() };
      if (case_.defendant_id === req.user.sub) {
        updateData.defendant_statement = req.body.defendant_statement;
        updateData.defendant_emotion = req.body.defendant_emotion || null;
      }
      if (allDefended) {
        updateData.status = 'pending_inquiry';
        // If primary defendant hasn't set statement yet, use first available
        if (!updateData.defendant_statement) {
          const first = defendantParties.find(p => p.statement);
          if (first) updateData.defendant_statement = first.statement;
        }
      }

      const [updated] = await db('cases')
        .where({ id: case_.id })
        .update(updateData)
        .returning('*');

      // Notify judge (or trigger AI inquiry)
      const judgeId = case_.judge_id;
      if (judgeId) {
        await createNotification({
          userId: judgeId,
          caseId: case_.id,
          type: 'defendant_responded',
          title: '双方陈述已就绪',
          body: `案件 ${case_.case_number} 被告已提交答辩，请开始问询。`,
        });
      }

      // 如果是 AI 法官，自动触发问询生成
      if (updated.is_ai_judge) {
        const { scheduleAiAutoInquiry } = require('../queues/caseQueue');
        await scheduleAiAutoInquiry(updated.id);
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /cases/:id/inquiries — 法官发出问询 ─────────────────────────────

router.post(
  '/:id/inquiries',
  requireAuth,
  [
    body('type').isIn(['private_plaintiff', 'private_defendant', 'confrontation']),
    body('question').isLength({ min: 1, max: 1000 }),
    body('target').optional().isIn(['plaintiff', 'defendant']),
    body('quoted_text').optional().isLength({ max: 500 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const case_ = await loadCaseWithParties(req.params.id);
      if (!case_) throw httpError(404, '案件不存在');
      if (case_.judge_id !== req.user.sub && !case_.is_ai_judge)
        throw httpError(403, '只有法官可以发出问询');
      if (case_.status !== 'pending_inquiry') throw httpError(400, '案件状态不允许此操作');

      const { type, question, target, quoted_text } = req.body;

      // Resolve party user IDs from case_parties
      const plaintiffIds = case_._plaintiffIds.length > 0 ? case_._plaintiffIds : [case_.plaintiff_id].filter(Boolean);
      const defendantIds = case_._defendantIds.length > 0 ? case_._defendantIds : [case_.defendant_id].filter(Boolean);

      // Check round limits
      const existingCount = await db('inquiries')
        .where({ case_id: case_.id })
        .count('id as count')
        .first();
      const round = Math.floor(Number(existingCount.count) / 2) + 1;

      // Max 2 confrontations
      const confrontationCount = await db('inquiries')
        .where({ case_id: case_.id, type: 'confrontation' })
        .count('id as count')
        .first();
      const totalParties = plaintiffIds.length + defendantIds.length;
      if (type === 'confrontation' && Number(confrontationCount.count) / totalParties >= 2) {
        throw httpError(400, '对质最多触发 2 次');
      }

      if (type === 'confrontation') {
        // Create one inquiry record per party member (all plaintiffs + all defendants)
        const insertRows = [
          ...plaintiffIds.map(uid => ({
            case_id: case_.id, round, type, question, target: 'plaintiff',
            target_user_id: uid, quoted_text: quoted_text || null, is_visible_to_both: true,
          })),
          ...defendantIds.map(uid => ({
            case_id: case_.id, round, type, question, target: 'defendant',
            target_user_id: uid, quoted_text: quoted_text || null, is_visible_to_both: true,
          })),
        ];
        const rows = await db('inquiries').insert(insertRows).returning('*');

        await createNotificationsForUsers(
          [...plaintiffIds, ...defendantIds],
          {
            caseId: case_.id, type: 'inquiry_received',
            title: '法官发起对质', body: '法官有问题需要双方分别回答，请进入案件查看。',
          }
        );
        res.status(201).json(rows);
      } else {
        // Private inquiry — one record per target-side party member
        const targetIds = target === 'plaintiff' ? plaintiffIds : defendantIds;
        const insertRows = targetIds.map(uid => ({
          case_id: case_.id, round, type, question, target,
          target_user_id: uid, quoted_text: quoted_text || null, is_visible_to_both: false,
        }));
        const rows = await db('inquiries').insert(insertRows).returning('*');

        await createNotificationsForUsers(targetIds, {
          caseId: case_.id, type: 'inquiry_received',
          title: '法官有问题需要你回答', body: '请进入案件查看问题并回答。',
        });
        res.status(201).json(rows.length === 1 ? rows[0] : rows);
      }
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /cases/:id/inquiries/:inquiryId — 回答问询 ────────────────────

router.patch(
  '/:id/inquiries/:inquiryId',
  requireAuth,
  [body('answer').isLength({ min: 1, max: 2000 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const case_ = await db('cases').where({ id: req.params.id }).first();
      if (!case_) throw httpError(404, '案件不存在');

      const inquiry = await db('inquiries')
        .where({ id: req.params.inquiryId, case_id: case_.id })
        .first();
      if (!inquiry) throw httpError(404, '问询记录不存在');
      if (inquiry.answer) throw httpError(400, '已回答过此问题');

      // Validate answerer — support multi-party via target_user_id or fallback to role check
      if (inquiry.target_user_id) {
        // New style: inquiry has specific target user
        if (inquiry.target_user_id !== req.user.sub) throw httpError(403, '无权回答此问题');
      } else {
        // Legacy: check by role against primary plaintiff/defendant
        const isPlaintiff = inquiry.target === 'plaintiff' && case_.plaintiff_id === req.user.sub;
        const isDefendant = inquiry.target === 'defendant' && case_.defendant_id === req.user.sub;
        // Also check case_parties for multi-party support
        const parties = await db('case_parties').where({ case_id: case_.id, user_id: req.user.sub });
        const partyRole = parties.length > 0 ? parties[0].role : null;
        const isPartyMatch = partyRole === inquiry.target;
        if (!isPlaintiff && !isDefendant && !isPartyMatch) throw httpError(403, '无权回答此问题');
      }

      const [updated] = await db('inquiries')
        .where({ id: inquiry.id })
        .update({ answer: req.body.answer, answered_at: db.fn.now() })
        .returning('*');

      // Notify judge
      const judgeId = case_.judge_id;
      if (judgeId) {
        await createNotification({
          userId: judgeId,
          caseId: case_.id,
          type: 'inquiry_answered',
          title: '当事人已回答问询',
          body: `案件 ${case_.case_number} 有新的问询回答。`,
        });
      }

      // AI 法官：检查所有问题都回答完了，自动触发事实认定
      if (case_.is_ai_judge) {
        const unanswered = await db('inquiries')
          .where({ case_id: case_.id })
          .whereNull('answer')
          .count('id as count')
          .first();
        if (Number(unanswered.count) === 0) {
          const { scheduleAiFactFinding } = require('../queues/caseQueue');
          await scheduleAiFactFinding(case_.id);
        }
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /cases/:id/fact-finding — 法官提交事实认定 ─────────────────────

router.patch(
  '/:id/fact-finding',
  requireAuth,
  [body('fact_finding').isLength({ min: 1, max: 2000 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const case_ = await db('cases').where({ id: req.params.id }).first();
      if (!case_) throw httpError(404, '案件不存在');
      if (case_.judge_id !== req.user.sub && !case_.is_ai_judge)
        throw httpError(403, '只有法官可以提交事实认定');
      if (!['pending_inquiry', 'pending_fact_finding'].includes(case_.status))
        throw httpError(400, '案件状态不允许此操作');

      const [updated] = await db('cases')
        .where({ id: case_.id })
        .update({
          fact_finding: req.body.fact_finding,
          fact_finding_is_ai: case_.is_ai_judge,
          status: 'pending_claim',
          updated_at: db.fn.now(),
        })
        .returning('*');

      // Notify all parties (plaintiffs + defendants)
      const factParties = await db('case_parties').where({ case_id: case_.id });
      const factUserIds = factParties.length > 0
        ? factParties.map(p => p.user_id)
        : [case_.plaintiff_id, case_.defendant_id].filter(Boolean);
      await createNotificationsForUsers(factUserIds, {
        caseId: case_.id,
        type: 'fact_finding_published',
        title: '法院认定事实已发布',
        body: `案件 ${case_.case_number} 的事实认定已发布，请查看。`,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /cases/:id/claim — 原告提出诉求 ────────────────────────────────

router.patch(
  '/:id/claim',
  requireAuth,
  [
    body('plaintiff_claim').isLength({ min: 1, max: 1000 }),
    body('claim_category').isIn(['apology', 'behavior', 'compensation', 'agreement', 'other']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const case_ = await db('cases').where({ id: req.params.id }).first();
      if (!case_) throw httpError(404, '案件不存在');
      if (case_.plaintiff_id !== req.user.sub) throw httpError(403, '只有原告可以提出诉求');
      if (case_.status !== 'pending_claim') throw httpError(400, '案件状态不允许此操作');

      const [updated] = await db('cases')
        .where({ id: case_.id })
        .update({
          plaintiff_claim: req.body.plaintiff_claim,
          claim_category: req.body.claim_category,
          status: 'pending_defendant_response',
          updated_at: db.fn.now(),
        })
        .returning('*');

      const plaintiffAlias = await getMemberAlias(case_.plaintiff_id);

      // Notify all defendants
      const parties = await db('case_parties').where({ case_id: case_.id, role: 'defendant' });
      const defendantUserIds = parties.length > 0
        ? parties.map(p => p.user_id)
        : [case_.defendant_id].filter(Boolean);
      await createNotificationsForUsers(defendantUserIds, {
        caseId: case_.id,
        type: 'claim_submitted',
        title: `${plaintiffAlias} 提出了诉求`,
        body: '请查看诉求并表态。',
      });

      // Notify judge
      if (case_.judge_id) {
        await createNotification({
          userId: case_.judge_id,
          caseId: case_.id,
          type: 'claim_submitted',
          title: `${plaintiffAlias} 提出了诉求`,
          body: `案件 ${case_.case_number} 原告已提出诉求，等待被告表态。`,
        });
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /cases/:id/respond — 被告表态 ──────────────────────────────────

router.patch(
  '/:id/respond',
  requireAuth,
  [
    body('response').isIn(['accept', 'partial', 'reject']),
    body('reason').optional().isLength({ max: 1000 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const case_ = await db('cases').where({ id: req.params.id }).first();
      if (!case_) throw httpError(404, '案件不存在');
      if (case_.defendant_id !== req.user.sub) throw httpError(403, '只有被告可以表态');
      if (case_.status !== 'pending_defendant_response') throw httpError(400, '案件状态不允许此操作');

      const { response, reason } = req.body;
      let newStatus;
      let verdict = null;

      if (response === 'accept') {
        newStatus = 'closed';
        verdict = `被告接受了原告的诉求：${case_.plaintiff_claim}`;
      } else {
        newStatus = 'mediation';
      }

      const [updated] = await db('cases')
        .where({ id: case_.id })
        .update({
          defendant_response: response,
          defendant_response_reason: reason || null,
          status: newStatus,
          verdict,
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (response === 'accept') {
        // Case closed
        const members = await db('users').where({ family_id: case_.family_id });
        await createNotificationsForUsers(
          members.map((m) => m.id),
          {
            caseId: case_.id,
            type: 'case_closed',
            title: `案件 ${case_.case_number} 已结案`,
            body: '双方已达成一致，案件已结案。',
          }
        );
      } else {
        // Notify parties mediation starts
        await createNotificationsForUsers(
          [case_.plaintiff_id, case_.defendant_id].filter(Boolean),
          {
            caseId: case_.id,
            type: 'mediation_started',
            title: '案件进入调解阶段',
            body: '等待法官提出调解方案。',
          }
        );

        // Notify judge
        if (case_.judge_id) {
          await createNotification({
            userId: case_.judge_id,
            caseId: case_.id,
            type: 'mediation_needed',
            title: '被告拒绝或部分接受诉求',
            body: `案件 ${case_.case_number} 需要调解，请提出调解方案。`,
          });
        }

        // AI 法官自动触发调解方案
        if (case_.is_ai_judge) {
          const { scheduleAiMediation } = require('../queues/caseQueue');
          await scheduleAiMediation(case_.id);
        }
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /cases/:id/mediate — 法官提交调解方案 ──────────────────────────

router.patch(
  '/:id/mediate',
  requireAuth,
  [body('mediation_plan').isLength({ min: 1, max: 3000 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const case_ = await db('cases').where({ id: req.params.id }).first();
      if (!case_) throw httpError(404, '案件不存在');
      if (case_.judge_id !== req.user.sub && !case_.is_ai_judge)
        throw httpError(403, '只有法官可以提交调解方案');
      if (case_.status !== 'mediation') throw httpError(400, '案件状态不允许此操作');

      const [updated] = await db('cases')
        .where({ id: case_.id })
        .update({
          mediation_plan: req.body.mediation_plan,
          mediation_plan_is_ai: case_.is_ai_judge,
          updated_at: db.fn.now(),
        })
        .returning('*');

      await createNotificationsForUsers(
        [case_.plaintiff_id, case_.defendant_id].filter(Boolean),
        {
          caseId: case_.id,
          type: 'mediation_plan_submitted',
          title: '法官已提出调解方案',
          body: '请查看调解方案并表态。',
        }
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /cases/:id/mediation-response — 双方对调解方案表态 ─────────────

router.patch(
  '/:id/mediation-response',
  requireAuth,
  [body('response').isIn(['accept', 'reject'])],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const case_ = await db('cases').where({ id: req.params.id }).first();
      if (!case_) throw httpError(404, '案件不存在');
      if (case_.status !== 'mediation') throw httpError(400, '案件状态不允许此操作');
      if (!case_.mediation_plan) throw httpError(400, '调解方案尚未提交');

      const isPlaintiff = case_.plaintiff_id === req.user.sub;
      const isDefendant = case_.defendant_id === req.user.sub;
      if (!isPlaintiff && !isDefendant) throw httpError(403, '无权操作');

      const field = isPlaintiff ? 'plaintiff_mediation_response' : 'defendant_mediation_response';
      const [updated] = await db('cases')
        .where({ id: case_.id })
        .update({ [field]: req.body.response, updated_at: db.fn.now() })
        .returning('*');

      // Check if both responded
      const pResp = updated.plaintiff_mediation_response;
      const dResp = updated.defendant_mediation_response;

      if (pResp && dResp) {
        const bothAccept = pResp === 'accept' && dResp === 'accept';

        if (bothAccept) {
          // Notify judge to confirm closure — judge decides when to close
          if (case_.judge_id) {
            await createNotification({
              userId: case_.judge_id,
              caseId: case_.id,
              type: 'mediation_both_accepted',
              title: '双方已接受调解方案',
              body: '双方均接受调解方案，请确认结案。',
            });
          }
        } else {
          // At least one party rejected — archive
          await db('cases').where({ id: case_.id }).update({
            status: 'archived',
            updated_at: db.fn.now(),
          });

          const members = await db('users').where({ family_id: case_.family_id });
          await createNotificationsForUsers(
            members.map((m) => m.id),
            {
              caseId: case_.id,
              type: 'case_archived',
              title: `案件 ${case_.case_number} 未达成一致，已存档`,
              body: '双方未达成一致，案件已存档，完整记录已保留。',
            }
          );
        }
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /cases/:id/close — 法官确认结案 ────────────────────────────────

router.patch(
  '/:id/close',
  requireAuth,
  [body('verdict').optional().isLength({ max: 2000 })],
  async (req, res, next) => {
    try {
      const case_ = await db('cases').where({ id: req.params.id }).first();
      if (!case_) throw httpError(404, '案件不存在');
      if (case_.judge_id !== req.user.sub) throw httpError(403, '只有法官可以确认结案');
      if (case_.status !== 'mediation') throw httpError(400, '案件状态不允许此操作');

      // Both parties must have accepted mediation
      if (case_.plaintiff_mediation_response !== 'accept' || case_.defendant_mediation_response !== 'accept') {
        throw httpError(400, '双方尚未全部接受调解方案');
      }

      const verdict = req.body.verdict || `双方接受调解方案：${case_.mediation_plan}`;

      const [updated] = await db('cases')
        .where({ id: case_.id })
        .update({
          status: 'closed',
          verdict,
          updated_at: db.fn.now(),
        })
        .returning('*');

      // Notify all family members
      const members = await db('users').where({ family_id: case_.family_id });
      await createNotificationsForUsers(
        members.map((m) => m.id),
        {
          caseId: case_.id,
          type: 'case_closed',
          title: `案件 ${case_.case_number} 已结案 ✅`,
          body: '法官已确认结案，案件已结案。',
        }
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /cases/:id/withdraw — 原告撤诉 ─────────────────────────────────

router.patch(
  '/:id/withdraw',
  requireAuth,
  [body('reason').optional().isLength({ max: 500 })],
  async (req, res, next) => {
    try {
      const case_ = await db('cases').where({ id: req.params.id }).first();
      if (!case_) throw httpError(404, '案件不存在');
      if (case_.plaintiff_id !== req.user.sub) throw httpError(403, '只有原告可以撤诉');

      const withdrawableStatuses = ['pending_judge_accept', 'pending_defendant'];
      if (!withdrawableStatuses.includes(case_.status)) {
        throw httpError(400, '当前阶段不允许撤诉（被告已提交答辩后不可单方撤诉）');
      }

      await cancelAiJobs(case_.id);

      const [updated] = await db('cases')
        .where({ id: case_.id })
        .update({
          status: 'withdrawn',
          withdrawn: true,
          withdraw_reason: req.body.reason || null,
          updated_at: db.fn.now(),
        })
        .returning('*');

      const plaintiffAlias = await getMemberAlias(case_.plaintiff_id);
      const notifyIds = [case_.judge_id, case_.defendant_id].filter(Boolean);
      await createNotificationsForUsers(notifyIds, {
        caseId: case_.id,
        type: 'case_withdrawn',
        title: `${plaintiffAlias} 已撤回诉讼`,
        body: `案件 ${case_.case_number} 已撤诉。`,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /cases/:id/visibility — 切换公开/私密 ──────────────────────────

router.patch('/:id/visibility', requireAuth, async (req, res, next) => {
  try {
    const case_ = await db('cases').where({ id: req.params.id }).first();
    if (!case_) throw httpError(404, '案件不存在');

    const role = getCaseRole(case_, req.user.sub);
    if (role !== 'plaintiff' && role !== 'defendant') {
      throw httpError(403, '只有当事人可以修改公开设置');
    }

    // Both parties must consent — simple toggle for v1.0 (plaintiff controls)
    const [updated] = await db('cases')
      .where({ id: case_.id })
      .update({ is_public: !case_.is_public, updated_at: db.fn.now() })
      .returning('*');

    res.json({ is_public: updated.is_public });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
