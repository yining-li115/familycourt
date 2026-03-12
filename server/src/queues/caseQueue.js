'use strict';

const { Queue, Worker } = require('bullmq');
const redis = require('../utils/redis');
const db = require('../utils/db');
const { createNotificationsForUsers } = require('../services/notification');

const QUEUE_NAME = 'case-jobs';

const caseQueue = new Queue(QUEUE_NAME, { connection: redis });

// ─── Worker ────────────────────────────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { name, data } = job;

    if (name === 'ai-warning') {
      await handleAiWarning(data.caseId);
    } else if (name === 'ai-takeover') {
      await handleAiTakeover(data.caseId);
    } else if (name === 'defendant-deadline-reminder') {
      await handleDefendantDeadlineReminder(data.caseId);
    } else if (name === 'ai-auto-inquiry') {
      await handleAiAutoInquiry(data.caseId);
    } else if (name === 'ai-fact-finding') {
      await handleAiFactFinding(data.caseId);
    } else if (name === 'ai-mediation') {
      await handleAiMediation(data.caseId);
    }
  },
  { connection: redis }
);

worker.on('failed', (job, err) => {
  console.error(`[Queue] job ${job?.name} failed:`, err.message);
});

// ─── Job handlers ──────────────────────────────────────────────────────────

async function handleAiWarning(caseId) {
  const case_ = await db('cases').where({ id: caseId }).first();
  if (!case_ || case_.status !== 'pending_judge_accept') return;

  const members = await db('users').where({ family_id: case_.family_id });
  const recipientIds = members.map((m) => m.id);

  await createNotificationsForUsers(recipientIds, {
    caseId,
    type: 'ai_warning',
    title: '案件即将由 AI 法官接管',
    body: `案件 ${case_.case_number} 将在 5 分钟后由 AI 法官接管，如需亲自处理请尽快。`,
  });
}

async function handleAiTakeover(caseId) {
  const case_ = await db('cases').where({ id: caseId }).first();
  if (!case_ || case_.status !== 'pending_judge_accept') return;

  await db('cases').where({ id: caseId }).update({
    is_ai_judge: true,
    judge_id: null,
    ai_takeover_at: db.fn.now(),
    status: 'pending_defendant',
    updated_at: db.fn.now(),
  });

  const members = await db('users').where({ family_id: case_.family_id });

  await createNotificationsForUsers(
    members.map((m) => m.id),
    {
      caseId,
      type: 'ai_takeover',
      title: 'AI 法官已接管案件',
      body: `案件 ${case_.case_number} 已由 AI 法官接管。`,
    }
  );

  // Notify defendant to submit defense
  await createNotificationsForUsers([case_.defendant_id], {
    caseId,
    type: 'case_accepted',
    title: '你被起诉了',
    body: '请查看原告陈述并提交你的答辩。',
  });
}

async function handleDefendantDeadlineReminder(caseId) {
  const case_ = await db('cases').where({ id: caseId }).first();
  if (!case_ || case_.status !== 'pending_defendant') return;

  await createNotificationsForUsers([case_.defendant_id], {
    caseId,
    type: 'defendant_reminder',
    title: '答辩截止提醒',
    body: `案件 ${case_.case_number} 的答辩截止时间即将到来，请尽快提交。`,
  });
}

// ─── Phase 2: AI auto-inquiry ──────────────────────────────────────────────

async function handleAiAutoInquiry(caseId) {
  const case_ = await db('cases').where({ id: caseId }).first();
  if (!case_) {
    console.warn(`[Queue] handleAiAutoInquiry: 案件 ${caseId} 不存在`);
    return;
  }
  if (case_.status !== 'pending_inquiry' || !case_.is_ai_judge) {
    console.warn(`[Queue] handleAiAutoInquiry: 案件 ${caseId} 状态或法官类型不符，跳过`);
    return;
  }

  const { aiJudgeInquiry } = require('../services/aiJudge');

  let result;
  try {
    result = await aiJudgeInquiry(case_);
  } catch (err) {
    console.error(`[Queue] handleAiAutoInquiry: AI 调用失败 caseId=${caseId}`, err.message);
    return;
  }

  const { questionsForPlaintiff = [], questionsForDefendant = [] } = result;

  const inquiryRows = [
    ...questionsForPlaintiff.map((q) => ({
      case_id: caseId,
      round: 1,
      type: 'private_plaintiff',
      question: q,
      target: 'plaintiff',
      is_visible_to_both: false,
    })),
    ...questionsForDefendant.map((q) => ({
      case_id: caseId,
      round: 1,
      type: 'private_defendant',
      question: q,
      target: 'defendant',
      is_visible_to_both: false,
    })),
  ];

  if (inquiryRows.length > 0) {
    try {
      await db('inquiries').insert(inquiryRows);
    } catch (err) {
      console.error(`[Queue] handleAiAutoInquiry: 插入问询记录失败 caseId=${caseId}`, err.message);
      return;
    }
  }

  // Notify both parties
  await createNotificationsForUsers(
    [case_.plaintiff_id, case_.defendant_id].filter(Boolean),
    {
      caseId,
      type: 'inquiry_received',
      title: '法官有问题需要你回答',
      body: '请进入案件查看问题并回答。',
    }
  );

  console.info(`[Queue] handleAiAutoInquiry: 案件 ${caseId} 已生成 ${inquiryRows.length} 条 AI 问询`);
}

// ─── Phase 2: AI fact finding ──────────────────────────────────────────────

async function handleAiFactFinding(caseId) {
  const case_ = await db('cases').where({ id: caseId }).first();
  if (!case_) {
    console.warn(`[Queue] handleAiFactFinding: 案件 ${caseId} 不存在`);
    return;
  }
  if (!case_.is_ai_judge) {
    console.warn(`[Queue] handleAiFactFinding: 案件 ${caseId} 非 AI 法官，跳过`);
    return;
  }

  const inquiries = await db('inquiries').where({ case_id: caseId }).orderBy('created_at');

  const { aiFactFinding } = require('../services/aiJudge');

  let factFindingText;
  try {
    factFindingText = await aiFactFinding(case_, inquiries);
  } catch (err) {
    console.error(`[Queue] handleAiFactFinding: AI 调用失败 caseId=${caseId}`, err.message);
    return;
  }

  try {
    await db('cases').where({ id: caseId }).update({
      fact_finding: factFindingText,
      fact_finding_is_ai: true,
      status: 'pending_claim',
      updated_at: db.fn.now(),
    });
  } catch (err) {
    console.error(`[Queue] handleAiFactFinding: 更新案件失败 caseId=${caseId}`, err.message);
    return;
  }

  await createNotificationsForUsers(
    [case_.plaintiff_id, case_.defendant_id].filter(Boolean),
    {
      caseId,
      type: 'fact_finding_published',
      title: '法院认定事实已发布',
      body: `案件 ${case_.case_number} 的事实认定已发布，请查看。`,
    }
  );

  console.info(`[Queue] handleAiFactFinding: 案件 ${caseId} 事实认定已生成`);
}

// ─── Phase 2: AI mediation ─────────────────────────────────────────────────

async function handleAiMediation(caseId) {
  const case_ = await db('cases').where({ id: caseId }).first();
  if (!case_) {
    console.warn(`[Queue] handleAiMediation: 案件 ${caseId} 不存在`);
    return;
  }
  if (!case_.is_ai_judge || case_.status !== 'mediation') {
    console.warn(`[Queue] handleAiMediation: 案件 ${caseId} 状态或法官类型不符，跳过`);
    return;
  }

  const { aiMediation } = require('../services/aiJudge');

  let result;
  try {
    result = await aiMediation(case_);
  } catch (err) {
    console.error(`[Queue] handleAiMediation: AI 调用失败 caseId=${caseId}`, err.message);
    return;
  }

  // Take the first plan as the stored mediation_plan text
  const plans = result.plans || [];
  const firstPlan = plans[0];
  let mediationPlanText;
  if (firstPlan) {
    // Store all plans as formatted text so parties can see options
    mediationPlanText = plans
      .map((p) => `【${p.title}】\n${p.content}`)
      .join('\n\n');
  } else {
    mediationPlanText = '（AI 调解方案生成失败）';
  }

  try {
    await db('cases').where({ id: caseId }).update({
      mediation_plan: mediationPlanText,
      mediation_plan_is_ai: true,
      updated_at: db.fn.now(),
    });
  } catch (err) {
    console.error(`[Queue] handleAiMediation: 更新案件失败 caseId=${caseId}`, err.message);
    return;
  }

  await createNotificationsForUsers(
    [case_.plaintiff_id, case_.defendant_id].filter(Boolean),
    {
      caseId,
      type: 'mediation_plan_submitted',
      title: '法官已提出调解方案',
      body: '请查看调解方案并表态。',
    }
  );

  console.info(`[Queue] handleAiMediation: 案件 ${caseId} 调解方案已生成，共 ${plans.length} 个方案`);
}

// ─── Schedule helpers ──────────────────────────────────────────────────────

/**
 * Schedule the AI warning (T - 5min) and AI takeover (T) jobs
 * when a new case is created or a judge is assigned.
 */
async function scheduleAiJobs(caseId, timeoutMins) {
  const warningDelay = Math.max(0, (timeoutMins - 5) * 60 * 1000);
  const takeoverDelay = timeoutMins * 60 * 1000;

  await caseQueue.add('ai-warning', { caseId }, { delay: warningDelay, jobId: `ai-warning-${caseId}` });
  await caseQueue.add('ai-takeover', { caseId }, { delay: takeoverDelay, jobId: `ai-takeover-${caseId}` });
}

async function cancelAiJobs(caseId) {
  const warningJob = await caseQueue.getJob(`ai-warning-${caseId}`);
  const takeoverJob = await caseQueue.getJob(`ai-takeover-${caseId}`);
  if (warningJob) await warningJob.remove();
  if (takeoverJob) await takeoverJob.remove();
}

/**
 * Enqueue AI auto-inquiry generation for an AI-judge case.
 * Called after the defendant submits their defense (status becomes pending_inquiry).
 */
async function scheduleAiAutoInquiry(caseId) {
  await caseQueue.add(
    'ai-auto-inquiry',
    { caseId },
    { jobId: `ai-auto-inquiry-${caseId}` }
  );
}

/**
 * Enqueue AI fact-finding for an AI-judge case.
 * Called when all inquiry questions have been answered.
 */
async function scheduleAiFactFinding(caseId) {
  await caseQueue.add(
    'ai-fact-finding',
    { caseId },
    { jobId: `ai-fact-finding-${caseId}` }
  );
}

/**
 * Enqueue AI mediation plan generation for an AI-judge case.
 * Called when the defendant rejects or partially accepts the plaintiff's claim.
 */
async function scheduleAiMediation(caseId) {
  await caseQueue.add(
    'ai-mediation',
    { caseId },
    { jobId: `ai-mediation-${caseId}` }
  );
}

module.exports = {
  caseQueue,
  scheduleAiJobs,
  cancelAiJobs,
  scheduleAiAutoInquiry,
  scheduleAiFactFinding,
  scheduleAiMediation,
};
