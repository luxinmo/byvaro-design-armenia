# Placeholders & opciones sin funcionalidad

> Inventario de toda opción que se ve en la UI pero aún no tiene
> comportamiento real. Si una opción aparece aquí es diseño puro —
> clickar no produce efecto, abrir no persiste, etc.
>
> Se actualiza en cada iteración. Fuente: `scripts/dead-buttons-scan.mjs`
> + inspección manual.

## 1 · Pantallas completas (8 secciones del menú)

Estas rutas renderizan únicamente el componente `PlaceholderPage` con
un hero decorativo + descripción + bloques previstos. No hay contenido
real ni interacción.

| Ruta | Archivo | Estado |
|---|---|---|
| `/calendario` | `src/pages/Calendario.tsx` | placeholder |
| `/registros` | `src/pages/Registros.tsx` | placeholder |
| `/ventas` | `src/pages/Ventas.tsx` | placeholder |
| `/colaboradores` | `src/pages/Colaboradores.tsx` | placeholder |
| `/contactos` | `src/pages/Contactos.tsx` | placeholder |
| `/microsites` | `src/pages/Microsites.tsx` | placeholder |
| `/emails` | `src/pages/Emails.tsx` | placeholder |
| `/ajustes` | `src/pages/Ajustes.tsx` | placeholder |

**Pantallas con funcionalidad real**: `/inicio`, `/promociones`,
`/promociones/:id`, `/crear-promocion`, `/empresa`, `/login`, `/register`.

## 2 · AppHeader (presente en TODAS las páginas)

`src/components/AppHeader.tsx` · 2 botones sin `onClick`:

- **Buscar ⌘K** (línea 42) — no abre paleta de comandos.
- **Notificaciones** (bell, línea 50) — no abre panel, no muestra lista.
  (El punto azul del dot es puramente decorativo.)

## 3 · /inicio (Dashboard)

`src/pages/Inicio.tsx` — es la pantalla de referencia visual del
proyecto. La mayoría de sus botones son ilustrativos:

- **Selector de rango** (Esta semana / Mes / Trimestre) — alterna
  estilo pero no cambia datos del dashboard.
- **Acciones rápidas**: Nueva promoción, Registrar cliente, Programar
  visita, Enviar campaña — tarjetas decorativas.
- **Cards de actividad reciente**: Revisar / Aprobar / Rechazar /
  Ver todas / Ver todo / Agenda / Descartar — ninguno navega ni
  modifica estado.

Veredicto: `/inicio` es una maqueta — todo su contenido es mock.

## 4 · /promociones (lista)

`src/pages/Promociones.tsx` · funcional **excepto**:

- **Tab "Incompletas"** — filtra correctamente, el scanner lo marcaba
  como falso positivo (cambia estado interno sin cambio visible en el
  dom-hash).
- **Botón "Compartir con agencias"** en cada card — abre toast
  `"Enlace copiado"` pero no registra nada.

Funcional: filtros, sort, cambio de vista (lista/grid/mapa), clic en
card → navega a ficha, "Nueva promoción" → `/crear-promocion`.

## 5 · /promociones/:id (ficha)

`src/pages/PromocionDetalle.tsx` — la pantalla más completa. Funcional:
tabs, editar secciones via dialog, registro cliente, tabla unidades,
banner "rojizo" de requisitos faltantes con botones "Completar" que
abren el dialog correcto.

Sin funcionalidad real:
- **Vista colaborador** (toggle) — cambia UI pero es sólo presentación.
- **Previsualizar microsite** — no abre el microsite real.
- **Botón "Publicar"** (🚀) — muestra toast de éxito, no llama API.
  Ver `// TODO(backend)` en línea ~303.
- **Share2 de cada unidad** — sin acción.

## 6 · /empresa

`src/pages/Empresa.tsx` · funcional **excepto** estos botones de
"añadir recurso" que no abren selector ni persisten:

- **Añadir portada** / **Editar portada** (hover en hero)
- **Añadir Web**
- **Añadir Facebook**
- **Añadir YouTube**
- **Previsualizar como agencia** (topbar)

Otros bloques como "Oficinas", "Equipo" y "Políticas" sí son
funcionales (pueden editarse in-place).

## 7 · /crear-promocion (wizard)

`src/pages/CrearPromocion.tsx` — 11 de 15 pasos portados. El paso
"revisión" publica en la UI (`navigate("/promociones")`) pero no
llama backend. Placeholder explícito en línea 1061–1069 para pasos
aún no portados ("próximamente").

Campos dentro de cada paso están completos visualmente y guardan en
`WizardState`, pero ninguno persiste a backend (no hay `POST`).

## 8 · /login · /register

Funcionales en cuanto a UI (validación de formato email, medidor de
password, flow de company-exists). Al enviar hacen `setTimeout` y
`toast.success` pero sin llamada real. Ver `// TODO(backend)` en
`Login.tsx:86`, `Register.tsx:195/211`.

## Cómo regenerar este inventario

```bash
npm run dev  # en otra terminal
npm run audit:dead-buttons
```

Output en `screenshots/dead-buttons/report.json`.

**Nota sobre falsos positivos**: el scanner marca como "dead" cualquier
botón cuyo clic no produce cambio observable en URL + dom-hash + dialogs
+ toasts. Tabs, toggles de vista y algunos modales que abren y cierran
rápido quedan como falsos positivos. Este documento está curado a mano
a partir de la salida cruda.

## Roadmap para convertir a comercial

Para que el producto sea vendible, el orden lógico es:

1. **Backend mínimo**: `/login`, `/register`, `/promociones` CRUD,
   `/empresa`. Ver `docs/api-contract.md` y `docs/services.md`.
2. **Finalizar /inicio** con datos reales (no mock).
3. **Pantallas placeholder** (8 secciones) — priorizar por modelo de
   negocio: **Registros** (core — dedup IA) > **Colaboradores** > **Ventas** >
   **Microsites** > **Contactos** > **Emails** > **Calendario** > **Ajustes**.
4. **AppHeader**: paleta ⌘K + panel de notificaciones.
5. **Wizard**: completar 4 pasos restantes + conectar `POST /api/promociones`.
