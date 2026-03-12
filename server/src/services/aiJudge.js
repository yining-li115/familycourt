'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = 'gemini-2.0-flash';

function getModel() {
  return genAI.getGenerativeModel({ model: MODEL });
}

// ─── aiJudgeInquiry ────────────────────────────────────────────────────────

async function aiJudgeInquiry(case_) {
  try {
    const model = getModel();
    const prompt = `你是一位经验丰富的家庭调解员，正在主持家庭内部矛盾的调解工作。
你的任务是：
1. 仔细阅读原告和被告的陈述
2. 识别 2-3 个核心分歧点
3. 针对每个分歧点，向双方各提出 1-2 个中立的澄清问题

语气要求：平和、温和、中立，不带任何评判色彩，不对对错发表意见，帮助双方更清晰地表达自己的感受和立场。
请用中文回复。

严格按以下 JSON 格式返回，不要输出任何其他内容：
{
  "disputePoints": ["分歧点1", "分歧点2"],
  "questionsForPlaintiff": ["问题1", "问题2"],
  "questionsForDefendant": ["问题1", "问题2"]
}

原告陈述：${case_.plaintiff_statement}

被告陈述：${case_.defendant_statement}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 返回格式不正确，未找到 JSON');
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[aiJudge] aiJudgeInquiry 失败:', err.message);
    return {
      disputePoints: ['双方对事件经过存在分歧'],
      questionsForPlaintiff: ['请详细描述事件发生的经过和你的感受。'],
      questionsForDefendant: ['请说明你对事件的理解以及你当时的想法。'],
    };
  }
}

// ─── aiFactFinding ─────────────────────────────────────────────────────────

async function aiFactFinding(case_, inquiries) {
  try {
    const inquirySummary = inquiries
      .filter((i) => i.answer)
      .map((i) => `【${i.target === 'plaintiff' ? '原告' : '被告'}被问】${i.question}\n【回答】${i.answer}`)
      .join('\n\n');

    const model = getModel();
    const prompt = `你是一位家庭调解员，需要根据双方陈述和问询记录，撰写一份客观中立的事实认定。

要求：
- 用第三人称描述事件经过
- 不作任何对错判断，只还原事实
- 控制在 300 字以内
- 对于双方说法不一致的地方，如实标注"双方说法存在分歧"
- 文末单独一行给出置信度评估，格式严格为：置信度：高 / 置信度：中 / 置信度：低
  - 高：双方陈述基本一致
  - 中：部分分歧，但核心事实较清晰
  - 低：分歧较大，难以判断
- 请用中文回复，不要输出 JSON

原告陈述：${case_.plaintiff_statement}

被告陈述：${case_.defendant_statement}

问询记录：
${inquirySummary || '（暂无问询记录）'}`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('[aiJudge] aiFactFinding 失败:', err.message);
    return '（AI 事实认定生成失败，请法官人工补充事实认定。）\n\n置信度：低';
  }
}

// ─── aiMediation ───────────────────────────────────────────────────────────

async function aiMediation(case_) {
  try {
    const context = [
      `原告陈述：${case_.plaintiff_statement}`,
      `被告陈述：${case_.defendant_statement}`,
      case_.fact_finding ? `事实认定：${case_.fact_finding}` : '',
      case_.plaintiff_claim ? `原告诉求：${case_.plaintiff_claim}` : '',
      case_.defendant_response_reason
        ? `被告对诉求的意见：${case_.defendant_response_reason}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const model = getModel();
    const prompt = `你是一位家庭调解员，需要为家庭纠纷提出切实可行的调解方案。

要求：
- 提出 2-3 个不同侧重点的调解方案，覆盖从原告倾向到被告倾向的不同平衡点
- 每个方案都要具体、可操作，避免空泛
- 语气平和，照顾到双方的感受，不偏袒任何一方
- 请用中文回复

严格按以下 JSON 格式返回，不要输出任何其他内容：
{
  "plans": [
    { "title": "方案A：XXX", "content": "具体内容..." },
    { "title": "方案B：XXX", "content": "具体内容..." },
    { "title": "方案C：XXX", "content": "具体内容..." }
  ]
}

${context}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 返回格式不正确，未找到 JSON');
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[aiJudge] aiMediation 失败:', err.message);
    return {
      plans: [
        {
          title: '方案A：双方协商',
          content: '（AI 调解方案生成失败，请法官人工制定调解方案。）',
        },
      ],
    };
  }
}

// ─── aiVerdictSummary ──────────────────────────────────────────────────────

async function aiVerdictSummary(case_) {
  try {
    const context = [
      `案件编号：${case_.case_number}`,
      `纠纷类型：${case_.category}`,
      `原告陈述：${case_.plaintiff_statement}`,
      `被告陈述：${case_.defendant_statement}`,
      case_.fact_finding ? `事实认定：${case_.fact_finding}` : '',
      case_.plaintiff_claim ? `原告诉求：${case_.plaintiff_claim}` : '',
      case_.mediation_plan ? `调解方案：${case_.mediation_plan}` : '',
      case_.verdict ? `结案结果：${case_.verdict}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const model = getModel();
    const prompt = `你是一位家庭调解员，需要为已结案的家庭纠纷撰写一份简洁的结案摘要，供家庭存档。

要求：
- 用第三人称，客观描述纠纷起因、经过和解决方式
- 突出双方最终达成的共识或结果
- 语气温暖，鼓励家庭和谐
- 控制在 200 字以内
- 请用中文回复，不要输出 JSON

${context}`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('[aiJudge] aiVerdictSummary 失败:', err.message);
    return '（AI 结案摘要生成失败，案件已按记录存档。）';
  }
}

module.exports = { aiJudgeInquiry, aiFactFinding, aiMediation, aiVerdictSummary };
