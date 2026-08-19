import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const emptyStore = () => ({
  transactions: {},
  customCategories: { expense: [], income: [], refund: [], saving: [] },
  recurring: {},
  sheets: null,
});

const dataDir = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'finanzas.json');

async function readStore() {
  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    return { ...emptyStore(), ...JSON.parse(raw) };
  } catch {
    return emptyStore();
  }
}

async function writeStore(data: unknown) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8');
}

function lanUrls(port: number) {
  const urls = [`http://localhost:${port}`];
  try {
    const nets = os.networkInterfaces();
    for (const addrs of Object.values(nets)) {
      for (const addr of addrs || []) {
        const family = addr.family === 4 || addr.family === 'IPv4';
        if (family && !addr.internal) {
          urls.push(`http://${addr.address}:${port}`);
        }
      }
    }
  } catch {
    // Sandbox or OS may block interface enumeration.
  }
  return urls;
}

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/info', (req, res) => {
    res.json({ port: PORT, urls: lanUrls(PORT) });
  });

  app.get('/api/data', async (_req, res) => {
    res.json(await readStore());
  });

  app.put('/api/data', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : emptyStore();
    await writeStore({ ...emptyStore(), ...body });
    res.json({ ok: true });
  });

  // 1. Endpoint to get the Mercado Pago OAuth URL
  app.get('/api/auth/mp/url', (req, res) => {
    const baseUrl = process.env.APP_URL ? process.env.APP_URL.trim() : `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/api/auth/mp/callback`;
    const clientId = process.env.MP_CLIENT_ID ? process.env.MP_CLIENT_ID.trim() : '';
    
    if (!clientId) {
      return res.status(500).json({ error: 'MP_CLIENT_ID is not configured' });
    }
    
    // Construct the OAuth provider's authorization URL
    const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    res.json({ url: authUrl });
  });

  // 2. Callback endpoint to handle the redirect from Mercado Pago
  app.get(['/api/auth/mp/callback', '/api/auth/mp/callback/'], async (req, res) => {
    const { code } = req.query;
    const baseUrl = process.env.APP_URL ? process.env.APP_URL.trim() : `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/api/auth/mp/callback`;
    
    try {
      const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          client_id: process.env.MP_CLIENT_ID ? process.env.MP_CLIENT_ID.trim() : '',
          client_secret: process.env.MP_CLIENT_SECRET ? process.env.MP_CLIENT_SECRET.trim() : '',
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: redirectUri
        })
      });

      const data = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('MP Token Error:', data);
        throw new Error(data.message || 'Failed to get token');
      }

      // Send success message to parent window and close popup
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  token: '${data.access_token}',
                  refresh_token: '${data.refresh_token}'
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Autenticación exitosa. Esta ventana se cerrará automáticamente.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.send(`
        <html>
          <body>
            <p>Error en la autenticación. Por favor, cierra esta ventana e intenta de nuevo.</p>
          </body>
        </html>
      `);
    }
  });

  // 3. Endpoint to fetch recent payments from Mercado Pago
  app.post('/api/mp/transactions', async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    try {
      // Fetch user info to determine payer vs collector
      const userResponse = await fetch('https://api.mercadopago.com/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      let mpUserId = null;
      if (userResponse.ok) {
        const userData = await userResponse.json();
        mpUserId = userData.id;
      }

      // Fetch recent payments (last 50)
      const response = await fetch('https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      res.json({ ...data, mpUserId });
    } catch (error) {
      console.error('Error fetching MP transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const urls = lanUrls(PORT);
    console.log(`Server running on ${urls.join(' | ')}`);
  });
}

startServer();
