# Control de Finanzas

App web para registrar gastos, ingresos, reembolsos y ahorros. Pensada para el día a día en Argentina: la usás en la computadora o en el celular, con la misma cuenta de Google, y los datos se sincronizan.

**Probar la app:** [https://control-de-finanzas-six.vercel.app](https://control-de-finanzas-six.vercel.app)

Entrá con Google. En el celular, abrí el mismo link y agregala a la pantalla de inicio para usarla como app.

---

## Qué hace

- Carga gastos, ingresos, reembolsos y ahorros, con categorías
- Muestra balance, gráficos y un análisis del período
- Permite movimientos recurrentes (por ejemplo, un alquiler todos los meses)
- Exporta a CSV o Excel
- Puede vincular Mercado Pago y sincronizar con Google Sheets
- Incluye un asistente de IA para consultar tus números
- Modo claro y oscuro

Cada persona ve **solo sus** datos. Si compartís el link, quien entre usa su propia cuenta de Google.

---

## Cómo usarla

1. Abrí [la app en Vercel](https://control-de-finanzas-six.vercel.app).
2. Iniciá sesión con Google.
3. Cargá un movimiento. Al recargar la página, tiene que seguir ahí.

**En el iPhone:** Safari → Compartir → Agregar a inicio.  
**En Android:** Chrome → menú ⋮ → Agregar a pantalla de inicio.

---

## Stack

React, Vite, Firebase (Authentication + Firestore) y Vercel. En local puede guardar en un archivo JSON, sin Google.

---

## Correrla en tu máquina

Hace falta Node.js 22 o más.

```bash
git clone https://github.com/nicolaslestard1-debug/control-de-finanzas.git
cd control-de-finanzas
npm install
cp .env.example .env
npm run dev
```

Abrí la URL que muestre la terminal (por ejemplo `http://localhost:3000`).

### Variables de entorno

En `.env`:

```bash
APP_URL=http://localhost:3000
GEMINI_API_KEY=
MP_CLIENT_ID=
MP_CLIENT_SECRET=
```

- `GEMINI_API_KEY`: para el asistente. Se crea en [Google AI Studio](https://aistudio.google.com/apikey).
- `MP_CLIENT_ID` / `MP_CLIENT_SECRET`: solo si vas a conectar Mercado Pago.

Para que el login de Google y el guardado en la nube funcionen en producción, hay que configurar un proyecto de Firebase (Authentication con Google y Firestore) y desplegar, por ejemplo en Vercel.

---

Hecha a partir de un export de Google AI Studio.
