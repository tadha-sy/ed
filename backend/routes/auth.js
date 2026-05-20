const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    const { nama, email, password, jurusan, semester } = req.body;
    if (!nama || !email || !password) return res.status(400).json({ message: 'Semua field wajib diisi' });
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ message: 'Email sudah terdaftar' });
    const hash = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (nama, email, password, jurusan, semester) VALUES (?,?,?,?,?)',
      [nama, email, hash, jurusan || null, semester || null]);
    res.status(201).json({ message: 'Registrasi berhasil' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(401).json({ message: 'Email atau password salah' });
    const user = users[0];
    if (user.status === 'banned') return res.status(403).json({ message: 'Akun Anda telah dibanned' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Email atau password salah' });
    const token = jwt.sign({ id: user.id, role: user.role, nama: user.nama },
      process.env.JWT_SECRET || 'temanbelajar_secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, nama: user.nama, email: user.email, role: user.role, jurusan: user.jurusan, semester: user.semester, avatar: user.avatar } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get profile
router.get('/me', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id,nama,email,role,jurusan,semester,bio,avatar,status,created_at FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'User tidak ditemukan' });
    const user = rows[0];
    const [matkul] = await db.query(`SELECT mk.* FROM mata_kuliah mk JOIN user_matkul um ON mk.id=um.matkul_id WHERE um.user_id=?`, [req.user.id]);
    const [jadwal] = await db.query('SELECT * FROM jadwal WHERE user_id=?', [req.user.id]);
    res.json({ ...user, matkul, jadwal });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { nama, jurusan, semester, bio, matkul_ids, jadwal } = req.body;
    await db.query('UPDATE users SET nama=?,jurusan=?,semester=?,bio=? WHERE id=?',
      [nama, jurusan, semester, bio, req.user.id]);
    if (matkul_ids) {
      await db.query('DELETE FROM user_matkul WHERE user_id=?', [req.user.id]);
      for (const mid of matkul_ids) {
        await db.query('INSERT INTO user_matkul (user_id,matkul_id) VALUES (?,?)', [req.user.id, mid]);
      }
    }
    if (jadwal) {
      await db.query('DELETE FROM jadwal WHERE user_id=?', [req.user.id]);
      for (const j of jadwal) {
        await db.query('INSERT INTO jadwal (user_id,hari,jam_mulai,jam_selesai) VALUES (?,?,?,?)',
          [req.user.id, j.hari, j.jam_mulai, j.jam_selesai]);
      }
    }
    res.json({ message: 'Profil berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
