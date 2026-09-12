# BotForge — Site de vente de bots Discord

Site complet inspiré du concept "freemyserveur.com" : boutique de bots Discord,
espace client, espace admin, **agent IA intégré** capable de modifier la
configuration d'un bot en langage naturel, et **système de webhooks**
personnalisés (Discord, Zapier, Make, n8n, serveur perso...).

## 🗂️ Structure du projet

```
discord-bot-shop/
├── backend/              → API Node.js / Express + base SQLite
│   ├── server.js         → point d'entrée
│   ├── db.js             → schéma SQLite + données de départ (seed)
│   ├── webhookSender.js  → envoi signé (HMAC) des webhooks
│   ├── middleware/auth.js→ JWT + contrôle des rôles
│   └── routes/
│       ├── auth.js       → inscription / connexion
│       ├── products.js   → catalogue public
│       ├── orders.js     → commandes + paiement (simulé)
│       ├── bots.js       → gestion des bots du client
│       ├── ai-agent.js   → agent IA (appelle l'API Anthropic)
│       ├── webhooks.js   → CRUD webhooks + test + logs
│       ├── tickets.js    → support client
│       └── admin.js      → tout l'espace admin
└── frontend/             → HTML / CSS / JS "vanilla" (aucun framework requis)
    ├── index.html        → landing page
    ├── shop.html         → boutique
    ├── login.html / register.html
    ├── dashboard.html    → espace client (onglets : bots, IA, webhooks, factures, support)
    ├── admin.html        → espace admin (stats, users, commandes, produits, logs)
    └── css/js/           → styles + logique
```

## 🚀 Installation

```bash
cd backend
npm install
cp .env.example .env
```

Ouvre `.env` et remplis au minimum :

- `JWT_SECRET` → une longue chaîne aléatoire
- `ANTHROPIC_API_KEY` → ta clé API Anthropic (console.anthropic.com) pour activer l'agent IA
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` → le compte admin créé automatiquement au premier démarrage

Puis lance le serveur :

```bash
npm start
```

Le site est accessible sur **http://localhost:3000** (frontend + API servis
par le même serveur Express).

Connecte-toi avec le compte admin défini dans `.env` pour accéder à
`/admin.html`, ou crée un compte client classique via `/register.html`.

## 🧠 Comment fonctionne l'agent IA

- Chaque bot a une configuration JSON (`bots.config_json` en base) :
  modules activés (modération, musique, leveling, agent IA), préfixe, message
  de bienvenue, liste de mots interdits, etc.
- Dans l'onglet **Agent IA** de l'espace client, le message du client est
  envoyé à `POST /api/ai/:botId/chat`, qui appelle l'API Anthropic
  (`/v1/messages`) avec un prompt système qui force une réponse JSON
  `{ reply, action }`.
- Si `action` n'est pas `null`, le client voit un bouton **"Appliquer cette
  modification"** → `POST /api/ai/:botId/apply/:messageId` qui patch la
  config réelle du bot en base, puis déclenche l'événement webhook
  `ai.action_applied`.
- Tu peux étendre le prompt système dans `backend/routes/ai-agent.js` pour
  autoriser plus d'actions (ajout de commandes personnalisées, rôles
  automatiques, etc.).

## 🔗 Comment fonctionnent les webhooks

- Un client crée un webhook (`POST /api/webhooks`) avec une URL et une liste
  d'événements à écouter : `order.paid`, `bot.created`, `bot.status_changed`,
  `bot.config_updated`, `ai.action_applied`.
- Un secret HMAC est généré automatiquement par webhook.
- À chaque événement, `webhookSender.js` envoie un `POST` JSON signé
  (`X-Signature: HMAC-SHA256(secret, body)`) vers l'URL, et enregistre le
  résultat dans `webhook_logs` (visible côté client et côté admin).
- Le client peut tester un webhook en un clic, voir les logs de livraison, et
  activer/désactiver ou supprimer un webhook.
- Pour vérifier la signature côté récepteur (exemple Node.js) :

```js
const crypto = require('crypto');
const expected = crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
if (expected !== req.headers['x-signature']) throw new Error('Signature invalide');
```

## 💳 Paiement — PayPal

Le paiement passe par **PayPal** (API REST v2, boutons PayPal JS) :

- `backend/paypal.js` gère l'authentification et les appels à l'API PayPal.
- `POST /api/orders/:id/paypal/create` crée la commande PayPal correspondante.
- `POST /api/orders/:id/paypal/capture` encaisse réellement l'argent une fois
  que le client a approuvé le paiement, puis marque la commande "paid" et
  crée le bot.
- Si `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` ne sont pas renseignés dans
  `.env`, la boutique retombe automatiquement sur un paiement simulé
  (`/api/orders/:id/simulate-payment`) pour pouvoir tester le reste du site.

Configuration détaillée (sandbox → production) : voir **DEPLOY.md**.

## 🛡️ Sécurité — points à adapter avant mise en production

- Change tous les secrets du `.env` (JWT, webhook signing).
- Ajoute une vraie limite de débit (rate limiting) sur `/api/auth/*` et
  `/api/ai/*`.
- Le token du vrai bot Discord (celui que ton bot utilise pour se connecter à
  l'API Discord) ne doit **jamais** être stocké côté client ni renvoyé par
  l'API : il doit rester uniquement dans ton infrastructure qui fait tourner
  le bot lui-même (ce site ne fait que piloter sa configuration).
- Ajoute HTTPS (reverse proxy Nginx/Caddy) devant Express en production.
- Le champ `invite_url` généré contient un `client_id` factice
  (`REMPLACE_MOI`) : mets l'ID réel de ton application Discord.

## 🎨 Personnalisation

- Couleurs et style : `frontend/css/style.css` (variables CSS en haut du
  fichier).
- Nom du site : remplace "BotForge" dans les fichiers HTML.
- Offres/produits : modifiables directement depuis l'espace admin
  (`/admin.html` → onglet Produits), ou dans le seed de `backend/db.js`.
