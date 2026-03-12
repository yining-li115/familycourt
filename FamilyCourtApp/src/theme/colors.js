const colors = {
  primary: '#4A7C59',       // 鼠尾草绿（主色）
  primaryLight: '#E8F0EB',  // 淡绿背景
  primaryMid: '#C5D9CB',    // 中绿分割线
  warm: '#8B6F47',          // 暖棕（强调）
  warmLight: '#F5EFE6',     // 米白背景
  stone: '#6B6B6B',         // 石灰文字
  stoneLight: '#F2F2F0',    // 浅灰背景
  black: '#1A1A1A',         // 正文
  white: '#FFFFFF',
  aiTag: '#5B8FA8',         // AI 生成标识专用色

  // Status badge colors
  statusPending: '#8B6F47',   // pending_* → 暖棕
  statusInquiry: '#5B8FA8',   // pending_inquiry → 蓝灰
  statusMediation: '#C4813A', // mediation → 橙棕
  statusClosed: '#4A7C59',    // closed → 鼠尾草绿
  statusArchived: '#6B6B6B',  // archived → 石灰
  statusWithdrawn: '#AAAAAA', // withdrawn → 浅灰

  error: '#C0392B',
  warning: '#E67E22',
  success: '#27AE60',
};

module.exports = colors;
export default colors;
