# Servicios externos a instalar · Byvaro v2

Esta es la lista de servicios que hay que contratar/instalar para que Byvaro
pase de ser un diseño a una aplicación funcional en producción.

> **Orden recomendado de instalación:**
> 1. Repositorio + Vercel (ya instalado ✅)
> 2. Base de datos + Backend
> 3. Auth
> 4. Storage (fotos/videos/documentos)
> 5. Email transaccional
> 6. Error monitoring
> 7. Mapas
> 8. SMS/WhatsApp
> 9. Analytics
> 10. Pagos

## 1. Hosting · Frontend

**✅ Ya instalado: Vercel**

- URL: https://byvaro-design-armenia.vercel.app
- Auto-deploy en cada push a `main`
- Framework: Vite (detectado automáticamente)
- Rewrites para SPA: `vercel.json`

## 2. Base de datos + Backend (elegir uno)

### Opción A · Supabase (recomendado) ⭐

Postgres + Auth + Storage + Realtime + Edge Functions en **un solo servicio**,
con SDK de React oficial. El camino más rápido para MVP.

- Web: https://supabase.com
- Plan: gratuito hasta 500MB DB + 1GB storage; luego $25/mes
- Qué cubre: DB (#2), Auth (#3), Storage (#4), Realtime para notificaciones

**Setup:**
```bash
npm install @supabase/supabase-js
```

Crear proyecto en supabase.com → copiar `SUPABASE_URL` y `SUPABASE_ANON_KEY`
a `.env.local`. Ejecutar migraciones desde `supabase/migrations/`
(pendiente de crear — ver `docs/data-model.md` para el schema).

### Opción B · Neon + Vercel Functions

Si prefieres separar la DB del backend:
- **Neon** (https://neon.tech) para Postgres serverless — plan gratuito
  generoso
- **Vercel Functions** para la API (Next.js API routes o Express adapter)
- Auth con **Clerk** o **Auth.js**

### Opción C · Backend dedicado

Si esperas lógica compleja (cron jobs, workers, ML, etc.):
- **Railway** (https://railway.app) o **Render** para hosting del backend
- **NestJS** o **Fastify** como framework
- Postgres en Railway o Neon

## 3. Autenticación

Si usas **Supabase**, incluido ✓. Si no:

### Clerk (recomendado si separas)

- Web: https://clerk.com
- Flows pre-hechos: email/password, Google, Microsoft, magic link, 2FA
- Plan gratuito hasta 10k MAU
- React SDK excelente

### Alternativas

- **Auth.js** (NextAuth) — gratis, más setup
- **Auth0** — enterprise, más caro
- **Firebase Auth** — integrado con Google

**Requisitos Byvaro:**
- Email + password
- Google OAuth
- 2FA por SMS o authenticator app
- Multi-tenant (cada empresa tiene sus usuarios)
- Roles internos: owner, comercial, asistente

## 4. Almacenamiento de archivos

**Qué guardar:**
- Fotos de promociones (hasta ~30MB cada una original, se sirven variantes
  redimensionadas)
- Videos embed o self-hosted
- Documentos PDF (brochures, planos, memorias de calidades)
- Avatares de usuario y logos de agencias

Si usas **Supabase Storage**, incluido ✓. Si no:

### Cloudflare R2 (recomendado por precio) ⭐

- Web: https://www.cloudflare.com/products/r2/
- S3-compatible, **sin egress fees** (único!)
- $0.015/GB/mes
- Integración con **Cloudflare Images** para resize on-the-fly

### AWS S3 + CloudFront

Estándar. Más complejo de configurar, más caro por egress.

### UploadThing

Si quieres upload UX pre-hecho: https://uploadthing.com

## 5. Email transaccional + marketing

### Resend (recomendado para transaccional) ⭐

- Web: https://resend.com
- 3.000 emails/mes gratis
- React Email templates integrados
- DX excelente

**Uso:** confirmaciones de registro, aprobaciones, visitas, reset password.

### Postmark

- Más enterprise, mejor deliverability
- $10/mes

### SendGrid / Mailgun

Para volumen alto + campañas masivas.

**Plantillas que se necesitarán** (ver `/emails`):
- Confirmación de registro
- Solicitud recibida (promotor)
- Registro aprobado / rechazado (agencia + cliente)
- Visita confirmada / reprogramada
- Reserva recibida
- Boletín de nuevas promociones

Recomendación: **React Email** (https://react.email) para escribir plantillas
con JSX.

## 6. Monitoreo de errores

### Sentry ⭐

- Web: https://sentry.io
- Plan gratuito hasta 5k errores/mes
- React + Node SDK
- Source maps automáticos con Vite

```bash
npm install @sentry/react @sentry/vite-plugin
```

## 7. Mapas / Geolocalización

Byvaro muestra ubicación de promociones y oficinas de venta en mapas.

### MapBox (recomendado por estética) ⭐

- Web: https://mapbox.com
- 50.000 cargas/mes gratis
- Estilo más limpio que Google
- `react-map-gl` como SDK

### Google Maps Platform

- Más features (Street View, direcciones, Places API)
- $200 de crédito mensual gratis

### OpenStreetMap + Leaflet

- 100% gratis, pero menos bonito

## 8. SMS / WhatsApp

Para confirmaciones automáticas de visitas al cliente.

### Twilio ⭐

- Web: https://twilio.com
- SMS + WhatsApp Business API + Voice
- Pay-as-you-go (~$0.02-0.05 por mensaje)

### MessageBird

Alternativa europea con buenos precios.

## 9. Analytics

### Plausible (recomendado, privacy-first) ⭐

- Web: https://plausible.io
- Sin cookies, GDPR-ready
- $9/mes
- Scripts ligeros

### PostHog

Product analytics más profundos (funnels, session replay, A/B).

### Google Analytics 4

Gratis, ubicuo, pero pesado y con privacy issues.

## 10. Pagos (Fase posterior)

Para pagar comisiones a agencias automáticamente.

### Stripe Connect ⭐

- Web: https://stripe.com/connect
- Onboarding de agencias como "connected accounts"
- Split payments automáticos
- Fee: 0.25% + $0.25 por payout

**Flujo Byvaro:**
1. Cliente paga al promotor (fuera de Byvaro, normalmente banco)
2. Promotor marca venta como cobrada
3. Byvaro calcula comisión debida a agencia X
4. Al final de mes, Stripe Connect transfiere automáticamente

## 11. CI/CD

### GitHub Actions

- Ya configurado `.github/workflows/deploy.yml` (actualmente para Pages;
  se puede retirar si Vercel es el canal principal)
- Plan: añadir workflow para **lint + typecheck + tests** en cada PR

## 12. Dominios + DNS

- Comprar `byvaro.com` o similar en **Namecheap** / **Cloudflare Registrar**
- Conectar a Vercel vía CNAME / apex ALIAS
- Configurar subdominios para microsites: `*.byvaro.app` → Vercel

## Variables de entorno esperadas

Al final, el `.env.local` se parecerá a esto:

```bash
# Supabase (o alternativa)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Storage
VITE_R2_BUCKET_URL=           # opcional si no usas Supabase Storage

# Email
RESEND_API_KEY=               # backend only

# SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Mapas
VITE_MAPBOX_TOKEN=

# Monitoring
VITE_SENTRY_DSN=

# Analytics
VITE_PLAUSIBLE_DOMAIN=

# Pagos (posterior)
STRIPE_SECRET_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```

## Coste estimado mensual (plan mínimo)

| Servicio | Plan | Coste |
|---|---|---|
| Vercel | Hobby | $0 |
| Supabase | Pro | $25 |
| Cloudflare R2 | 50GB | ~$0.75 |
| Resend | Pro | $20 |
| Sentry | Developer | $0 (free tier) |
| MapBox | Free tier | $0 |
| Twilio | Pay-as-you-go | ~$5 (uso bajo) |
| Plausible | Growth | $9 |
| Dominio | .com | ~$1 |
| **Total** | | **~$60/mes** |

En producción con miles de usuarios: 200-500€/mes dependiendo del volumen.
