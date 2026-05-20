CREATE DATABASE IF NOT EXISTS temanbelajar;
USE temanbelajar;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('mahasiswa','admin') DEFAULT 'mahasiswa',
  jurusan VARCHAR(100),
  semester INT,
  bio TEXT,
  avatar VARCHAR(255),
  status ENUM('aktif','nonaktif','banned') DEFAULT 'aktif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mata_kuliah (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  kode VARCHAR(20),
  jurusan VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS user_matkul (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  matkul_id INT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (matkul_id) REFERENCES mata_kuliah(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS jadwal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  hari ENUM('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'),
  jam_mulai TIME,
  jam_selesai TIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS partner_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pengirim_id INT,
  penerima_id INT,
  pesan TEXT,
  status ENUM('pending','diterima','ditolak') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pengirim_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (penerima_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100),
  request_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES partner_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS room_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT,
  user_id INT,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT,
  user_id INT,
  isi TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS jadwal_bersama (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT,
  judul VARCHAR(100),
  tanggal DATE,
  jam_mulai TIME,
  jam_selesai TIME,
  lokasi VARCHAR(200),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS laporan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pelapor_id INT,
  terlapor_id INT,
  alasan TEXT,
  status ENUM('pending','diproses','selesai') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pelapor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (terlapor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed admin
INSERT IGNORE INTO users (nama, email, password, role) VALUES
('Admin TemanBelajar', 'admin@temanbelajar.id', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Seed mata kuliah
INSERT IGNORE INTO mata_kuliah (nama, kode, jurusan) VALUES
('Algoritma & Pemrograman', 'TI101', 'Teknik Informatika'),
('Struktur Data', 'TI102', 'Teknik Informatika'),
('Basis Data', 'TI103', 'Teknik Informatika'),
('Jaringan Komputer', 'TI201', 'Teknik Informatika'),
('Rekayasa Perangkat Lunak', 'TI202', 'Teknik Informatika'),
('Kalkulus', 'MA101', 'Matematika'),
('Aljabar Linear', 'MA102', 'Matematika'),
('Statistika', 'MA201', 'Matematika'),
('Akuntansi Dasar', 'AK101', 'Akuntansi'),
('Manajemen Keuangan', 'AK201', 'Akuntansi');
