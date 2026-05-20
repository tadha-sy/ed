const BASE = '/api';

function getToken() { return localStorage.getItem('tb_token'); }
function setToken(t) { localStorage.setItem('tb_token', t); }
function setUser(u) { localStorage.setItem('tb_user', JSON.stringify(u)); }
function getUser() { try { return JSON.parse(localStorage.getItem('tb_user')); } catch { return null; } }
function clearAuth() { localStorage.removeItem('tb_token'); localStorage.removeItem('tb_user'); }

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = getToken();
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Terjadi kesalahan');
  return data;
}

const GET  = (path)       => api('GET', path);
const POST = (path, body) => api('POST', path, body);
const PUT  = (path, body) => api('PUT', path, body);
