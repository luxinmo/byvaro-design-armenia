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

### Register · wizard de 2 pasos + rama company-exists

**Step 1 · rol + email**
1. Usuario elige rol (Promotor/Agencia/Propietario) entre 3 cards pill.
2. Introduce email profesional + nombre comercial de empresa (opcional).
3. Click en "Continuar":
   - Se ejecuta `getCompanyFromEmail(email)` (mock local, futuro
     `GET /api/v1/companies/lookup?domain=<x>`).
   - Si el dominio matchea → rama **company-exists**.
   - Si no → **Step 2**.

**Rama company-exists**
1. Card con logo Clearbit de la empresa detectada + nombre.
2. Email en read-only con botón "Editar" que vuelve a Step 1.
3. Click en "Solicitar acceso":
   - Dispara `POST /api/v1/companies/join-request` (hoy `setRequestSent(true)`).
   - Se renderiza pantalla final "Solicitud enviada" con el email del
     administrador enmascarado (`a*****n@luxinmo.com`).
4. Link "Volver al inicio de sesión" lleva a `/login`.

**Step 2 · datos personales**
1. Selector sub-rol (Propietario/Director · Empleado) pill group.
2. Nombre completo · email read-only editable · teléfono.
3. Password (con medidor de fuerza de 4 barras) + confirmación + ToS.
4. Click en "Crear cuenta":
   - `POST /api/v1/auth/register` (hoy mock `setTimeout(700)`).
   - Toast "Cuenta creada · Te hemos enviado un email de verificación."
   - `navigate("/inicio", { replace: true })`. **TODO(onboarding)**:
     redirigir a `/onboarding` cuando exista.

### Register · error
- **Step 1 · rol no seleccionado** → banner "Selecciona tu rol."
- **Step 1 · email inválido** → inline + banner.
- **Step 2 · sub-rol no seleccionado** → banner.
- **Nombre < 2 chars** → banner "Escribe tu nombre completo."
- **Teléfono < 6 chars** → banner.
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

### Register (wizard completo)

**Step 1**

| Campo | Tipo | Required | Validación cliente |
|---|---|---|---|
| role | enum `developer` \| `agency` \| `owner` | ✅ | seleccionado |
| email | email | ✅ | formato `x@y.z` |
| companyName | text | ⬜ | libre (opcional) |

**Rama company-exists**

| Campo | Tipo | Required | Nota |
|---|---|---|---|
| email | email (read-only) | ✅ | heredado de Step 1, "Editar" vuelve |

**Step 2**

| Campo | Tipo | Required | Validación cliente |
|---|---|---|---|
| subRole | enum `director` \| `employee` | ✅ | seleccionado |
| name | text | ✅ | `trim().length >= 2` |
| email | email (read-only) | ✅ | heredado, "Editar" vuelve a Step 1 |
| phone | tel | ✅ | `trim().length >= 6` |
| password | password | ✅ | longitud ≥ 8 |
| confirm | password | ✅ | `=== password` |
| acceptTos | checkbox | ✅ | debe estar marcado |

**Password strength meter** (Step 2): 4 heurísticas — ≥8 chars,
mayúscula, número, símbolo. Pinta 4 barras (destructive → amber →
primary → primary).

**Mock de empresas** (Step 1 · detección por dominio de email):
`luxinmo.com`, `kronoshomes.com`, `metrovacesa.com`. En producción
sustituir por lookup server-side.

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
  "role": "developer" | "agency" | "owner",
  "subRole": "director" | "employee",
  "name": "Ana Gómez",
  "email": "ana@empresa.com",
  "phone": "+34 600 000 000",
  "companyName": "Luxinmo",             // opcional · informativo
  "password": "********"
}
Response 201:
{
  "user": { "id": "usr_...", "email": "...", "verified": false },
  "session": { "token": "...", "expiresAt": "..." },
  "onboarding": { "required": true, "nextStep": "company-setup" }
}
Response 409: { "error": "email_exists" }
Response 422: { "error": "weak_password" | "invalid_email" }
```

```
GET /api/v1/companies/lookup?domain=luxinmo.com
Response 200:
{
  "company": { "id": "co_...", "name": "Luxinmo Real Estate",
               "logo": "https://logo.clearbit.com/luxinmo.com",
               "adminEmail": "a*****n@luxinmo.com" }
}
Response 404 si no match.
```

```
POST /api/v1/companies/join-request
Request:
{
  "email": "arman@luxinmo.com",
  "companyId": "co_..."
}
Response 200: { "status": "sent" }
Response 409: { "status": "already-member" }
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
