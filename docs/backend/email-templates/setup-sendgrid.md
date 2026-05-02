# Setup SendGrid → Supabase para byvaro.com

> Guía paso-a-paso para tener emails de auth saliendo desde
> `noreply@byvaro.com` en lugar del SMTP por defecto de Supabase
> (que tiene rate limit + va a spam).

## ⏱ Tiempo total estimado · 15 minutos

## Paso 1 · Crear API Key en SendGrid (2 min)

1. Entra a https://app.sendgrid.com (login con tu cuenta)
2. Sidebar izquierdo · **Settings** → **API Keys**
3. Click botón azul **Create API Key**
4. **API Key Name**: `byvaro-supabase-smtp`
5. **API Key Permissions**: selecciona **Restricted Access**
6. En la lista de permisos, scroll hasta **Mail Send** y dale **Full Access**
7. El resto deja en **No Access**
8. Click **Create & View**
9. **CRÍTICO**: copia la key (`SG.xxxxxxx...xxxxxxx`) · NO la verás otra vez. Pégala en un sitio temporal.

---

## Paso 2 · Verificar dominio byvaro.com (10 min)

1. SendGrid → **Settings** → **Sender Authentication**
2. Sección **Domain Authentication** → click **Get Started** (o **Authenticate Your Domain**)
3. **DNS host**: selecciona tu proveedor (Cloudflare / GoDaddy / IONOS / Other). Si no estás seguro, elige "Other Host (Not Listed)".
4. **Would you also like to brand the links for this domain?** → SÍ (recomendado)
5. **Use automated security?** → SÍ
6. **Domain You Send From**: escribe `byvaro.com`
7. **Advanced Settings** (opcional pero recomendado):
   - Use a custom return path → `em` (subdominio que usará SendGrid)
   - Use a custom DKIM selector → dejarlo en default
8. Click **Next**

SendGrid te enseña **3 CNAMEs** que tendrás que añadir en el DNS de byvaro.com. Algo así (los valores exactos los genera SendGrid):

```
Tipo    Host                              Valor
CNAME   em####.byvaro.com                 u#######.wl.sendgrid.net
CNAME   s1._domainkey.byvaro.com          s1.domainkey.u#######.wl.sendgrid.net
CNAME   s2._domainkey.byvaro.com          s2.domainkey.u#######.wl.sendgrid.net
```

(Los `####` son números únicos de tu cuenta · usa los que SendGrid te muestre.)

### Añadirlos en tu DNS

Si usas **Cloudflare**:

1. Login Cloudflare → tu dominio `byvaro.com`
2. Tab **DNS** → **Records**
3. Click **Add record** y añade cada CNAME:
   - **Type**: CNAME
   - **Name**: pega lo que dice "Host" (ej. `em1234`, sin `.byvaro.com` final · Cloudflare lo añade)
   - **Target**: pega lo que dice "Valor"
   - **Proxy status**: ⚠️ **DNS only** (gris, NO naranja). Si está en proxy, los emails fallan.
   - Click **Save**
4. Repite para los 3 CNAMEs
5. Espera 1-5 minutos para propagación

Si usas **GoDaddy/IONOS/otro**:

1. Login → DNS Management → Add record
2. Type CNAME · Name + Value como te indica SendGrid
3. TTL · default OK
4. Save · espera 10-30 min

### Verificar en SendGrid

Tras añadir los CNAMEs:

1. Vuelve a SendGrid → Sender Authentication
2. Click **Verify** en tu dominio
3. Si los DNS están propagados, todos los CNAMEs aparecen en verde ✓
4. Si dice "Pending" · espera 10 min y vuelve a clickar Verify

---

## Paso 3 · Pegar en Supabase (2 min)

1. Entra a Supabase Dashboard → tu proyecto
2. Sidebar izquierdo · **Authentication** → **Emails** → **SMTP Settings**
3. Toggle **Enable Custom SMTP** → ON
4. Rellena con estos valores EXACTOS:

```
Host                  smtp.sendgrid.net
Port                  587
Username              apikey
Password              SG.xxxxxxx...        ← la API key del Paso 1
Sender Email          noreply@byvaro.com
Sender Name           Byvaro
Minimum interval      60
```

⚠️ **Importante** · Username es **literalmente** la palabra `apikey` (no tu email, no la API key, sino la palabra "apikey").

5. Click **Save**

---

## Paso 4 · Subir las plantillas HTML branded (3 min)

En esta misma carpeta tienes 4 archivos:

- `confirm-signup.html` → confirma email tras registro
- `reset-password.html` → cambio de password
- `magic-link.html` → login sin password (no usado por defecto, dejado por compleción)
- `change-email.html` → cambio de email del user

Para cada uno:

1. Supabase Dashboard → **Authentication** → **Emails** → **Email Templates**
2. Selecciona la plantilla correspondiente:
   - "Confirm signup" → pega `confirm-signup.html`
   - "Reset password" → pega `reset-password.html`
   - "Magic link" → pega `magic-link.html`
   - "Change email address" → pega `change-email.html`
3. Borra el HTML default
4. Pega el HTML del archivo
5. **Subject** del email · cambia también:
   - Confirm signup: `Confirma tu cuenta en Byvaro`
   - Reset password: `Restablece tu contraseña en Byvaro`
   - Magic link: `Tu enlace de acceso a Byvaro`
   - Change email: `Confirma tu nuevo email en Byvaro`
6. Click **Save**

---

## Paso 5 · Test (1 min)

1. Ir a tu sitio en producción (Vercel) `/register`
2. Registrarte con un email **real** que tengas a mano (Gmail, Outlook, lo que sea)
3. Revisar bandeja (y spam por si acaso)
4. Email DEBE llegar desde `noreply@byvaro.com` con asunto "Confirma tu cuenta en Byvaro"
5. Click el botón "Confirmar mi email" → te redirige a `/login`
6. Login con el mismo email → entras

Si el email NO llega:

- SendGrid Dashboard → **Activity** → busca tu email · ahí ves "Delivered" / "Bounced" / "Blocked" con el motivo
- Si dice "Domain not authenticated" · vuelve al Paso 2 (DNS no verificado)
- Si llega a spam · espera 1-2 días para que tu dominio gane reputación, o pide a Gmail "Move to inbox"

---

## Coste

- **SendGrid Free Tier**: 100 emails/día gratis (suficiente para Phase 1)
- Si superas eso · **$19.95/mes** (Essentials · 50K emails/mes)
- Para Byvaro al inicio (signups + invitaciones + registros aprobados) el free tier sobra

---

## Tras setup · email del registro

El primer email que recibirás al hacer `/register` será el de "Confirma tu cuenta". Tras click → entras en `/login` y ya puedes loguearte.

Después de eso, Supabase también enviará automáticamente:
- Reset password (cuando un user dice "olvidé mi password")
- Change email (cuando un user cambia el email en perfil)

Las invitaciones a agencias, registros aprobados, etc. NO usan SMTP de Supabase · usan otro flow (Edge Function + SendGrid API directo) que se montará cuando llegue Phase 2.
