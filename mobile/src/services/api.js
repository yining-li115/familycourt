import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://api.familycourt.app'; // replace with production URL

async function getAccessToken() {
  return AsyncStorage.getItem('access_token');
}

async function request(method, path, body = null, retry = true) {
  const token = await getAccessToken();

  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    // Try refreshing token
    const refreshed = await refreshAccessToken();
    if (refreshed) return request(method, path, body, false);
  }

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

async function refreshAccessToken() {
  try {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    await AsyncStorage.setItem('access_token', data.access_token);
    return true;
  } catch {
    return false;
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  sendCode: (phone) => request('POST', '/auth/send-code', { phone }),
  verify: (phone, code, nickname, fcm_token) =>
    request('POST', '/auth/verify', { phone, code, nickname, fcm_token }),
  logout: (refresh_token) => request('DELETE', '/auth/logout', { refresh_token }),
};

// ─── Users ─────────────────────────────────────────────────────────────────

export const usersApi = {
  me: () => request('GET', '/users/me'),
  update: (data) => request('PATCH', '/users/me', data),
};

// ─── Families ──────────────────────────────────────────────────────────────

export const familiesApi = {
  create: (name) => request('POST', '/families', { name }),
  join: (invite_code, alias) => request('POST', '/families/join', { invite_code, alias }),
  me: () => request('GET', '/families/me'),
  members: () => request('GET', '/families/me/members'),
  update: (data) => request('PATCH', '/families/me', data),
  refreshCode: () => request('POST', '/families/me/refresh-code'),
  removeMember: (userId) => request('DELETE', `/families/me/members/${userId}`),
};

// ─── Cases ─────────────────────────────────────────────────────────────────

export const casesApi = {
  list: () => request('GET', '/cases'),
  get: (id) => request('GET', `/cases/${id}`),
  create: (data) => request('POST', '/cases', data),
  accept: (id, deadline_hours) => request('PATCH', `/cases/${id}/accept`, { deadline_hours }),
  recuse: (id) => request('PATCH', `/cases/${id}/recuse`),
  defend: (id, data) => request('PATCH', `/cases/${id}/defend`, data),
  addInquiry: (id, data) => request('POST', `/cases/${id}/inquiries`, data),
  answerInquiry: (id, inquiryId, answer) =>
    request('PATCH', `/cases/${id}/inquiries/${inquiryId}`, { answer }),
  submitFactFinding: (id, fact_finding) =>
    request('PATCH', `/cases/${id}/fact-finding`, { fact_finding }),
  submitClaim: (id, data) => request('PATCH', `/cases/${id}/claim`, data),
  respond: (id, response, reason) => request('PATCH', `/cases/${id}/respond`, { response, reason }),
  mediate: (id, mediation_plan) => request('PATCH', `/cases/${id}/mediate`, { mediation_plan }),
  mediationResponse: (id, response) =>
    request('PATCH', `/cases/${id}/mediation-response`, { response }),
  withdraw: (id, reason) => request('PATCH', `/cases/${id}/withdraw`, { reason }),
  toggleVisibility: (id) => request('PATCH', `/cases/${id}/visibility`),
};

// ─── Notifications ─────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/notifications${qs ? `?${qs}` : ''}`);
  },
  markRead: (id) => request('PATCH', `/notifications/${id}/read`),
  markAllRead: () => request('PATCH', '/notifications/read-all'),
};
