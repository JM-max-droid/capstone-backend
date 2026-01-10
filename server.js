// server.js
const app = require('./app');
const http = require('http');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Start server
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});