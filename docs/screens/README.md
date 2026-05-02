# Pantallas · Spec funcional

Cada archivo `.md` documenta una pantalla (o grupo de pantallas relacionadas)
con todo lo necesario para implementarla: propósito, layout, acciones, API
contract, permisos, estados, enlaces salientes.

## Índice

### Vista Promotor

| Pantalla | Ruta | Archivo | Estado |
|---|---|---|---|
| Inicio | `/inicio` | [`inicio.md`](inicio.md) | ✅ diseñada |
| Promociones | `/promociones` | [`promociones.md`](promociones.md) | ✅ diseñada |
| Crear promoción | `/crear-promocion` | [`crear-promocion.md`](crear-promocion.md) | ✅ diseñada (15 pasos) |
| Promoción · detalle | `/promociones/:id` | [`promocion-detalle.md`](promocion-detalle.md) | ✅ diseñada |
| Oportunidades | `/oportunidades` | [`oportunidades.md`](oportunidades.md) | ✅ diseñada (pipeline unificado · ADR-053) |
| Oportunidad · ficha | `/oportunidades/:id` | [`oportunidades-ficha.md`](oportunidades-ficha.md) | ✅ diseñada (tabs + cualificación) |
| Leads (histórico) | — | [`leads.md`](leads.md) | ⚠️ el concepto se unificó en Oportunidades, doc sigue como referencia |
| Registros | `/registros` | (pendiente) | 🎨 placeholder |
| Calendario | `/calendario` | [`calendario.md`](calendario.md) | ✅ diseñada (4 vistas + mobile + Google sync · ADR-056) |
| Ventas | `/ventas` | (pendiente) | 🎨 placeholder |
| Calendario | `/calendario` | (pendiente) | 🎨 placeholder |
| Colaboradores | `/colaboradores` | [`colaboradores.md`](colaboradores.md) | ✅ diseñada (versión única) |
| Agencia · detalle (ficha pública) | `/colaboradores/:id` | [`agencia-detalle.md`](agencia-detalle.md) | ✅ diseñada |
| Colaborador · panel operativo | `/colaboradores/:id/panel` | [`colaborador-panel.md`](colaborador-panel.md) | ✅ diseñada (9 tabs · ADR-057) |
| Estadísticas de colaboradores | `/colaboradores/estadisticas` | [`colaboradores-estadisticas.md`](colaboradores-estadisticas.md) | ✅ diseñada |
| Compartir promoción (flujo) | modal desde `/promociones` y ficha | [`compartir-promocion.md`](compartir-promocion.md) | ✅ diseñada |
| Contactos | `/contactos` | (pendiente · listado) | 🎨 placeholder |
| Contacto · ficha | `/contactos/:id` | [`contactos-ficha.md`](contactos-ficha.md) | ✅ diseñada (8 tabs) |
| Ajustes · Tipos de relación | `/ajustes/contactos/relaciones` | [`ajustes-contactos-relaciones.md`](ajustes-contactos-relaciones.md) | ✅ diseñada |
| Ajustes · Miembros del equipo | `/ajustes/usuarios/miembros` | [`ajustes-miembros.md`](ajustes-miembros.md) | ✅ diseñada |
| Ajustes · Empresa > Departamentos | `/ajustes/empresa/departamentos` | [`empresa-departamentos.md`](empresa-departamentos.md) | ✅ diseñada (CRUD + store · ADR-054) |
| Equipo (hub rich) | `/equipo` | [`equipo.md`](equipo.md) | ✅ diseñada (galería + lista + 2 flows alta) |
| Empresa (ficha + verificación) | `/empresa` · `/promotor/:id` · `/colaboradores/:id` | [`empresa.md`](empresa.md) | ✅ diseñada (3 tabs + verificación legal con Firmafy) |
| Superadmin · Verificaciones | `/superadmin/verificaciones` | [`admin-verificaciones.md`](admin-verificaciones.md) | 🎨 spec (sin UI todavía) |
| Dashboard de miembro | `/equipo/:id/estadisticas` | [`equipo-estadisticas.md`](equipo-estadisticas.md) | ✅ diseñada (4 bloques KPIs + heatmap) |
| Microsites | `/microsites` | (pendiente) | 🎨 placeholder |
| Emails | `/emails` | [`emails.md`](emails.md) | 🟡 doc + tipos (falta UI) |
| Ajustes | `/ajustes` | (pendiente) | 🎨 placeholder |

### Auth & Onboarding

| Pantalla | Ruta | Archivo | Estado |
|---|---|---|---|
| Login | `/login` | [`auth.md`](auth.md) | ✅ implementada (Supabase Auth) |
| Registro | `/register` | [`auth.md`](auth.md) | ✅ implementada (signup real · trigger DB crea org+member) |
| Email enviado tras signup | `/register/email-sent` | (inline en `Register.tsx`) | ✅ implementada (botón reenviar) |
| Términos y condiciones | `/legal/terminos` | (inline en `pages/legal/Terminos.tsx`) | ✅ implementada · linkado desde checkbox de `/register` |
| Política de privacidad | `/legal/privacidad` | (inline en `pages/legal/Privacidad.tsx`) | ✅ implementada · linkado desde checkbox de `/register` |
| Aceptar invitación | `/invite/:token` | (pendiente doc) | ✅ implementada (`InviteAccept.tsx`) |
| Aceptar responsable | `/responsible/:token` | (pendiente doc) | ✅ implementada (`ResponsibleAccept.tsx`) |
| Forgot password | `/forgot-password` | (pendiente) | 🎨 placeholder |
| Reset password | `/reset-password` | (pendiente) | 🎨 placeholder |
| Verify code | `/verify-code` | (pendiente) | 🎨 placeholder |
| Onboarding | `/onboarding` | (pendiente) | 🎨 placeholder |

### Vista Agencia (pendiente de diseño)

Las rutas se solapan con las de Promotor usando lógica dual-mode
(`agentMode` prop o lectura del rol del usuario).

## Plantilla para nuevas pantallas

Al crear una nueva pantalla, copia esta estructura:

```markdown
# Pantalla · {Nombre} (`/ruta`)

## Propósito
## Layout (ascii art o descripción)
## Componentes
## Acciones del usuario (tabla)
## Validaciones
## API endpoints esperados
## Permisos (Promotor vs Agencia)
## Estados (loading, empty, error)
## Enlaces salientes (tabla)
## Responsive
## Notas de implementación
## TODOs al conectar backend
```
