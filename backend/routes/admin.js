const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

// Dashboard stats
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const [[{ total_users }]] = await db.query("SELECT COUNT(*) as total_users FROM users WHERE role='mahasiswa'");
    const [[{ total_rooms }]] = await db.query('SELECT COUNT(*) as total_rooms FROM rooms');
    const [[{ total_messages }]] = await db.query('SELECT COUNT(*) as total_messages FROM messages');
    const [[{ total_laporan }]] = await db.query("SELECT COUNT(*) as total_laporan FROM laporan WHERE status='pending'");
    const [recent_users] = await db.query("SELECT id,nama,email,jurusan,semester,status,created_at FROM users WHERE role='mahasiswa' ORDER BY created_at DESC LIMIT 5");
    res.json({ total_users, total_rooms, total_messages, total_laporan, recent_users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List semua user
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = "SELECT id,nama,email,jurusan,semester,status,created_at FROM users WHERE role='mahasiswa'";
    const params = [];
    if (search) { query += ' AND (nama LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (status) { query += ' AND status=?'; params.push(status); }
    query += ' ORDER BY created_at DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Ban/unban user
router.put('/users/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE users SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ message: `Status user diubah menjadi ${status}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List laporan
router.get('/laporan', auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, 
        p.nama as pelapor_nama, 
        t.nama as terlapor_nama
      FROM laporan l 
      JOIN users p ON l.pelapor_id=p.id 
      JOIN users t ON l.terlapor_id=t.id
      ORDER BY l.created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update status laporan
router.put('/laporan/:id', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE laporan SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ message: 'Status laporan diperbarui' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Kirim laporan (mahasiswa)
router.post('/laporan', auth, async (req, res) => {
  try {
    const { terlapor_id, alasan } = req.body;
    await db.query('INSERT INTO laporan (pelapor_id,terlapor_id,alasan) VALUES (?,?,?)',
      [req.user.id, terlapor_id, alasan]);
    res.status(201).json({ message: 'Laporan terkirim' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
