require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const app = require('../backend/server');
module.exports = app;
