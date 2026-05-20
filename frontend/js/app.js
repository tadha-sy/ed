/* ─── STATE ─────────────────────────────────────────── */
let currentUser = null;
let allMatkul = [];
let currentRoom = null;
let pendingRequestTarget = null;
let pendingLaporTarget = null;
let activeJadwalRoom = null;
let pollInterval = null;
let lastMsgCount = 0;

/* ─── INIT ──────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  const user = getUser();
  if (token && user) {
    currentUser = user;
    bootApp();
  }
});

/* ─── AUTH ──────────────────────────────────────────── */
function showForm(name) {
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(name + '-form').classList.add('active');
}

function togglePw(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  err.classList.add('hidden');
  try {
    const data = await POST('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    currentUser = data.user;
    bootApp();
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

async function doRegister() {
  const nama = document.getElementById('reg-nama').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const jurusan = document.getElementById('reg-jurusan').value;
  const semester = document.getElementById('reg-semester').value;
  const err = document.getElementById('register-error');
  err.classList.add('hidden');
  if (!nama || !email || !password) {
    err.textContent = 'Nama, email, dan password wajib diisi';
    return err.classList.remove('hidden');
  }
  try {
    await POST('/auth/register', { nama, email, password, jurusan, semester: parseInt(semester) });
    showForm('login');
    document.getElementById('login-email').value = email;
    document.getElementById('login-error').textContent = '✅ Registrasi berhasil! Silakan masuk.';
    document.getElementById('login-error').className = 'alert alert-success';
    document.getElementById('login-error').classList.remove('hidden');
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

function doLogout() {
  clearAuth();
  currentUser = null;
  if (pollInterval) clearInterval(pollInterval);
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').style.display = 'flex';
  showForm('login');
}

/* ─── BOOT APP ──────────────────────────────────────── */
function bootApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');

  // Update sidebar user info
  document.getElementById('sidebar-nama').textContent = currentUser.nama;
  document.getElementById('sidebar-jurusan').textContent = currentUser.jurusan || 'Mahasiswa';
  document.getElementById('sidebar-avatar').textContent = currentUser.nama?.[0]?.toUpperCase() || '?';
  document.getElementById('welcome-nama').textContent = currentUser.nama.split(' ')[0];

  // Show admin nav if admin
  if (currentUser.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  }

  loadMatkul();
  loadBerandaData();
  loadRequestBadge();

  // Poll for new messages every 10s
  pollInterval = setInterval(() => {
    if (currentRoom) pollMessages();
    loadRequestBadge();
  }, 10000);
}

/* ─── PAGE NAVIGATION ───────────────────────────────── */
function showPage(name, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (el) el.classList.add('active');

  // Load page data
  if (name === 'beranda') loadBerandaData();
  else if (name === 'cari') { cariPartner(); loadMatkulFilter(); }
  else if (name === 'requests') { loadRequests('masuk'); loadRequests('keluar'); }
  else if (name === 'chat') loadRooms();
  else if (name === 'jadwal') loadAllJadwal();
  else if (name === 'profil') loadProfil();
  else if (name === 'admin') { loadAdminStats(); loadAdminUsers(); }
}

/* ─── TABS ──────────────────────────────────────────── */
function switchTab(name, el) {
  document.querySelectorAll('#page-requests .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#page-requests .tab-content').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'masuk') loadRequests('masuk');
  else loadRequests('keluar');
}

function switchAdminTab(name, el) {
  document.querySelectorAll('.admin-tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#page-admin .tab-content').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('admin-tab-' + name).classList.add('active');
  if (name === 'users') loadAdminUsers();
  else loadAdminLaporan();
}

/* ─── BERANDA ───────────────────────────────────────── */
async function loadBerandaData() {
  try {
    const [partners, roomsData, reqData] = await Promise.all([
      GET('/partner/cari'),
      GET('/chat/rooms'),
      GET('/partner/requests/masuk')
    ]);
    const pending = reqData.filter(r => r.status === 'pending');
    document.getElementById('h-partners').textContent = partners.length;
    document.getElementById('h-rooms').textContent = roomsData.length;
    document.getElementById('h-requests').textContent = pending.length;

    // Rekomendasi (top 3)
    const rekEl = document.getElementById('rekomendasi-list');
    if (!partners.length) {
      rekEl.innerHTML = '<div class="loading-text">Lengkapi profil untuk rekomendasi</div>';
    } else {
      rekEl.innerHTML = partners.slice(0, 3).map(p => `
        <div class="partner-mini">
          <div class="p-avatar" style="background:${avatarColor(p.nama)}">${p.nama[0].toUpperCase()}</div>
          <div class="partner-mini-info">
            <div class="partner-mini-name">${esc(p.nama)}</div>
            <div class="partner-mini-meta">${esc(p.jurusan||'—')} · Sem ${p.semester||'?'}</div>
          </div>
          <button class="btn-sm btn-chat" onclick="openRequestModal(${p.id},'${esc(p.nama)}')">Ajak</button>
        </div>`).join('');
    }

    // Request preview (top 3 pending)
    const reqEl = document.getElementById('request-preview');
    if (!pending.length) {
      reqEl.innerHTML = '<div class="loading-text">Tidak ada permintaan masuk</div>';
    } else {
      reqEl.innerHTML = pending.slice(0, 3).map(r => `
        <div class="req-preview">
          <div class="p-avatar" style="background:${avatarColor(r.pengirim_nama)}">${r.pengirim_nama[0].toUpperCase()}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600">${esc(r.pengirim_nama)}</div>
            <div style="font-size:11px;color:var(--text2)">${esc(r.pengirim_jurusan||'—')}</div>
          </div>
          <button class="btn-sm btn-accept" onclick="respondRequest(${r.id},'diterima')">✓</button>
          <button class="btn-sm btn-reject" onclick="respondRequest(${r.id},'ditolak')">✗</button>
        </div>`).join('');
    }
  } catch(e) { console.error(e); }
}

/* ─── MATKUL ────────────────────────────────────────── */
async function loadMatkul() {
  try {
    allMatkul = await GET('/partner/matkul');
    loadMatkulCheckboxes();
  } catch(e) {}
}

function loadMatkulFilter() {
  const sel = document.getElementById('filter-matkul');
  sel.innerHTML = '<option value="">Semua Mata Kuliah</option>';
  allMatkul.forEach(m => sel.innerHTML += `<option value="${m.id}">${esc(m.nama)} (${esc(m.jurusan)})</option>`);
}

function loadMatkulCheckboxes() {
  const el = document.getElementById('matkul-checkboxes');
  el.innerHTML = allMatkul.map(m =>
    `<label class="matkul-check"><input type="checkbox" value="${m.id}" class="mk-cb"> ${esc(m.nama)}</label>`
  ).join('');
}

/* ─── CARI PARTNER ──────────────────────────────────── */
async function cariPartner() {
  const matkul = document.getElementById('filter-matkul')?.value || '';
  const jurusan = document.getElementById('filter-jurusan')?.value || '';
  const semester = document.getElementById('filter-semester')?.value || '';
  const grid = document.getElementById('partner-grid');
  grid.innerHTML = '<div class="loading-text">Mencari partner...</div>';
  try {
    let url = '/partner/cari?';
    if (matkul) url += `matkul=${matkul}&`;
    if (jurusan) url += `jurusan=${encodeURIComponent(jurusan)}&`;
    if (semester) url += `semester=${semester}&`;
    const partners = await GET(url.slice(0,-1)||'/partner/cari');
    if (!partners.length) { grid.innerHTML = '<div class="empty-state">Tidak ada partner ditemukan. Coba filter lain.</div>'; return; }
    grid.innerHTML = partners.map(p => `
      <div class="partner-card">
        <div class="partner-card-top">
          <div class="p-avatar" style="background:${avatarColor(p.nama)}">${p.nama[0].toUpperCase()}</div>
          <div>
            <div class="p-name">${esc(p.nama)}</div>
            <div class="p-meta">${esc(p.jurusan||'—')} · Semester ${p.semester||'?'}</div>
          </div>
        </div>
        ${p.bio ? `<div class="p-bio">${esc(p.bio)}</div>` : ''}
        ${p.matkul?.length ? `<div class="matkul-tags">${p.matkul.map(m=>`<span class="tag">${esc(m)}</span>`).join('')}</div>` : ''}
        <div class="partner-actions">
          <button class="btn-sm btn-chat" onclick="openRequestModal(${p.id},'${esc(p.nama)}')">📨 Ajak Belajar</button>
          <button class="btn-sm btn-reject" onclick="openLaporModal(${p.id},'${esc(p.nama)}')">🚨 Lapor</button>
        </div>
      </div>`).join('');
  } catch(e) { grid.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

/* ─── MODALS ────────────────────────────────────────── */
function openRequestModal(userId, nama) {
  pendingRequestTarget = userId;
  document.getElementById('modal-request-to').textContent = `Kirim ajakan belajar ke ${nama}`;
  document.getElementById('modal-pesan').value = '';
  document.getElementById('modal-request').classList.remove('hidden');
}

async function submitRequest() {
  try {
    await POST('/partner/request', { penerima_id: pendingRequestTarget, pesan: document.getElementById('modal-pesan').value });
    closeModal('modal-request');
    alert('Ajakan berhasil terkirim!');
  } catch(e) { alert(e.message); }
}

function openLaporModal(userId, nama) {
  pendingLaporTarget = userId;
  document.getElementById('modal-lapor-to').textContent = `Melaporkan ${nama}`;
  document.getElementById('modal-alasan').value = '';
  document.getElementById('modal-lapor').classList.remove('hidden');
}

async function submitLaporan() {
  try {
    await POST('/admin/laporan', { terlapor_id: pendingLaporTarget, alasan: document.getElementById('modal-alasan').value });
    closeModal('modal-lapor');
    alert('Laporan terkirim!');
  } catch(e) { alert(e.message); }
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

/* ─── REQUESTS ──────────────────────────────────────── */
async function loadRequests(type) {
  const el = document.getElementById('requests-' + type);
  el.innerHTML = '<div class="loading-text">Memuat...</div>';
  try {
    const data = await GET('/partner/requests/' + type);
    if (!data.length) { el.innerHTML = '<div class="empty-state">Tidak ada permintaan</div>'; return; }
    el.innerHTML = data.map(r => {
      const nama = type === 'masuk' ? r.pengirim_nama : r.penerima_nama;
      const jurusan = type === 'masuk' ? r.pengirim_jurusan : r.penerima_jurusan;
      const actions = type === 'masuk' && r.status === 'pending' ? `
        <div class="request-actions">
          <button class="btn-sm btn-accept" onclick="respondRequest(${r.id},'diterima')">✓ Terima</button>
          <button class="btn-sm btn-reject" onclick="respondRequest(${r.id},'ditolak')">✗ Tolak</button>
        </div>` :
        `<span class="request-status status-${r.status}">${r.status}</span>`;
      return `<div class="request-card">
        <div class="p-avatar" style="background:${avatarColor(nama)}">${nama[0].toUpperCase()}</div>
        <div class="request-info">
          <div class="request-name">${esc(nama)}</div>
          <div class="request-meta">${esc(jurusan||'—')} · ${timeAgo(r.created_at)}</div>
          ${r.pesan ? `<div class="request-msg">"${esc(r.pesan)}"</div>` : ''}
        </div>
        ${actions}
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

async function respondRequest(id, status) {
  try {
    const res = await PUT(`/partner/request/${id}`, { status });
    loadRequests('masuk');
    loadBerandaData();
    if (status === 'diterima') {
      alert('Permintaan diterima! Room diskusi telah dibuat. Cek halaman Chat.');
    }
  } catch(e) { alert(e.message); }
}

async function loadRequestBadge() {
  try {
    const data = await GET('/partner/requests/masuk');
    const pending = data.filter(r => r.status === 'pending').length;
    const badge = document.getElementById('req-badge');
    if (pending > 0) { badge.textContent = pending; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  } catch(e) {}
}

/* ─── CHAT ──────────────────────────────────────────── */
async function loadRooms() {
  const el = document.getElementById('room-list');
  el.innerHTML = '<div class="loading-text">Memuat...</div>';
  try {
    const rooms = await GET('/chat/rooms');
    if (!rooms.length) { el.innerHTML = '<div class="loading-text">Belum ada room. Terima ajakan partner untuk membuat room!</div>'; return; }
    el.innerHTML = rooms.map(r => `
      <div class="room-item ${currentRoom?.id === r.id ? 'active':''}" onclick="openRoom(${r.id},'${esc(r.partner_nama||'Partner')}','${r.partner_avatar||''}')">
        <div class="p-avatar" style="background:${avatarColor(r.partner_nama||'?')};width:40px;height:40px;font-size:15px">${(r.partner_nama||'?')[0].toUpperCase()}</div>
        <div class="room-item-info">
          <div class="room-item-name">${esc(r.partner_nama||'Room')}</div>
          <div class="room-item-last">${r.last_message ? esc(r.last_message) : 'Belum ada pesan'}</div>
        </div>
      </div>`).join('');
  } catch(e) { el.innerHTML = `<div class="loading-text">Error: ${e.message}</div>`; }
}

async function openRoom(roomId, partnerNama, partnerAvatar) {
  currentRoom = { id: roomId, partnerNama };
  lastMsgCount = 0;

  // Update room list highlight
  document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
  event?.currentTarget?.classList.add('active');

  const chatPanel = document.getElementById('chat-panel');
  chatPanel.innerHTML = `
    <div class="chat-header">
      <div class="p-avatar" style="background:${avatarColor(partnerNama)};width:38px;height:38px;font-size:14px">${partnerNama[0].toUpperCase()}</div>
      <div class="chat-header-info">
        <h4>${esc(partnerNama)}</h4>
        <small>Room Diskusi Aktif</small>
      </div>
      <div class="chat-header-actions">
        <button class="btn-sm btn-chat" onclick="openJadwalModal(${roomId})">📅 Jadwal Belajar</button>
      </div>
    </div>
    <div class="messages-area" id="messages-area"></div>
    <div class="chat-input-area">
      <input type="text" id="chat-input" placeholder="Tulis pesan..." onkeydown="if(event.key==='Enter')sendMessage()">
      <button class="btn-send" onclick="sendMessage()">➤</button>
    </div>`;

  await loadMessages();
}

async function loadMessages() {
  if (!currentRoom) return;
  try {
    const msgs = await GET(`/chat/rooms/${currentRoom.id}/messages`);
    const area = document.getElementById('messages-area');
    if (!area) return;
    if (msgs.length === lastMsgCount) return;
    lastMsgCount = msgs.length;
    const atBottom = area.scrollHeight - area.scrollTop <= area.clientHeight + 60;
    area.innerHTML = msgs.map(m => {
      const isMine = m.user_id === currentUser.id;
      return `<div class="msg ${isMine ? 'mine' : ''}">
        <div class="msg-avatar">${(m.sender_nama||'?')[0].toUpperCase()}</div>
        <div>
          <div class="msg-bubble">${esc(m.isi)}</div>
          <div class="msg-time">${fmtTime(m.created_at)}</div>
        </div>
      </div>`;
    }).join('');
    if (atBottom || msgs.length <= 10) area.scrollTop = area.scrollHeight;
  } catch(e) {}
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const isi = input?.value?.trim();
  if (!isi || !currentRoom) return;
  input.value = '';
  try {
    await POST(`/chat/rooms/${currentRoom.id}/messages`, { isi });
    lastMsgCount = 0;
    await loadMessages();
  } catch(e) { alert(e.message); }
}

async function pollMessages() { await loadMessages(); }

/* ─── JADWAL ────────────────────────────────────────── */
function openJadwalModal(roomId) {
  activeJadwalRoom = roomId;
  document.getElementById('jdl-judul').value = '';
  document.getElementById('jdl-tanggal').value = '';
  document.getElementById('jdl-mulai').value = '';
  document.getElementById('jdl-selesai').value = '';
  document.getElementById('jdl-lokasi').value = '';
  document.getElementById('modal-jadwal').classList.remove('hidden');
}

async function submitJadwal() {
  const body = {
    judul: document.getElementById('jdl-judul').value,
    tanggal: document.getElementById('jdl-tanggal').value,
    jam_mulai: document.getElementById('jdl-mulai').value,
    jam_selesai: document.getElementById('jdl-selesai').value,
    lokasi: document.getElementById('jdl-lokasi').value,
  };
  if (!body.judul || !body.tanggal) return alert('Judul dan tanggal wajib diisi');
  try {
    await POST(`/chat/rooms/${activeJadwalRoom}/jadwal`, body);
    closeModal('modal-jadwal');
    alert('Jadwal berhasil dibuat!');
    loadAllJadwal();
  } catch(e) { alert(e.message); }
}

async function loadAllJadwal() {
  const el = document.getElementById('jadwal-list');
  el.innerHTML = '<div class="loading-text">Memuat...</div>';
  try {
    const rooms = await GET('/chat/rooms');
    if (!rooms.length) { el.innerHTML = '<div class="empty-state">Belum ada jadwal. Buat jadwal dari halaman Chat.</div>'; return; }
    let allJadwal = [];
    for (const r of rooms) {
      try {
        const jd = await GET(`/chat/rooms/${r.id}/jadwal`);
        jd.forEach(j => { j._partner = r.partner_nama; });
        allJadwal = allJadwal.concat(jd);
      } catch(e) {}
    }
    allJadwal.sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));
    if (!allJadwal.length) { el.innerHTML = '<div class="empty-state">Belum ada jadwal belajar bersama.</div>'; return; }
    el.innerHTML = allJadwal.map(j => {
      const d = new Date(j.tanggal);
      const days = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
      return `<div class="jadwal-card">
        <div class="jadwal-date">
          <div class="jadwal-day">${days[d.getDay()]}</div>
          <div class="jadwal-num">${d.getDate()}</div>
        </div>
        <div class="jadwal-info">
          <div class="jadwal-title">${esc(j.judul)}</div>
          <div class="jadwal-meta">
            🕐 ${j.jam_mulai||'—'} – ${j.jam_selesai||'—'}
            ${j.lokasi ? ` · 📍 ${esc(j.lokasi)}` : ''}
            ${j._partner ? ` · dengan ${esc(j._partner)}` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

document.getElementById('h-jadwal')?.addEventListener && (async () => {
  try {
    const rooms = await GET('/chat/rooms');
    let cnt = 0;
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7*24*60*60*1000);
    for (const r of rooms) {
      const jd = await GET(`/chat/rooms/${r.id}/jadwal`).catch(()=>[]);
      cnt += jd.filter(j => { const d = new Date(j.tanggal); return d >= now && d <= weekLater; }).length;
    }
    document.getElementById('h-jadwal').textContent = cnt;
  } catch(e) {}
})();

/* ─── PROFIL ────────────────────────────────────────── */
async function loadProfil() {
  try {
    const data = await GET('/auth/me');
    document.getElementById('profil-avatar-display').textContent = data.nama[0].toUpperCase();
    document.getElementById('profil-nama-display').textContent = data.nama;
    document.getElementById('profil-jurusan-display').textContent = `${data.jurusan||'—'} · Semester ${data.semester||'?'}`;
    document.getElementById('profil-bio-display').textContent = data.bio || 'Belum ada bio';
    const mkEl = document.getElementById('profil-matkul-display');
    mkEl.innerHTML = (data.matkul||[]).map(m=>`<span class="tag">${esc(m.nama)}</span>`).join('');

    // Fill edit form
    document.getElementById('edit-nama').value = data.nama;
    document.getElementById('edit-jurusan').value = data.jurusan || '';
    document.getElementById('edit-semester').value = data.semester || '';
    document.getElementById('edit-bio').value = data.bio || '';

    // Check matkul boxes
    const userMatkulIds = (data.matkul||[]).map(m=>m.id);
    document.querySelectorAll('.mk-cb').forEach(cb => {
      cb.checked = userMatkulIds.includes(parseInt(cb.value));
    });
  } catch(e) {}
}

async function saveProfile() {
  const matkul_ids = [...document.querySelectorAll('.mk-cb:checked')].map(cb => parseInt(cb.value));
  const body = {
    nama: document.getElementById('edit-nama').value,
    jurusan: document.getElementById('edit-jurusan').value,
    semester: parseInt(document.getElementById('edit-semester').value) || null,
    bio: document.getElementById('edit-bio').value,
    matkul_ids
  };
  const suc = document.getElementById('profil-success');
  try {
    await PUT('/auth/profile', body);
    currentUser = { ...currentUser, ...body };
    setUser(currentUser);
    document.getElementById('sidebar-nama').textContent = body.nama;
    document.getElementById('sidebar-jurusan').textContent = body.jurusan || 'Mahasiswa';
    suc.classList.remove('hidden');
    setTimeout(() => suc.classList.add('hidden'), 3000);
    loadProfil();
  } catch(e) { alert(e.message); }
}

/* ─── ADMIN ─────────────────────────────────────────── */
async function loadAdminStats() {
  try {
    const s = await GET('/admin/stats');
    document.getElementById('admin-stats').innerHTML = `
      <div class="stat-card"><div class="stat-icon">👥</div><div><div class="stat-val">${s.total_users}</div><div class="stat-lbl">Total Mahasiswa</div></div></div>
      <div class="stat-card"><div class="stat-icon">💬</div><div><div class="stat-val">${s.total_rooms}</div><div class="stat-lbl">Room Diskusi</div></div></div>
      <div class="stat-card"><div class="stat-icon">📝</div><div><div class="stat-val">${s.total_messages}</div><div class="stat-lbl">Total Pesan</div></div></div>
      <div class="stat-card"><div class="stat-icon">🚨</div><div><div class="stat-val">${s.total_laporan}</div><div class="stat-lbl">Laporan Pending</div></div></div>`;
  } catch(e) {}
}

async function loadAdminUsers() {
  const search = document.getElementById('admin-search')?.value || '';
  const status = document.getElementById('admin-status-filter')?.value || '';
  const el = document.getElementById('admin-users-table');
  try {
    let url = '/admin/users?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (status) url += `status=${status}`;
    const users = await GET(url);
    if (!users.length) { el.innerHTML = '<div class="empty-state">Tidak ada user ditemukan</div>'; return; }
    el.innerHTML = `<table>
      <thead><tr><th>Nama</th><th>Email</th><th>Jurusan</th><th>Semester</th><th>Status</th><th>Terdaftar</th><th>Aksi</th></tr></thead>
      <tbody>${users.map(u => `<tr>
        <td><b>${esc(u.nama)}</b></td>
        <td style="color:var(--text2)">${esc(u.email)}</td>
        <td>${esc(u.jurusan||'—')}</td>
        <td>${u.semester||'—'}</td>
        <td><span class="request-status status-${u.status==='aktif'?'diterima':u.status==='banned'?'ditolak':'pending'}">${u.status}</span></td>
        <td style="color:var(--text2)">${fmtDate(u.created_at)}</td>
        <td>
          ${u.status === 'aktif'
            ? `<button class="btn-sm btn-reject" onclick="changeUserStatus(${u.id},'banned')">Ban</button>`
            : `<button class="btn-sm btn-accept" onclick="changeUserStatus(${u.id},'aktif')">Aktifkan</button>`}
        </td>
      </tr>`).join('')}</tbody></table>`;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

async function changeUserStatus(id, status) {
  if (!confirm(`Ubah status user menjadi ${status}?`)) return;
  try {
    await PUT(`/admin/users/${id}/status`, { status });
    loadAdminUsers();
  } catch(e) { alert(e.message); }
}

async function loadAdminLaporan() {
  const el = document.getElementById('admin-laporan-table');
  try {
    const data = await GET('/admin/laporan');
    if (!data.length) { el.innerHTML = '<div class="empty-state">Tidak ada laporan</div>'; return; }
    el.innerHTML = `<table>
      <thead><tr><th>Pelapor</th><th>Terlapor</th><th>Alasan</th><th>Status</th><th>Tanggal</th><th>Aksi</th></tr></thead>
      <tbody>${data.map(l => `<tr>
        <td>${esc(l.pelapor_nama)}</td>
        <td>${esc(l.terlapor_nama)}</td>
        <td style="max-width:200px;font-size:13px">${esc(l.alasan||'—')}</td>
        <td><span class="request-status status-${l.status==='selesai'?'diterima':l.status==='diproses'?'pending':'ditolak'}">${l.status}</span></td>
        <td style="color:var(--text2)">${fmtDate(l.created_at)}</td>
        <td style="display:flex;gap:6px">
          ${l.status==='pending'?`<button class="btn-sm btn-chat" onclick="updateLaporan(${l.id},'diproses')">Proses</button>`:''}
          ${l.status!=='selesai'?`<button class="btn-sm btn-accept" onclick="updateLaporan(${l.id},'selesai')">Selesai</button>`:''}
        </td>
      </tr>`).join('')}</tbody></table>`;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

async function updateLaporan(id, status) {
  try { await PUT(`/admin/laporan/${id}`, { status }); loadAdminLaporan(); }
  catch(e) { alert(e.message); }
}

/* ─── UTILS ─────────────────────────────────────────── */
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function avatarColor(name) {
  const colors = ['#6c63ff','#a78bfa','#38bdf8','#34d399','#f59e0b','#f87171','#ec4899','#14b8a6'];
  if (!name) return colors[0];
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash<<5)-hash);
  return colors[Math.abs(hash) % colors.length];
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff/60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff/3600)} jam lalu`;
  return `${Math.floor(diff/86400)} hari lalu`;
}

function fmtTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Close modal on backdrop click
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
});
