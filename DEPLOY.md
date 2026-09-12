# 🚀 Déployer le site — et corriger l'erreur "404: NOT_FOUND" sur Vercel

## Pourquoi tu avais un 404 sur Vercel

Vercel est fait pour des sites statiques ou des fonctions serverless
(Next.js, fichiers dans `api/`, etc.). Le projet livré à l'origine était un
**serveur Express classique** (`app.listen(...)`) sans aucun fichier de
config pour Vercel : la plateforme ne savait donc pas quoi construire ni où
router les requêtes → `404: NOT_FOUND` sur toutes les pages.

J'ai ajouté ce qu'il faut pour que ça marche quand même sur Vercel (voir
option A), **mais je recommande fortement l'option B (Railway ou Render)**
pour un vrai site de vente en production. Explication ci-dessous.

---

## ⚠️ Le vrai problème de fond : SQLite + serverless

Ce projet stocke tout (utilisateurs, commandes, bots, webhooks...) dans un
fichier SQLite sur disque. Sur Vercel :

- le code tourne dans des fonctions **serverless** qui n'ont **aucun disque
  persistant** (seul `/tmp` est inscriptible, et il peut être vidé à tout
  moment — nouveau déploiement, instance "froide", etc.) ;
- résultat : tes utilisateurs, commandes et paiements PayPal capturés
  **peuvent disparaître sans prévenir**.

C'est correct pour une **démo/preview rapide**, mais **pas acceptable** pour
un site qui encaisse de vrais paiements PayPal.

---

## ✅ Option A — Déployer quand même sur Vercel (démo uniquement)

J'ai ajouté :
- `vercel.json` à la racine (route tout vers `backend/server.js`) ;
- `backend/server.js` n'appelle plus `app.listen()` sur Vercel (il exporte
  juste l'app Express, comme Vercel l'attend) ;
- `backend/db.js` utilise `/tmp/shop.db` sur Vercel automatiquement.

Étapes :
1. Pousse le dossier `discord-bot-shop/` sur un repo GitHub.
2. Sur vercel.com → "Add New Project" → importe le repo.
3. Dans **Settings → Environment Variables**, ajoute toutes les variables du
   fichier `backend/.env.example` (JWT_SECRET, ANTHROPIC_API_KEY,
   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, etc.).
4. Redéploie.

**Limite à connaître : les données ne sont pas garanties persistantes.**
N'utilise pas cette option pour de vrais clients payants sur la durée.

---

## ✅ Option B — Railway ou Render (recommandé pour la production)

Ces plateformes font tourner ton `server.js` comme un **vrai processus
toujours allumé**, avec un disque qui persiste. Aucune modification de code
nécessaire (tu peux même retirer `vercel.json`, il n'est pas gênant s'il
reste).

### Avec Railway
1. Crée un compte sur railway.app, "New Project" → "Deploy from GitHub repo".
2. Sélectionne ton repo, puis dans les paramètres du service :
   - **Root directory** : `backend`
   - **Start command** : `npm start`
3. Ajoute un **Volume** (disque persistant) monté sur `backend/data` pour
   que le fichier SQLite survive aux redéploiements.
4. Ajoute toutes les variables d'environnement (`backend/.env.example`).
5. Railway te donne une URL publique (`https://xxx.up.railway.app`).

### Avec Render
1. Crée un compte sur render.com → "New" → "Web Service" → connecte ton repo.
2. **Root directory** : `backend` — **Build command** : `npm install` —
   **Start command** : `npm start`.
3. Dans "Disks", ajoute un disque persistant monté sur `/opt/render/project/src/data`
   (adapte le chemin si besoin) pour garder la base SQLite entre les déploiements.
4. Ajoute les variables d'environnement.

### Pour aller plus loin (vraie prod à grande échelle)
Si le site grossit, remplace SQLite par une vraie base hébergée (PostgreSQL
via Neon, Supabase ou Railway Postgres) : c'est plus robuste, et ça permet
aussi de repasser sur Vercel si tu préfères, sans le problème de disque
éphémère.

---

## 💳 Configurer PayPal (obligatoire pour que les paiements fonctionnent)

1. Va sur https://developer.paypal.com/dashboard/applications
2. Crée une app en mode **Sandbox** d'abord (pour tester sans vrai argent) :
   tu obtiens un **Client ID** et un **Client Secret**.
3. Mets-les dans les variables d'environnement :
   ```
   PAYPAL_MODE=sandbox
   PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   PAYPAL_CURRENCY=EUR
   ```
4. Teste un achat sur `/shop.html` avec un compte "buyer" de test PayPal
   (créé automatiquement dans ton dashboard développeur, onglet "Sandbox
   Accounts").
5. Une fois que tout fonctionne, repasse en `PAYPAL_MODE=live` avec les
   identifiants de ton **vraie** app PayPal (pas sandbox), et vérifie que ton
   compte PayPal marchand est bien vérifié pour recevoir des paiements.

Si `PAYPAL_CLIENT_ID`/`SECRET` ne sont pas configurés, la boutique retombe
automatiquement sur un **mode démo** (paiement simulé) pour que tu puisses
continuer à tester le reste du site sans PayPal.
