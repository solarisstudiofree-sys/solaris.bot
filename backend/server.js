require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db'); // initialise la base + seed au démarrage

const app = express();
app.use(cors());
app.use(express.json());

// --- API ---------------------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/bots', require('./routes/bots'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/ai', require('./routes/ai-agent'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/config', require('./routes/config'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- Frontend statique ---------------------------------------------------
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Fallback pour les routes "front" simples (pas une vraie SPA, juste au cas où)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
    if (err) next(err);
  });
});

const PORT = process.env.PORT || 3000;

// Sur Vercel (ou tout environnement serverless), on n'appelle jamais listen()
// : la plateforme importe directement `app` et l'utilise comme handler de
// requêtes. En local / sur un vrai serveur (Railway, Render, VPS...), on
// démarre normalement.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
  });
}

module.exports = app;
