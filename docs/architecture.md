# Arquitectura · Byvaro v2

> **Lectura obligada antes: `docs/product.md`** — explica qué es Byvaro,
> modelo de negocio, precios y diferencial. Este documento es técnico.

## ¿Qué es Byvaro?

SaaS para **promotores inmobiliarios** de obra nueva. Resuelve dos dolores
concretos:

1. **Les da la web de la promoción** — cada promoción activa genera
   automáticamente un microsite (`byvaro.com/<slug>` o dominio custom) con
   formulario de captación conectado al flujo de registros.
2. **Elimina el caos de los registros entre agencias** — IA automática que
   compara cada registro entrante con contactos propios + registros previos
   de otras agencias a ese mismo promotor, y recomienda aprobar o rechazar.

El promotor paga **249€/mes**. Las agencias que invita el promotor son
**gratis**. Una agencia que quiere descubrir promotores desde el
**marketplace** paga **99€/mes** (si no paga, ve el marketplace pero todo
el contenido está difuminado — ver `docs/paywall.md`).

## Las tres personas

### 1. Promotor — el cliente de pago (249€/mes)

Quien paga Byvaro. Tiene una o varias **promociones** con **unidades**. Su
trabajo:

- Configurar promociones (multimedia, precios, comisiones)
- Invitar agencias de confianza (email → magic link)
- Aprobar o rechazar registros de clientes con IA de duplicados
- Validar visitas programadas
- Gestionar ventas y analítica Agencia × Nacionalidad

### 2. Agencia invitada — gratis (0€)

Agencias que el promotor invita por email. Acceso **completo y gratuito**
solo a las promociones donde colabora. Pueden:

- Ver unidades disponibles (solo `status === "available"`)
- Registrar clientes al promotor
- Programar visitas
- Enviar fichas a sus clientes
- Ver sus comisiones propias

NO ven datos sensibles: cliente de otra agencia, fecha de venta, agencia
ganadora, datos del resto de promotores.

### 3. Agencia marketplace — plan opcional (99€/mes)

Cualquier agencia que quiera **descubrir promotores** desde el marketplace
público de Byvaro. Pago 99€/mes le desbloquea:

- Catálogo completo de promociones de todos los promotores
- Datos reales (precios, fotos, ubicación, unidades)
- Poder solicitar colaboración a cualquier promotor

Sin pagar, puede visitar `/marketplace` pero todo el contenido está
difuminado (ver `docs/paywall.md`). Solo ve contadores agregados y filtros
funcionales, nunca identidades ni datos sensibles.

### Admin (roles de empresa)

Dentro de la misma empresa del promotor hay usuarios con distintos permisos.
Los roles específicos (owner, comercial, asistente) se definirán en una
fase posterior — por ahora asumimos un único rol owner con permisos totales.

## Flujos principales

### 1. Onboarding de un promotor

Registro → verificación email → onboarding (wizard inicial: empresa, datos
fiscales, equipo) → llegan a `/inicio`.

### 2. Crear una promoción

`/promociones` → botón "+ Nueva promoción" → wizard multi-paso
(`/crear-promocion`) con 14 etapas (ver `screens/crear-promocion.md`) →
guarda borrador automáticamente → al publicar aparece en el listado.

### 3. Invitar agencias a colaborar (flujo real)

1. Promotor abre una promoción → sección "Agencias" → botón "Invitar agencia"
2. Escribe el **email** de la agencia (manual, 1 por 1)
3. Byvaro envía un email con un **magic link** único
4. La agencia hace click en el link → aterriza en `/onboarding-agencia`
5. **Crea su contraseña** en una sola pantalla (el email ya viene
   pre-rellenado)
6. Ya está dentro con una cuenta free — ve la promoción del promotor que
   le invitó
7. Puede invitar a más compañeros de su equipo a usar la misma cuenta

Desde ese momento, la agencia puede registrar clientes a esa promoción. Sin
pagar. Sin fricción. La agencia solo paga si quiere descubrir promotores
nuevos en el marketplace.

### 4. Flujo de registro de cliente con IA de duplicados

1. Agencia identifica un cliente interesado
2. Lo registra en una promoción con: nombre, teléfono, email, nacionalidad
3. Byvaro lanza el análisis de IA que compara contra:
   - **Contactos propios del promotor** (CRM)
   - **Registros previos de otras agencias** a esa misma promoción
   (NO compara entre promotores distintos — es scoping por tenant)
4. La IA devuelve:
   ```
   {
     matchPercentage: 0-100,
     matchDetails: [...campos coincidentes...],
     existingClient: { agencyName, agentName, registeredDate, hasVisited },
     recommendation: "Recomiendo rechazar porque..." | "Aprobar, sin duplicados"
   }
   ```
5. Promotor recibe notificación en `/registros` con la IA ya ejecutada
6. Modal con "Aprobar / Rechazar" pre-sugerido según recomendación
7. Si aprueba → email automático a agencia + cliente; registro bloqueado
   por `validezRegistroDias` (default 30)
8. Si rechaza → email de rechazo con motivo

Este es el **40% del valor** del producto — ver `docs/product.md`.

### 5. Ciclo de venta

Lead → Visita → Reserva (señal) → Firma contrato C/V → Entrega →
Comisión pagada a la agencia. Visible en `/ventas`.

## Módulos y sus responsabilidades

| Módulo | Responsabilidad |
|---|---|
| **Promociones** | Catálogo de proyectos, unidades, multimedia, comisiones, colaboradores |
| **Registros** | Solicitudes de captación enviadas por agencias, aprobación/rechazo |
| **Ventas** | Pipeline comercial, reservas, operaciones cerradas |
| **Calendario** | Visitas programadas, reuniones, llamadas |
| **Colaboradores** | Gestión de la red de agencias + analítica Agencia×Nacionalidad |
| **Contactos** | CRM de clientes (leads + compradores) |
| **Microsites** | Landing pages públicas por promoción (SEO) |
| **Emails** | Plantillas transaccionales + campañas comerciales |
| **Ajustes** | Empresa, equipo, permisos, integraciones, facturación |

## Relaciones entre entidades (high-level)

```
Empresa (promotor)
  └─ Promocion (1..N)
      ├─ Unidad (1..N)
      ├─ Multimedia (N)
      ├─ Documentos (carpetas del sistema + custom)
      ├─ Colaboraciones (config de comisión x agencia)
      └─ Registros (1..N)
          └─ Visitas (0..N)
              └─ Venta (0..1)
                  └─ Comision (1)

Agencia
  └─ Agentes (1..N)
  └─ ColaboracionActiva (con Promocion) (N)

Contacto (cliente)
  ├─ Registros (donde aparece) (N)
  └─ Visitas (N)
```

Tipos TypeScript: ver `src/data/promotions.ts`, `src/data/developerPromotions.ts`,
`src/data/units.ts`, `src/components/crear-promocion/types.ts`.

## Flujo de autenticación (planeado)

- **Login** email + password, con opción Google OAuth
- **Registro** crea cuenta + empresa, redirige a onboarding
- **Forgot password** envía email con link de reset (token válido 1h)
- **Verify code** 2FA opcional por SMS
- **Sesión** JWT con refresh token en cookie httpOnly

Detalle completo: ver `screens/auth.md` (pendiente) y los docs del repo
original en `ARCHITECTURE_AUTH.md`.

## Cambios de v1 → v2

1. **Nueva IA del menú** — 4 grupos claros (General, Comercial, Red,
   Contenido) + Admin abajo. Antes: lista plana de 11 items con 7 links rotos.
2. **Fusión de duplicados** — Contactos unifica `Contacts` + `ContactsApp`.
   Agencies renombradas a "Colaboradores". Dashboard analítico se convierte
   en un sub-tab dentro de Colaboradores.
3. **Lenguaje visual refrescado** — tokens HSL consolidados, `rounded-2xl`
   en panels, `shadow-soft`, micro-interacciones consistentes.
4. **Mobile-first estricto** — diseño desde 375px, `MobileBottomNav` con FAB
   central para acciones rápidas.
5. **Idioma 100% español** en la UI (antes estaba mezclado).

Historia completa de decisiones: `../DECISIONS.md`.
