const express = require('express');
const cors = require('cors');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Llaves VAPID (puedes sobreescribirlas con variables de entorno en Render)
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BLwUCzkpVfEoRPwx4Grt2gW6nHEwzdQhkY77zGr8S2Q0YatZjHNvn5yUrsrdamIHsOgwLp0nUCmc4LgMd13urXs';
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'pe5uSQNoIxsKMVk89_uDOWRjGnY1nrn5hlDo-22W_Tc';

webpush.setVapidDetails(
  'mailto:rafael.lopez@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Almacenamiento en memoria de suscripciones activas
const subscriptions = new Map();

app.get('/api', (_req, res) => {
  res.json({ ok: true, service: 'webpush-server', subscriptions: subscriptions.size });
});

app.get('/api/public-key', (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Suscripción inválida' });
  }
  subscriptions.set(subscription.endpoint, subscription);
  console.log(`Nueva suscripción registrada. Total: ${subscriptions.size}`);
  res.status(201).json({ ok: true, total: subscriptions.size });
});

app.post('/api/push', async (req, res) => {
  const { title = 'Notificación', body = '' } = req.body || {};

  // Formato requerido por Angular SwPush (ngsw-worker.js)
  const payload = JSON.stringify({
    notification: {
      title,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
      },
    },
  });

  let enviadas = 0;
  const expiredEndpoints = [];

  await Promise.all(
    Array.from(subscriptions.entries()).map(async ([endpoint, sub]) => {
      try {
        await webpush.sendNotification(sub, payload);
        enviadas++;
      } catch (err) {
        console.error('Error enviando push:', err.statusCode || err.message);
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredEndpoints.push(endpoint);
        }
      }
    })
  );

  for (const endpoint of expiredEndpoints) {
    subscriptions.delete(endpoint);
  }

  res.json({ enviadas });
});

app.listen(PORT, () => {
  console.log(`Servidor Push corriendo en http://localhost:${PORT}/api`);
});
