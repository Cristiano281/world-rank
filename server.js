// World Rank — backend
// Handles: listing projects, creating a PayPal order, capturing payment,
// and only THEN writing the paid amount to the ranking (never trust the browser).

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const paypal = require('@paypal/checkout-server-sdk');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'projects.json');

// ---------- PayPal client ----------
// Set these as environment variables (see .env.example / README).
// Use paypal.core.LiveEnvironment for production, Sandbox for testing.
function payPalClient() {
  const env = process.env.PAYPAL_ENV === 'live'
    ? new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
    : new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
  return new paypal.core.PayPalHttpClient(env);
}

// ---------- tiny JSON "database" ----------
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    // Starts empty — the first project submitted becomes #1 automatically.
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ---------- routes ----------

// List all projects, ranked by amount paid
app.get('/api/projects', (req, res) => {
  const projects = readDB().sort((a, b) => b.amount - a.amount);
  res.json(projects);
});

// Step 1: create a PayPal order for a given amount (USD)
app.post('/api/orders', async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{ amount: { currency_code: 'USD', value: amount.toFixed(2) } }]
  });

  try {
    const order = await payPalClient().execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create PayPal order' });
  }
});

// Step 2: capture the order once the user approves it in the PayPal popup,
// then (and only then) write the paid amount to the project.
app.post('/api/orders/:orderID/capture', async (req, res) => {
  const { orderID } = req.params;
  const { projectId, name, desc, link, email, amount } = req.body;

  const request = new paypal.orders.OrdersCaptureRequest(orderID);
  request.requestBody({});

  try {
    const capture = await payPalClient().execute(request);
    const status = capture.result.status;
    if (status !== 'COMPLETED') {
      return res.status(400).json({ error: `Payment not completed (status: ${status})` });
    }

    const paidAmount = parseFloat(
      capture.result.purchase_units[0].payments.captures[0].amount.value
    );

    const projects = readDB();

    // Try to match an existing project either by explicit id (boost button)
    // or by name (so repeat donations to "Heritage Watch" add up instead of
    // creating duplicate entries).
    let p = projectId
      ? projects.find(p => p.id === projectId)
      : projects.find(p => p.name.trim().toLowerCase() === (name || '').trim().toLowerCase());

    if (p) {
      p.amount += paidAmount;
      if (email) {
        p.waitlistEmails = p.waitlistEmails || [];
        if (!p.waitlistEmails.includes(email)) p.waitlistEmails.push(email);
      }
    } else {
      projects.push({
        id: Date.now().toString(),
        name: (name || 'Untitled project').slice(0, 60),
        desc: (desc || '').slice(0, 400),
        link: link || '',
        image: req.body.image || '',
        amount: paidAmount,
        waitlistEmails: email ? [email] : []
      });
    }

    writeDB(projects);
    res.json({ ok: true, projects: projects.sort((a, b) => b.amount - a.amount) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not capture PayPal payment' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`World Rank server running on port ${PORT}`));
