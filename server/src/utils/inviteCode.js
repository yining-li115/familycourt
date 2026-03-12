const db = require('./db');

const INVITE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // excludes 0OIL1

async function generateInviteCode() {
  let code;
  let exists = true;
  while (exists) {
    code = Array.from({ length: 6 }, () =>
      INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)]
    ).join('');
    const row = await db('families').where({ invite_code: code }).first();
    exists = !!row;
  }
  return code;
}

module.exports = { generateInviteCode };
