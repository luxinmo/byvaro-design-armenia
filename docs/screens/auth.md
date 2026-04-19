# Pantallas · Auth (`/login` + `/register`)

## Propósito

Autenticación de la plataforma Byvaro. Cubre las dos puertas de entrada
públicas:

- **Login** (`/login`) — usuarios existentes recuperan sesión.
- **Register** (`/register`) — usuarios nuevos crean cuenta.

Ambas pantallas son **fullscreen** (fuera de `AppLayout`) porque no
forman parte del shell de app (no tienen sidebar ni topbar); se
registran en `src/App.tsx` junto a `/crear-promocion`.

El diseño es un **split layout**:
- Izquierda: form en `rounded-2xl bg-card border border-border shadow-soft-lg`,
  con `max-w-md`, logo Byvaro arriba y footer con copyright.
- Derecha (solo `lg+`): hero con gradiente
  `bg-gradient-to-br from-primary/10 via-muted/30 to-primary/5`, lema de
  marca y features/stats. En móvil queda oculto.

**Audiencia**: cualquier visitante de la web. Post-login el sistema
decide si enviar al dashboard (`/inicio`) o al onboarding.

## Layout

```
LOGIN (≥ lg)
┌─────────────────────────────┬───────────────────────────┐
│ [B] Byvaro                  │                           │
│                             │   "Nueva plataforma"      │
│       ┌──────────────────┐  │                           │
│       │ Inicia sesión    │  │   Convierte tus          │
│       │ Accede a tu...   │  │   promociones en...       │
│       │                  │  │                           │
│       │ Email   [   ]    │  │   • KPIs con insights    │
│       │ Pass    [   ]    │  │   • Colaboración agencia │
│       │ [x] Recuérdame   │  │   • Microsite 1-click    │
│       │ [ Iniciar sesión]│  │                           │
│       │ ── o continúa ── │  │                           │
│       │ [Google][Microsoft] │                           │
│       └──────────────────┘  │                           │
│       ¿No tienes? Regístrate│                           │
│                             │                           │
│ © Byvaro                    │                           │
└─────────────────────────────┴───────────────────────────┘

REGISTER (≥ lg): idéntico split; form con 5 campos + ToS + CTA.
```

En móvil (< 640px) solo se ve la columna izquierda. El panel interno
cambia a `p-6` en lugar de `p-8`.

## Componentes (internos a cada `.tsx`)

| Nombre | Pantalla | Rol |
|---|---|---|
| `OAuthButton` | Login | Botón secundario "Continuar con Google/Microsoft" (solo visual) |
| `GlyphFor` | Login | SVG inline minimalista para Google/Microsoft (sustituir por logos oficiales en prod) |
| `HeroFeature` | Login | Item de la lista del panel derecho |
| `Field` | Register | Wrapper de label + input con icono a la izq y mensaje de error debajo |
| `StatCard` | Register | Tarjeta "+40% visitas calificadas" del hero |
| `scorePassword` | Register | Heurística de fuerza de contraseña (4 reglas) |

## Flujos

### Login · éxito
1. Usuario rellena email + password válidos → CTA habilitado.
2. Click en "Iniciar sesión" → `submitting=true`, CTA muestra
   "Entrando…" con spinner.
3. `POST /api/v1/auth/login` (hoy mockeado con `setTimeout(600)`).
4. Toast verde "Bienvenido de nuevo · Sesión iniciada correctamente."
5. `navigate("/inicio", { replace: true })`.

### Login · error
Casos:
- **Email inválido** → mensaje inline debajo del input + banner rojo al
  intentar submit.
- **Password < 6** → CTA deshabilitado; si fuerza submit, banner rojo.
- **Credenciales incorrectas** (solo con backend) → banner rojo
  "Email o contraseña incorrectos."
- **Rate-limit** (backend) → banner "Demasiados intentos. Prueba en X min."

### Register · éxito
1. Usuario rellena nombre, email, password (≥8), confirmación, acepta ToS.
2. Click en "Crear cuenta gratis" → `submitting=true`.
3. `POST /api/v1/auth/register` (hoy mockeado con `setTimeout(700)`).
4. Toast verde "Cuenta creada · Te hemos enviado un email de verificación."
5. `navigate("/inicio", { replace: true })`. **TODO**: cuando exista
   `/onboarding`, redirigir ahí en su lugar.

### Register · error
- **Nombre < 2 chars** → banner "Escribe tu nombre completo."
- **Email inválido** → inline + banner.
- **Password < 8** → banner + meter en "Muy débil/Débil".
- **Passwords no coinciden** → mensaje inline bajo "Confirmar" + banner.
- **ToS no aceptado** → banner.
- **Email ya registrado** (backend) → banner "Este email ya tiene
  cuenta. ¿Querías iniciar sesión?" con link a `/login`.

## Estados visuales

| Estado | Login | Register |
|---|---|---|
| `idle` | Form editable, CTA habilitado si email válido + pass ≥ 6 | Form editable, CTA habilitado si todos los requisitos mínimos |
| `loading` | Inputs deshabilitados, CTA con spinner "Entrando…" | Inputs deshabilitados, CTA con spinner "Creando cuenta…" |
| `error` | Banner rojo arriba (`role="alert"`) | Banner rojo arriba + errores inline por campo |
| `success` | Toast + redirect | Toast + redirect |

## Campos y validaciones

### Login

| Campo | Tipo | Required | Validación cliente |
|---|---|---|---|
| email | email | ✅ | formato `x@y.z` (regex laxa) |
| password | password | ✅ | longitud ≥ 6 |
| remember | checkbox | ⬜ | — (default `true`) |

### Register

| Campo | Tipo | Required | Validación cliente |
|---|---|---|---|
| name | text | ✅ | `trim().length >= 2` |
| email | email | ✅ | formato `x@y.z` |
| company | text | ⬜ | libre (opcional) |
| password | password | ✅ | longitud ≥ 8 |
| confirm | password | ✅ | `=== password` |
| acceptTos | checkbox | ✅ | debe estar marcado |

**Password strength meter** (Register): 4 heurísticas — ≥8 chars,
mayúscula, número, símbolo. Pinta 4 barras (destructive → amber →
primary → emerald).

## API endpoints esperados

```
POST /api/v1/auth/login
Request:
{
  "email": "ana@empresa.com",
  "password": "********",
  "remember": true
}
Response 200:
{
  "user": { "id": "usr_...", "name": "Ana", "email": "...", "role": "promoter" },
  "session": { "token": "...", "expiresAt": "2026-05-19T..." }
}
Response 401: { "error": "invalid_credentials" }
Response 429: { "error": "rate_limited", "retryAfterSec": 180 }
```

```
POST /api/v1/auth/register
Request:
{
  "name": "Ana Gómez",
  "email": "ana@empresa.com",
  "company": "Luxinmo",            // opcional
  "password": "********"
}
Response 201:
{
  "user": { "id": "usr_...", "email": "...", "verified": false },
  "session": { "token": "...", "expiresAt": "..." },
  "onboarding": { "required": true, "nextStep": "role" }
}
Response 409: { "error": "email_exists" }
Response 422: { "error": "weak_password" | "invalid_email" }
```

```
POST /api/v1/auth/logout                    // TODO(backend)
POST /api/v1/auth/forgot-password           // TODO(backend) — ver ForgotPassword
POST /api/v1/auth/reset-password            // TODO(backend) — ver ResetPassword
POST /api/v1/auth/verify-email              // TODO(backend) — ver VerifyCode
GET  /api/v1/auth/oauth/google              // TODO(backend) — redirect OAuth
GET  /api/v1/auth/oauth/microsoft           // TODO(backend) — redirect OAuth
```

## Consideraciones de seguridad

- **CSRF**: endpoints POST deben usar token CSRF sincronizado con la
  sesión (si el token de sesión vive en cookie httpOnly).
- **Rate limit**: 5 intentos por IP + email cada 15 min en login. 3
  registros por IP/hora para prevenir scraping de emails.
- **Passwords**: hash con bcrypt (cost ≥12) o argon2id en el backend.
  Nunca se loggea la contraseña cliente.
- **Transport**: forzar HTTPS; cookie de sesión con `Secure`, `HttpOnly`,
  `SameSite=Lax`.
- **Password leak detection** (opcional): chequeo HIBP k-anonymity en
  registro para avisar si la contraseña ha estado filtrada.
- **Email enumeration**: la respuesta a `forgot-password` debe ser
  idéntica exista o no el email, para no filtrar usuarios.
- **Autocomplete**: usamos `autoComplete="current-password"` en login y
  `new-password` en register para guiar a password managers.

## Enlaces salientes

| Desde | Hacia |
|---|---|
| Login · "Olvidé mi contraseña" | `/forgot-password` |
| Login · "Regístrate gratis" | `/register` |
| Login · logo / footer | `/` (redirige a `/inicio` si sesión viva) |
| Login · submit éxito | `/inicio` |
| Register · "Inicia sesión" | `/login` |
| Register · submit éxito | `/inicio` (TODO: `/onboarding` cuando exista) |
| Register · "Términos" / "Privacidad" | `/legal/terms`, `/legal/privacy` (TODO) |

## Relación con otras pantallas

- **Onboarding** (`/onboarding`, pendiente): pantalla post-registro para
  seleccionar rol (Promotor / Agencia / Propietario) y crear la primera
  empresa. El campo `company` de Register es opcional precisamente
  porque el onboarding lo pedirá con más contexto.
- **Forgot / Reset / Verify** (pendientes): tres pantallas más
  pequeñas (`/forgot-password`, `/reset-password`, `/verify-code`) que
  complementan el flujo. Login enlaza a Forgot.
- **Inicio** (`/inicio`): destino por defecto de un login/register
  exitoso.

## Responsive

- **< 640px (móvil)**: solo columna izq, padding interno `p-6`, hero oculto.
- **640–1024 (tablet)**: idéntico a móvil pero con `p-8` y tipografías
  ligeramente mayores.
- **≥ 1024 (desktop)**: split 50/50 con hero decorativo visible.

## Notas de implementación

- `<Toaster>` se monta localmente en cada pantalla con
  `position="top-center" richColors closeButton`. La app raíz no
  monta un Toaster global (cada pantalla fullscreen gestiona el suyo).
- Los iconos de OAuth (Google/Microsoft) son placeholders SVG
  minimalistas. Antes de producción sustituir por los oficiales.
- El `scorePassword` devuelve 5 niveles (0–4) con etiquetas "Muy débil
  → Fuerte". Es orientativo, **no** bloqueante (el mínimo duro es ≥ 8
  chars).
- No usamos shadcn ni primitivas de Radix: todos los controles son
  nativos (`<input>`, `<button>`, `<select>`) con Tailwind y tokens
  HSL del sistema.
- Mobile-first 375px: probado manualmente a esa anchura.

## TODOs al conectar backend

- [ ] `TODO(backend)`: implementar `POST /auth/login` y reemplazar el
      `setTimeout` en `Login.tsx`.
- [ ] `TODO(backend)`: implementar `POST /auth/register` y reemplazar el
      `setTimeout` en `Register.tsx`.
- [ ] `TODO(backend)`: verificación por email (envío + consumo de token
      de verificación en `/verify-code`).
- [ ] `TODO(backend)`: OAuth Google + Microsoft.
- [ ] `TODO(onboarding)`: crear `/onboarding` y redirigir ahí tras
      registro en lugar de a `/inicio`.
- [ ] `TODO(a11y)`: añadir `aria-live="polite"` al banner de error.
- [ ] `TODO(i18n)`: todo el texto es hard-coded en español; cuando
      llegue i18n extraer a `i18n/auth.es.ts`.
- [ ] `TODO(security)`: integrar chequeo HIBP en Register.
- [ ] `TODO(ui)`: pantalla `/login` debería detectar sesión viva y
      redirigir a `/inicio` antes de renderizar.
