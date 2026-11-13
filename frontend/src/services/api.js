const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

export function getAccessToken() {
  return accessToken;
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Cannot reach the server. Is the backend running?'), {
      code: 'NETWORK_ERROR',
    });
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const err = new Error(data?.error?.message || `Request failed (${res.status}).`);
    err.status = res.status;
    err.code = data?.error?.code;
    throw err;
  }

  return data;
}

// A shared in-flight refresh promise. Multiple callers (e.g. React StrictMode's
// double-mount) share ONE refresh request, so the refresh token is rotated only
// once instead of twice (which would trip the server's reuse-detection and
// revoke the whole session family).
let refreshPromise = null;
function refreshOnce() {
  if (!refreshPromise) {
    refreshPromise = request('/auth/refresh', { method: 'POST' }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export const api = {
  signup: (body) => request('/auth/signup', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  refresh: refreshOnce,
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  getMyProfile: () => request('/travellers/me'),
  putMyProfile: (body) => request('/travellers/me', { method: 'PUT', body }),
  interests: () => request('/meta/interests'),
  createGroup: (body) => request('/groups', { method: 'POST', body }),
  listGroups: (query) => {
    const q = new URLSearchParams(query).toString();
    return request(`/groups${q ? `?${q}` : ''}`);
  },
  getGroup: (groupId) => request(`/groups/${groupId}`),
  searchGroups: (body) => request('/search', { method: 'POST', body }),
  sendJoinRequest: (groupId, body) => request(`/groups/${groupId}/requests`, { method: 'POST', body }),
  getGroupRequests: (groupId) => request(`/groups/${groupId}/requests`),
  decideRequest: (requestId, action) => request(`/requests/${requestId}`, { method: 'PATCH', body: { action } }),
  getMyGroups: () => request('/users/me/groups'),
  getProfileRequests: () => request('/users/me/requests'),
  listHotelOptions: (groupId, query) => {
    const q = new URLSearchParams(query).toString();
    return request(`/groups/${groupId}/hotels${q ? `?${q}` : ''}`);
  },
  getHotelPlan: (groupId) => request(`/groups/${groupId}/hotel-plan`),
  saveHotelSelection: (groupId, body) =>
    request(`/groups/${groupId}/hotel-plan`, { method: 'POST', body }),
  updateHotelSelection: (groupId, selectionId, body) =>
    request(`/groups/${groupId}/hotel-plan/${selectionId}`, { method: 'PATCH', body }),
  deleteHotelSelection: (groupId, selectionId) =>
    request(`/groups/${groupId}/hotel-plan/${selectionId}`, { method: 'DELETE' }),
};
