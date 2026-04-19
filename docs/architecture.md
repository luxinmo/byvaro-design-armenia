# Arquitectura · Byvaro v2

## ¿Qué es Byvaro?

Plataforma SaaS para **promotores inmobiliarios** (developers) que gestionan
la venta de obra nueva apoyándose en una **red de agencias colaboradoras**.

El promotor es el dueño del producto inmobiliario (el edificio, la villa) y
quien invierte en marketing. Las agencias aportan **clientes** a cambio de
una comisión por venta cerrada. Byvaro es el sistema operativo que orquesta
esa relación: quién tiene acceso a qué unidad, quién registra a qué cliente,
qué visitas se programan, qué ventas se cierran y cuánta comisión se paga.

## Las dos personas

### Promotor (persona principal)

Quien paga Byvaro. Tiene una o varias **promociones** (proyectos
inmobiliarios) con **unidades** (pisos, villas, locales). Su trabajo:

- Configurar promociones (multimedia, precios, comisiones, colaboradores)
- Aprobar o rechazar registros de clientes que envían las agencias
- Validar visitas programadas
- Gestionar ventas y cobrar/pagar comisiones
- Analizar qué agencias venden más, en qué mercados (nacionalidades)

### Agencia (colaborador)

Empresas externas que traen compradores al promotor. Tienen acceso *read-only*
a las unidades **Disponibles** de las promociones con las que colaboran, y
pueden:

- Registrar clientes interesados
- Programar visitas
- Enviar fichas de unidades a sus clientes
- Ver comisiones propias, pero no datos sensibles (cliente de otra agencia,
  fecha de venta, agencia ganadora, etc.)

### Admin (roles de empresa)

Dentro de la misma empresa del Promotor hay usuarios con distintos permisos:
owner, comercial, asistente, etc. Configuración en `/ajustes`.

## Flujos principales

### 1. Onboarding de un promotor

Registro → verificación email → onboarding (wizard inicial: empresa, datos
fiscales, equipo) → llegan a `/inicio`.

### 2. Crear una promoción

`/promociones` → botón "+ Nueva promoción" → wizard multi-paso
(`/crear-promocion`) con 14 etapas (ver `screens/crear-promocion.md`) →
guarda borrador automáticamente → al publicar aparece en el listado.

### 3. Invitar agencias a colaborar

Dentro de una promoción → tab "Agencias" → selecciona agencias → envía
invitación → la agencia acepta desde su panel y aparece el inventario en su
lista de promociones colaborables.

### 4. Flujo de registro de cliente

1. Agencia identifica un cliente interesado
2. Agencia lo registra en una promoción concreta (nombre, teléfono,
   nacionalidad, email)
3. Byvaro detecta posibles duplicados (`matchPercentage` vs clientes previos)
4. Solicitud llega al Promotor (`/registros`)
5. Promotor aprueba / rechaza / pide más información
6. Si se aprueba, queda bloqueada una "preferencia" de X días para esa
   agencia sobre ese cliente
7. Agencia puede programar visita con el cliente
8. Si cliera, se registra como venta y se calcula comisión

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
