// Lean REST client for the guest kiosk app.
//
// Auth: Bearer <token> in the Authorization header (token persisted via the
// `storage` shim — localStorage on web, Capacitor Preferences on native).
//
// Every method throws a thin Error with .status + .code on non-2xx, so the
// caller can branch on err.code (the stable `{ error: '<code>' }` field
// from the backend) rather than parsing the Vietnamese .message.

import { storage } from './storage';

const BASE = (import.meta.env.VITE_API_BASE || '') + '/api';
const TOKEN_KEY = 'mgt_guest_token';

async function getToken() { return storage.get(TOKEN_KEY); }
async function setToken(t) { return storage.set(TOKEN_KEY, t); }
async function clearToken() { return storage.del(TOKEN_KEY); }

async function request(path, opts = {}) {
  const token = await getToken();
  const isMultipart = opts.body instanceof FormData;
  const headers = { ...(opts.headers || {}) };
  if (!isMultipart && opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body && !isMultipart && typeof opts.body !== 'string'
      ? JSON.stringify(opts.body) : opts.body,
  });
  if (!res.ok) {
    let detail = {};
    try { detail = await res.json(); } catch {}
    const err = new Error(detail.message || detail.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = detail.error;
    throw err;
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  async login(email, password) {
    const out = await request('/auth/login', { method: 'POST', body: { email, password } });
    if (out.token) await setToken(out.token);
    return out;
  },
  async logout() {
    try { await request('/auth/logout', { method: 'POST' }); } catch {}
    await clearToken();
  },
  async me() { return request('/me'); },

  // Reads (server scopes to guest's own data)
  async listAccounts()    { return request('/accounts'); },
  async listClasses()     { return request('/classes'); },
  async listStudents()    { return request('/students'); },

  // Writes
  // POST /students expects the body wrapped as { form, docs, profileComplete }.
  // Guest app uploads docs via a separate endpoint after create — the upload
  // route auto-sets the docs_<key> = 1 flags — so we only ship `form` here.
  async createStudent(form)            { return request('/students',      { method: 'POST',  body: { form } }); },
  async updateStudent(id, patch)       { return request('/students/' + id, { method: 'PATCH', body: patch }); },

  // Uploads
  async uploadStudentDoc(studentId, key, file) {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/students/${studentId}/docs/${key}`, { method: 'POST', body: fd });
  },

  // OCR
  async cccdQr(file) {
    const fd = new FormData();
    fd.append('file', file);
    return request('/ocr/cccd-qr', { method: 'POST', body: fd });
  },

  // Token plumbing (exposed for LoginGate + logout flows)
  hasToken: async () => Boolean(await getToken()),
  clearToken,
};
