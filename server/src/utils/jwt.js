const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

function signAccess(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: ACCESS_EXPIRES });
}

function signRefresh(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: REFRESH_EXPIRES });
}

function verify(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signAccess, signRefresh, verify };
