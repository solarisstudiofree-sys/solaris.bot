const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Sur Vercel (environnement serverless), seul /tmp est inscriptible et les
// fichiers n'y sont PAS garantis persistants entre deux invocations : c'est
// acceptable pour une démo/preview, mais PAS pour de la vraie production
// (les données peuvent disparaître à tout moment). Voir DEPLOY.md.
const dbPath = process.env.VERCEL
  ? '/tmp/shop.db'
  : path.join(__dirname, 'data', 'shop.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ---------------------------------------------------------------------------
// SCHEMA
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client', -- 'client' | 'admin'
  banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  features_json TEXT NOT NULL DEFAULT '[]',
  popular INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | refunded | cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS bots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  invite_url TEXT NOT NULL DEFAULT '',
  prefix TEXT NOT NULL DEFAULT '!',
  status TEXT NOT NULL DEFAULT 'offline', -- online | offline | restarting
  config_json TEXT NOT NULL DEFAULT '{"modules":{"moderation":true,"music":false,"leveling":false,"ai_agent":true},"banned_words":[],"welcome_message":"Bienvenue {user} sur le serveur !"}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT 'Mon webhook',
  url TEXT NOT NULL,
  events_json TEXT NOT NULL DEFAULT '[]', -- ex: ["order.paid","bot.status_changed","ai.action_applied"]
  secret TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  response_status INTEGER,
  success INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(webhook_id) REFERENCES webhooks(id)
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  bot_id INTEGER NOT NULL,
  role TEXT NOT NULL, -- user | assistant
  content TEXT NOT NULL,
  action_json TEXT, -- action proposée par l'IA (patch de config), NULL si aucune
  applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(bot_id) REFERENCES bots(id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | answered | closed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  sender TEXT NOT NULL, -- 'client' | 'admin'
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(ticket_id) REFERENCES tickets(id)
);
`);

// ---------------------------------------------------------------------------
// SEED (produits par défaut + compte admin)
// ---------------------------------------------------------------------------
function seed() {
  const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (productCount === 0) {
    const insert = db.prepare(`
      INSERT INTO products (slug, name, description, price, features_json, popular)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      'starter',
      'Starter',
      'Idéal pour découvrir et lancer un premier serveur.',
      4.99,
      JSON.stringify([
        'Modération automatique (anti-spam, mots interdits)',
        'Messages de bienvenue personnalisés',
        'Support par ticket',
        '1 serveur Discord'
      ]),
      0
    );
    insert.run(
      'pro',
      'Pro',
      "L'offre la plus populaire : bot complet + agent IA intégré.",
      14.99,
      JSON.stringify([
        'Tout Starter',
        'Agent IA intégré (peut modifier la config du bot sur demande)',
        'Musique, leveling, économie virtuelle',
        'Jusqu\'à 3 serveurs Discord',
        'Webhooks illimités (Discord, Zapier, Make, custom)'
      ]),
      1
    );
    insert.run(
      'ultimate',
      'Ultimate',
      'Pour les gros serveurs et les créateurs de communauté.',
      29.99,
      JSON.stringify([
        'Tout Pro',
        'Serveurs Discord illimités',
        'Agent IA avancé (auto-modération intelligente, résumés de salons)',
        'Support prioritaire 24/7',
        'Accès anticipé aux nouvelles fonctionnalités'
      ]),
      0
    );
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@monsite.com';
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
    db.prepare(`
      INSERT INTO users (email, username, password_hash, role)
      VALUES (?, 'Admin', ?, 'admin')
    `).run(adminEmail, hash);
    console.log(`[seed] Compte admin créé : ${adminEmail}`);
  }
}
seed();

module.exports = db;
