# Control de Finanzas

App local exportada de Google AI Studio.

## Requisitos

- Node.js 22+

## Cómo correrla

```bash
cd ~/control-de-finanzas
npm install
npm run dev
```

Abrí [http://localhost:3003](http://localhost:3003) (o el puerto que muestre la terminal).

## Variables de entorno

Copiá `.env.example` a `.env` y `.env.local`:

```bash
APP_URL=http://localhost:3000
GEMINI_API_KEY=
MP_CLIENT_ID=
MP_CLIENT_SECRET=
```

- `GEMINI_API_KEY`: hace falta para el asistente de IA. Creala en [Google AI Studio](https://aistudio.google.com/apikey).
- `MP_CLIENT_ID` / `MP_CLIENT_SECRET`: solo si vas a conectar Mercado Pago.
