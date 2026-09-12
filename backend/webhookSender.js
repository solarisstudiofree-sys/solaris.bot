const crypto = require('crypto');
const fetch = require('node-fetch');
const db = require('./db');

/**
 * Déclenche l'événement `event` pour l'utilisateur `userId` :
 * envoie le payload à tous ses webhooks actifs qui écoutent cet événement.
 * Chaque requête est signée en HMAC-SHA256 (header X-Signature) pour que
 * le récepteur puisse vérifier l'authenticité (comme Stripe/Discord).
 */
async function triggerWebhooks(userId, event, data) {
  const webhooks = db
    .prepare('SELECT * FROM webhooks WHERE user_id = ? AND active = 1')
    .all(userId)
    .filter((w) => JSON.parse(w.events_json).includes(event));

  const payload = {
    event,
    data,
    timestamp: new Date().toISOString()
  };
  const body = JSON.stringify(payload);

  const results = await Promise.all(
    webhooks.map(async (webhook) => {
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(body)
        .digest('hex');

      let status = null;
      let success = 0;
      try {
        const res = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Signature': signature,
            'X-Event': event,
            'User-Agent': 'DiscordBotShop-Webhooks/1.0'
          },
          body,
          timeout: 8000
        });
        status = res.status;
        success = res.ok ? 1 : 0;
      } catch (err) {
        status = 0;
        success = 0;
      }

      db.prepare(`
        INSERT INTO webhook_logs (webhook_id, event, payload_json, response_status, success)
        VALUES (?, ?, ?, ?, ?)
      `).run(webhook.id, event, body, status, success);

      return { webhookId: webhook.id, status, success };
    })
  );

  return results;
}

module.exports = { triggerWebhooks };
