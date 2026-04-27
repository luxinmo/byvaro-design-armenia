# Superadmin · Verificaciones de empresa

> Pantalla del **superadmin de Byvaro** para revisar y aprobar las
> solicitudes de verificación de empresa que envían los promotores
> desde `/empresa?tab=about` (sección "Verificación de empresa").
> Esta pantalla **NO existe todavía en frontend** — vive aquí como
> spec hasta que se implemente. Ruta sugerida:
> `/superadmin/verificaciones`.

---

## Flujo desde el promotor (resumen)

1. Promotor abre `/empresa?tab=about` y pulsa "Iniciar verificación".
2. Sube **CIF de la empresa** + **DNI/NIE del representante**.
3. Rellena datos del representante: nombre completo, email, teléfono.
4. Marca si es el único firmante o si hay otros autorizados (con su
   nombre, email y teléfono).
5. Pulsa "Solicitar verificación" → estado pasa a
   `firmafy-pendiente`. Se le envía a su email un documento de
   declaración responsable vía Firmafy.
6. Tras firmar todos los firmantes implicados, estado pasa a
   `revision-byvaro` y la solicitud aparece en esta pantalla.
7. Superadmin valida documentos + identidad y aprueba o rechaza.
8. Aprobada → `empresa.verificada = true`, `verificadaEl = ISO`. El
   tick azul aparece junto al nombre de la empresa en todas las
   pantallas.

---

## Datos que el superadmin DEBE ver por solicitud

| Sección | Campos |
|---|---|
| **Empresa** | `nombreComercial`, `razonSocial`, `cif`, `direccionFiscal` completa, `email`, `telefono`, `sitioWeb`, fecha de creación de la empresa en Byvaro, `workspaceKey`. |
| **Representante** | `verificacionRepresentante.nombreCompleto`, `email`, `telefono`. Junto a cada dato: el dato equivalente en la cuenta del usuario que envió la solicitud (para detectar suplantación). |
| **Documentos subidos** | `verificacionDocs.cifEmpresa` (preview + descarga) · `verificacionDocs.identidadRepresentante` (preview + descarga). Ambos con timestamp y peso. |
| **Firmantes** | `verificacionFirmaUnica` (true/false). Si false, lista de `verificacionAutorizados` con sus datos. Cada firmante tiene su propio bloque con estado individual de firma Firmafy. |
| **Firmafy** | Id de la solicitud Firmafy, estado de cada firma (pendiente/firmada), enlace al PDF firmado, fecha de envío, IP del firmante, hash del documento. |
| **Histórico** | `verificacionSolicitadaEl`, intentos previos rechazados (motivo), comentarios internos del superadmin. |

---

## Acciones disponibles en la pantalla

- **Aprobar verificación** → backend setea
  `empresa.verificada=true`, `verificadaEl=ISO`,
  `verificacionEstado="verificada"`. Webhook interno notifica al
  promotor por email. Logs auditoría: `actor`, `decisión`, `razón`.
- **Rechazar** → estado pasa a `rechazada` con un `motivo`
  estructurado (documento ilegible, datos no coinciden con el
  Registro Mercantil, sospecha de suplantación, …). El promotor lo
  ve en su tab Sobre nosotros con el motivo y puede reintentar.
- **Solicitar más documentación** → estado vuelve a
  `datos-pendientes` con un mensaje al promotor (notas para él).
- **Reenvío Firmafy** → re-disparo del flujo de firma si caducó.
- **Comentarios internos** → notas del superadmin (no visibles para
  el promotor) para el siguiente que revise.

---

## Listado / inbox

Pantalla principal `/superadmin/verificaciones` con tabs:

1. **Pendientes de Byvaro** (`revision-byvaro`) — TODO list del
   superadmin · ordenadas por antigüedad.
2. **Esperando firma** (`firmafy-pendiente`) — informativo · solo
   monitorización; no requieren acción.
3. **Aprobadas** (`verificada`) — buscable, sirve para auditar.
4. **Rechazadas** (`rechazada`) — para detectar promotores que
   reintentan tras rechazo.

Cada fila: avatar empresa · nombre · CIF · representante · fecha de
solicitud · tabs status · acciones rápidas.

---

## Endpoints (backend)

```http
POST   /api/empresa/verification              # promotor envía solicitud
PATCH  /api/empresa/verification              # promotor actualiza datos
GET    /api/empresa/verification              # promotor consulta su estado

# Superadmin
GET    /api/admin/verifications?status=...    # listado paginado
GET    /api/admin/verifications/:id           # detalle completo
POST   /api/admin/verifications/:id/approve   # body: { internalNote? }
POST   /api/admin/verifications/:id/reject    # body: { motivo, mensaje }
POST   /api/admin/verifications/:id/request-more-docs # body: { mensaje }
POST   /api/admin/verifications/:id/firmafy/resend
```

Webhook entrante:

```
POST /webhooks/firmafy   # firma completada/cancelada/expirada
```

---

## Permisos

- `admin.verifications.view` — superadmin Byvaro · ver listado y
  detalle.
- `admin.verifications.decide` — aprobar / rechazar / pedir más
  docs. Subset estricto del anterior.

Ningún promotor o agencia ve estas rutas. Catálogo en
`docs/permissions.md` cuando se implemente.

---

## RLS / multi-tenant

Esta pantalla cruza datos de TODOS los workspaces · solo accesible al
super-rol Byvaro (no al admin de un workspace). En backend:

```sql
-- pseudo-RLS
CREATE POLICY admin_verifications ON verifications
  FOR ALL
  USING (current_setting('app.role', true) = 'byvaro_superadmin');
```

---

## Notas de producto

- **Firmafy es solo el canal de firma electrónica del documento de
  declaración responsable.** Byvaro hace su propia validación
  manual de documentos (CIF coincide con razón social, identidad
  del representante, presencia en Registro Mercantil) ANTES de
  aprobar. La firma de Firmafy NO es la aprobación.
- **Cuando hay varios firmantes autorizados** se decide caso por
  caso qué documentos firma cada uno. Para la verificación inicial,
  basta con que firme **el representante principal** la declaración
  responsable; los autorizados quedan registrados en el sistema para
  flujos futuros (contratos, comisiones, etc.).
- El estado `verificada=true` es **permanente** — si la empresa
  cambia de razón social o representante, hay que abrir un nuevo
  flujo (no bajar el flag). Esto requiere otra pantalla de
  "Mantenimiento de verificación" que aún no está spec'd.

---

## Shape persistido (ver `src/lib/empresa.ts`)

```ts
interface Empresa {
  // …
  verificada: boolean;
  verificadaEl: string;                     // ISO
  verificacionEstado?:
    | "no-iniciada"
    | "datos-pendientes"
    | "firmafy-pendiente"
    | "revision-byvaro"
    | "verificada"
    | "rechazada";
  verificacionRepresentante?: {
    nombreCompleto: string;
    email: string;
    telefono: string;
    phonePrefix?: string;
  };
  verificacionDocs?: {
    cifEmpresa?:              { name: string; dataUrl: string; uploadedAt: string };
    identidadRepresentante?:  { name: string; dataUrl: string; uploadedAt: string };
  };
  verificacionFirmaUnica?: boolean;
  verificacionAutorizados?: Array<{
    nombreCompleto: string;
    email: string;
    telefono: string;
    phonePrefix?: string;
  }>;
  verificacionSolicitadaEl?: string;        // ISO
}
```

En backend los `dataUrl` se sustituyen por `fileId` (referencia a un
storage tipo S3) y se sirven a través de un endpoint con permisos.
