const express = require('express');
const path = require('path');

const app = express();
const PORT = 8000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static frontend files from current directory
app.use(express.static(__dirname));

const stateHandler = require('./api/state.js');

// Delegate API requests to the unified handler (handles local and cloud state)
app.all('/api/state', (req, res) => {
  stateHandler(req, res);
});

// Fallback to serve index.html for undefined frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start listening
app.listen(PORT, () => {
  console.log(`FinancePro Backend running at http://localhost:${PORT}`);
});
