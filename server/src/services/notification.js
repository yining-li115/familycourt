const db = require('../utils/db');

/**
 * Create an in-app notification record and optionally send FCM push.
 */
async function createNotification({ userId, caseId = null, type, title, body }) {
  const [notification] = await db('notifications')
    .insert({ user_id: userId, case_id: caseId, type, title, body })
    .returning('*');

  // Send FCM push if user has a token
  const user = await db('users').where({ id: userId }).select('fcm_token').first();
  if (user?.fcm_token) {
    await sendFcmPush(user.fcm_token, title, body, { caseId, type });
  }

  return notification;
}

async function createNotificationsForUsers(userIds, payload) {
  await Promise.all(userIds.map((userId) => createNotification({ ...payload, userId })));
}

async function sendFcmPush(token, title, body, data = {}) {
  // Firebase Admin SDK — lazy init to avoid crash if env vars not set
  try {
    const admin = require('./firebase');
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ),
    });
  } catch (err) {
    // Push failure should never block the main flow
    console.error('[FCM] push failed:', err.message);
  }
}

module.exports = { createNotification, createNotificationsForUsers };
