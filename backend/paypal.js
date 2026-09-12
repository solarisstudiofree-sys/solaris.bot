const fetch = require('node-fetch');

const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Impossible de récupérer le token PayPal');
  return data.access_token;
}

// Crée une commande PayPal pour le montant donné (EUR par défaut)
async function createPaypalOrder(amount, currency = 'EUR') {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: Number(amount).toFixed(2)
          }
        }
      ]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur lors de la création de la commande PayPal');
  return data; // contient data.id = l'identifiant de commande PayPal
}

// Capture (encaisse) une commande PayPal préalablement approuvée par le client
async function capturePaypalOrder(paypalOrderId) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur lors de la capture du paiement PayPal');
  return data; // data.status === 'COMPLETED' si le paiement a réussi
}

function isConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

module.exports = { createPaypalOrder, capturePaypalOrder, isConfigured };
