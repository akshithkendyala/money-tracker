const fs = require('fs');
const path = require('path');

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

module.exports = async (req, res) => {
  const REST_URL = process.env.KV_REST_API_URL || process.env.REDIS_REST_URL;
  const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.REDIS_REST_TOKEN;

  if (REST_URL && REST_TOKEN) {
    // Vercel KV / Upstash Redis Cloud Database Mode
    try {
      if (req.method === 'GET') {
        const fetchUrl = `${REST_URL}/get/finance_pro_state`;
        const response = await fetch(fetchUrl, {
          headers: {
            Authorization: `Bearer ${REST_TOKEN}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Upstash returned status ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          throw new Error(`Upstash error: ${data.error}`);
        }

        if (data.result === null) {
          // Key doesn't exist yet, initialize it
          const initUrl = `${REST_URL}/set/finance_pro_state`;
          await fetch(initUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${REST_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(JSON.stringify(demoData))
          });
          return res.status(200).json(demoData);
        }

        // Return parsed JSON data
        try {
          const parsed = JSON.parse(data.result);
          return res.status(200).json(parsed);
        } catch (parseErr) {
          // If stored value isn't valid JSON, fallback to demoData
          return res.status(200).json(demoData);
        }

      } else if (req.method === 'POST') {
        const newState = req.body;
        
        if (!newState || !Array.isArray(newState.accounts) || !Array.isArray(newState.transactions)) {
          return res.status(400).json({ error: 'Invalid state structure.' });
        }

        const fetchUrl = `${REST_URL}/set/finance_pro_state`;
        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${REST_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(JSON.stringify(newState))
        });

        if (!response.ok) {
          throw new Error(`Upstash returned status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(`Upstash error: ${data.error}`);
        }

        return res.status(200).json({ success: true });
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
      }
    } catch (error) {
      console.error('Cloud Storage Error:', error);
      return res.status(500).json({ error: `Cloud storage error: ${error.message}` });
    }
  } else {
    // Local data.json file fallback mode
    const DATA_FILE = path.join(process.cwd(), 'data.json');
    
    try {
      if (req.method === 'GET') {
        if (!fs.existsSync(DATA_FILE)) {
          fs.writeFileSync(DATA_FILE, JSON.stringify(demoData, null, 2), 'utf8');
          return res.status(200).json(demoData);
        }

        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        try {
          const parsed = JSON.parse(rawData);
          return res.status(200).json(parsed);
        } catch (parseErr) {
          return res.status(500).json({ error: 'Local data file is corrupted.' });
        }

      } else if (req.method === 'POST') {
        const newState = req.body;
        if (!newState || !Array.isArray(newState.accounts) || !Array.isArray(newState.transactions)) {
          return res.status(400).json({ error: 'Invalid state structure.' });
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf8');
        return res.status(200).json({ success: true });
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
      }
    } catch (localError) {
      console.error('Local File Storage Error:', localError);
      return res.status(500).json({ error: `Local filesystem error: ${localError.message}` });
    }
  }
};
