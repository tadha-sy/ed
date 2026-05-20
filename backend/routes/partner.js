const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// Cari partner belajar
router.get('/cari', auth, async (req, res) => {
  try {
    const { matkul, jurusan, semester } = req.query;
    let query = `SELECT DISTINCT u.id, u.nama, u.jurusan, u.semester, u.bio, u.avatar
      FROM users u
      LEFT JOIN user_matkul um ON u.id = um.user_id
      LEFT JOIN mata_kuliah mk ON um.matkul_id = mk.id
      WHERE u.id != ? AND u.role = 'mahasiswa' AND u.status = 'aktif'`;
    const params = [req.user.id];
    if (matkul) { query += ' AND mk.id = ?'; params.push(matkul); }
    if (jurusan) { query += ' AND u.jurusan = ?'; params.push(jurusan); }
    if (semester) { query += ' AND u.semester = ?'; params.push(semester); }
    const [users] = await db.query(query, params);
    // Ambil matkul untuk setiap user
    for (const u of users) {
      const [mk] = await db.query(`SELECT mk.nama FROM mata_kuliah mk JOIN user_matkul um ON mk.id=um.matkul_id WHERE um.user_id=?`, [u.id]);
      u.matkul = mk.map(m => m.nama);
    }
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Kirim permintaan partner
router.post('/request', auth, async (req, res) => {
  try {
    const { penerima_id, pesan } = req.body;
    // Cek apakah sudah ada request pending
    const [existing] = await db.query(
      `SELECT id FROM partner_requests WHERE pengirim_id=? AND penerima_id=? AND status='pending'`,
      [req.user.id, penerima_id]);
    if (existing.length) return res.status(409).json({ message: 'Permintaan sudah terkirim' });
    await db.query('INSERT INTO partner_requests (pengirim_id,penerima_id,pesan) VALUES (?,?,?)',
      [req.user.id, penerima_id, pesan]);
    res.status(201).json({ message: 'Permintaan terkirim' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List permintaan masuk
router.get('/requests/masuk', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT pr.*, u.nama as pengirim_nama, u.jurusan as pengirim_jurusan, u.avatar as pengirim_avatar
      FROM partner_requests pr JOIN users u ON pr.pengirim_id=u.id
      WHERE pr.penerima_id=? ORDER BY pr.created_at DESC`, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List permintaan keluar
router.get('/requests/keluar', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT pr.*, u.nama as penerima_nama, u.jurusan as penerima_jurusan, u.avatar as penerima_avatar
      FROM partner_requests pr JOIN users u ON pr.penerima_id=u.id
      WHERE pr.pengirim_id=? ORDER BY pr.created_at DESC`, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Terima/tolak permintaan
router.put('/request/:id', auth, async (req, res) => {
  try {
    const { status } = req.body; // 'diterima' atau 'ditolak'
    const [rows] = await db.query('SELECT * FROM partner_requests WHERE id=? AND penerima_id=?',
      [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'Permintaan tidak ditemukan' });
    await db.query('UPDATE partner_requests SET status=? WHERE id=?', [status, req.params.id]);

    if (status === 'diterima') {
      const req_data = rows[0];
      // Buat room diskusi
      const [result] = await db.query('INSERT INTO rooms (nama, request_id) VALUES (?,?)',
        [`Room ${req_data.pengirim_id}-${req_data.penerima_id}`, req.params.id]);
      const roomId = result.insertId;
      await db.query('INSERT INTO room_members (room_id,user_id) VALUES (?,?),(?,?)',
        [roomId, req_data.pengirim_id, roomId, req_data.penerima_id]);
      return res.json({ message: 'Permintaan diterima, room diskusi dibuat', room_id: roomId });
    }
    res.json({ message: 'Permintaan ditolak' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get semua mata kuliah
router.get('/matkul', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM mata_kuliah ORDER BY jurusan, nama');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
