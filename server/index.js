require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { SiweMessage } = require('siwe');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_for_demo';
const NONCES = new Map(); // key: id → { nonce, used }

app.get('/nonce', (req, res) => {
  const id = crypto.randomUUID();
  const nonce = crypto.randomBytes(16).toString('hex');
  NONCES.set(id, { nonce, used: false });

  res.json({
    id,
    nonce,
    domain: 'localhost',
    uri: 'http://localhost:3000'
  });
});

app.post('/verify', async (req, res) => {
  try {
    const { message, signature, id } = req.body;
    const entry = NONCES.get(id);
    if (!entry || entry.used) return res.status(400).json({ error: 'Invalid nonce' });

    const siwe = new SiweMessage(message);
    const result = await siwe.verify({ signature, domain: 'localhost', nonce: entry.nonce });
    if (!result.success) return res.status(401).json({ error: 'Verification failed' });

    entry.used = true;

    const token = jwt.sign(
      { sub: siwe.address.toLowerCase() },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.cookie('token', token, { httpOnly: true });
    res.json({ ok: true, address: siwe.address });
  } catch (err) {
    res.status(401).json({ error: 'Signature validation failed' });
  }
});

app.listen(5000, () => {
  console.log('Backend running at http://localhost:5000');
});
//logout route
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(200).send('Logged out');
  });
});

//This is a standard “Who am I” endpoint for session-based Ethereum authentication: it transparently tells the frontend if the current user is authenticated and what their Ethereum address is. If not authenticated, it simply responds with no address.
app.get('/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.json({ address: null });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ address: payload.sub });
  } catch (err) {
    res.json({ address: null });
  }
});

