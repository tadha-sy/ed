const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/partner', require('./routes/partner'));
app.use('/api/chat',    require('./routes/chat'));
app.use('/api/admin',   require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', app: 'TemanBelajar' }));

// Fallback ke frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`\n🚀 TemanBelajar API: http://localhost:${PORT}\n`));
}

module.exports = app;
