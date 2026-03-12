const db = require('./db');

async function generateCaseNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  const startOfDay = new Date(today);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count } = await db('cases')
    .count('id as count')
    .where('created_at', '>=', startOfDay.toISOString())
    .first();

  const seq = String(Number(count) + 1).padStart(3, '0');
  return `FC-${dateStr}-${seq}`;
}

module.exports = { generateCaseNumber };
