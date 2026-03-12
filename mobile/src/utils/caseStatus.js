import colors from '../theme/colors';

export const CASE_STATUS_LABELS = {
  pending_judge_accept: '待法官受理',
  pending_defendant: '待被告答辩',
  pending_inquiry: '待法官问询',
  pending_fact_finding: '待事实认定',
  pending_claim: '待原告提出诉求',
  pending_defendant_response: '待被告表态',
  mediation: '调解中',
  closed: '已结案',
  archived: '已存档',
  withdrawn: '已撤诉',
};

export const CASE_STATUS_COLORS = {
  pending_judge_accept: colors.statusPending,
  pending_defendant: colors.statusPending,
  pending_inquiry: colors.statusInquiry,
  pending_fact_finding: colors.statusInquiry,
  pending_claim: colors.statusPending,
  pending_defendant_response: colors.statusPending,
  mediation: colors.statusMediation,
  closed: colors.statusClosed,
  archived: colors.statusArchived,
  withdrawn: colors.statusWithdrawn,
};

export const CATEGORY_LABELS = {
  chores: '家务分工',
  spending: '消费决策',
  education: '教育分歧',
  verbal: '言语冲突',
  other: '其他',
};

export const CLAIM_CATEGORY_LABELS = {
  apology: '道歉',
  behavior: '行为改变',
  compensation: '补偿',
  agreement: '共同约定',
  other: '其他',
};

export function getStatusLabel(status) {
  return CASE_STATUS_LABELS[status] || status;
}

export function getStatusColor(status) {
  return CASE_STATUS_COLORS[status] || colors.stone;
}
