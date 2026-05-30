const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static frontend files from current directory
app.use(express.static(__dirname));

// Default demo data structure (empty starter)
const demoData = {
  accounts: [
    { id: 'acc-1', name: 'SBI Savings', type: 'Savings', balance: 0 },
    { id: 'acc-2', name: 'HDFC Bank', type: 'Salary', balance: 0 },
    { id: 'acc-3', name: 'Cash Wallet', type: 'Cash', balance: 0 }
  ],
  transactions: [],
  budgets: [],
  goals: []
};

// GET /api/state: Reads state from data.json or returns default data
app.get('/api/state', (req, res) => {
  fs.readFile(DATA_FILE, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File doesn't exist yet, save and return default data
        fs.writeFile(DATA_FILE, JSON.stringify(demoData, null, 2), 'utf8', (writeErr) => {
          if (writeErr) {
            console.error('Error creating default data file:', writeErr);
            return res.status(500).json({ error: 'Failed to create default data storage.' });
          }
          console.log('Created default data.json file.');
          return res.json(demoData);
        });
      } else {
        console.error('Error reading data file:', err);
        return res.status(500).json({ error: 'Failed to read data storage.' });
      }
    } else {
      try {
        const stateData = JSON.parse(data);
        return res.json(stateData);
      } catch (parseErr) {
        console.error('Error parsing data file:', parseErr);
        return res.status(500).json({ error: 'Data file corruption detected.' });
      }
    }
  });
});

// POST /api/state: Writes state changes to data.json
app.post('/api/state', (req, res) => {
  const newState = req.body;

  // Simple validation to ensure valid schema
  if (!newState || !Array.isArray(newState.accounts) || !Array.isArray(newState.transactions)) {
    return res.status(400).json({ error: 'Invalid state structure.' });
  }

  fs.writeFile(DATA_FILE, JSON.stringify(newState, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error writing data file:', err);
      return res.status(500).json({ error: 'Failed to write data changes.' });
    }
    console.log('Successfully persisted updated financial state to data.json.');
    return res.json({ success: true });
  });
});

// Fallback to serve index.html for undefined frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start listening
app.listen(PORT, () => {
  console.log(`FinancePro Backend running at http://localhost:${PORT}`);
});
