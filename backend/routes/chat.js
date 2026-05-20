const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// List room saya
router.get('/rooms', auth, async (req, res) => {
  try {
    const [rooms] = await db.query(`
      SELECT r.*, 
        (SELECT u.nama FROM users u JOIN room_members rm2 ON u.id=rm2.user_id WHERE rm2.room_id=r.id AND u.id!=? LIMIT 1) as partner_nama,
        (SELECT u.avatar FROM users u JOIN room_members rm2 ON u.id=rm2.user_id WHERE rm2.room_id=r.id AND u.id!=? LIMIT 1) as partner_avatar,
        (SELECT isi FROM messages WHERE room_id=r.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE room_id=r.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM rooms r JOIN room_members rm ON r.id=rm.room_id
      WHERE rm.user_id=? ORDER BY r.created_at DESC`,
      [req.user.id, req.user.id, req.user.id]);
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get pesan dalam room
router.get('/rooms/:id/messages', auth, async (req, res) => {
  try {
    // Cek apakah user member room ini
    const [member] = await db.query('SELECT id FROM room_members WHERE room_id=? AND user_id=?',
      [req.params.id, req.user.id]);
    if (!member.length) return res.status(403).json({ message: 'Anda bukan anggota room ini' });
    const [messages] = await db.query(`
      SELECT m.*, u.nama as sender_nama, u.avatar as sender_avatar
      FROM messages m JOIN users u ON m.user_id=u.id
      WHERE m.room_id=? ORDER BY m.created_at ASC LIMIT 100`, [req.params.id]);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Kirim pesan
router.post('/rooms/:id/messages', auth, async (req, res) => {
  try {
    const [member] = await db.query('SELECT id FROM room_members WHERE room_id=? AND user_id=?',
      [req.params.id, req.user.id]);
    if (!member.length) return res.status(403).json({ message: 'Anda bukan anggota room ini' });
    const { isi } = req.body;
    if (!isi?.trim()) return res.status(400).json({ message: 'Pesan tidak boleh kosong' });
    const [result] = await db.query('INSERT INTO messages (room_id,user_id,isi) VALUES (?,?,?)',
      [req.params.id, req.user.id, isi]);
    const [msg] = await db.query(`SELECT m.*, u.nama as sender_nama FROM messages m JOIN users u ON m.user_id=u.id WHERE m.id=?`, [result.insertId]);
    res.status(201).json(msg[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Jadwal bersama dalam room
router.get('/rooms/:id/jadwal', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT jb.*, u.nama as creator_nama FROM jadwal_bersama jb
      JOIN users u ON jb.created_by=u.id WHERE jb.room_id=? ORDER BY jb.tanggal, jb.jam_mulai`,
      [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Buat jadwal bersama
router.post('/rooms/:id/jadwal', auth, async (req, res) => {
  try {
    const [member] = await db.query('SELECT id FROM room_members WHERE room_id=? AND user_id=?',
      [req.params.id, req.user.id]);
    if (!member.length) return res.status(403).json({ message: 'Anda bukan anggota room ini' });
    const { judul, tanggal, jam_mulai, jam_selesai, lokasi } = req.body;
    await db.query('INSERT INTO jadwal_bersama (room_id,judul,tanggal,jam_mulai,jam_selesai,lokasi,created_by) VALUES (?,?,?,?,?,?,?)',
      [req.params.id, judul, tanggal, jam_mulai, jam_selesai, lokasi, req.user.id]);
    res.status(201).json({ message: 'Jadwal belajar berhasil dibuat' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
