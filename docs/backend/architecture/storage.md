# Arquitectura · Supabase Storage

> **Regla de oro · NUNCA guardar imágenes/documentos como base64 en
> columnas text de DB.** Toda imagen/archivo del producto sube a un
> bucket de Supabase Storage. Las columnas en DB guardan la URL
> pública (buckets `*-public`) o el path para signed URL (buckets
> privados).

## 1 · Buckets canónicos

Creados en `supabase/migrations/20260502140000_storage_buckets.sql`:

| Bucket | Público? | Tamaño máx | MIME types | Path pattern |
|---|---|---|---|---|
| `org-public` | ✅ | 5 MB | jpg/png/webp/svg | `<org_id>/<entity>/<file>` |
| `promotion-public` | ✅ | 10 MB | jpg/png/webp | `<promotion_id>/<kind>/<file>` |
| `inmueble-public` | ✅ | 10 MB | jpg/png/webp | `<inmueble_id>/<file>` |
| `user-avatars` | ✅ | 2 MB | jpg/png/webp | `<user_id>/<file>` |
| `documents-private` | ❌ | 25 MB | pdf/jpg/png/docx | `<org_id>/<kind>/<file>` |

## 2 · Convención de paths

El **primer segmento** del path es el identificador para RLS:

```
org-public/developer-default/logo/main-1730561234.png
                ^^^^^^^^^^^^^^^^^
                organization_id (RLS check)

promotion-public/dev-1/hero/foto-001.jpg
                 ^^^^^
                 promotion_id (RLS verifica owner_organization_id)

documents-private/ag-1/contract/contrato-abc123.pdf
                  ^^^^
                  organization_id (RLS member-only)

user-avatars/1ae320bb-7aef-.../avatar-1730561234.jpg
             ^^^^^^^^^^^^^^^^^^^
             auth.uid() (RLS self-only)
```

## 3 · RLS policies

### Buckets públicos (`*-public` y `user-avatars`)

- **SELECT** · `bucket_id = '<bucket>'` (cualquier authenticated/anon)
- **INSERT/UPDATE/DELETE** · primer segmento del path debe ser:
  - `org-public` → `is_org_admin(<first_segment>)`
  - `promotion-public` → member del owner_organization_id de la promo
  - `inmueble-public` → member del organization_id del inmueble
  - `user-avatars` → `auth.uid()::text == <first_segment>`

### Bucket privado (`documents-private`)

- **SELECT** · `is_org_member(<first_segment>)` (solo members del org)
- **INSERT/UPDATE/DELETE** · idem

## 4 · Helper canónico · `src/lib/storage.ts`

NUNCA llames `supabase.storage.upload()` directo desde componentes.
Usa los helpers tipados:

```ts
import {
  uploadOrgLogo,
  uploadOrgCover,
  uploadOfficeLogo,
  uploadPromotionImage,
  uploadInmueblePhoto,
  uploadUserAvatar,
  uploadDocument,
  signedUrl,
  deleteFile,
} from "@/lib/storage";

// Subir logo de empresa · resize automático a 400px + JPEG quality 0.92
const url = await uploadOrgLogo(orgId, file);
// url = https://crcunocacqjqccbzmxwf.supabase.co/storage/v1/object/public/org-public/developer-default/logo/main-1730561234.jpg
update("logoUrl", url);

// Subir documento privado · devuelve path + función para signed URL
const { path, getSignedUrl } = await uploadDocument(orgId, "contract", file, "contrato.pdf");
const tempUrl = await getSignedUrl(3600); // 1h expiration
window.open(tempUrl);
```

Los helpers **automáticamente**:

- Comprimen imágenes (canvas resize + JPEG quality)
- Generan paths con timestamp para evitar colisiones
- Manejan errores de RLS / red con throw informativo
- Aplican `upsert: true` por defecto (excepto documentos)

## 5 · Patrón canónico al integrar uploads

```tsx
import { uploadOrgLogo } from "@/lib/storage";
import { toast } from "sonner";

async function handleLogoUpload(file: File) {
  /* 1. Optimistic local · preview con object URL antes del upload. */
  const localPreview = URL.createObjectURL(file);
  setLogoUrl(localPreview);

  try {
    /* 2. Upload al bucket · helper canónico aplica resize+RLS. */
    const publicUrl = await uploadOrgLogo(orgId, file);
    URL.revokeObjectURL(localPreview);

    /* 3. Persistir URL pública en DB. */
    setLogoUrl(publicUrl);
    /* saveEmpresaForOrg → organizations.logo_url = publicUrl */
  } catch (e) {
    URL.revokeObjectURL(localPreview);
    setLogoUrl(""); // revertir optimistic
    toast.error("No se pudo subir la imagen", {
      description: e instanceof Error ? e.message : "Reintenta",
    });
  }
}
```

## 6 · Caller migrados (al 2026-05-02)

| Componente | Caller | Bucket |
|---|---|---|
| `Empresa.tsx` (logo + cover) | `handleApplyImage` | org-public |
| `OfficesSection.tsx` (logo oficina) | `handleCoverUpload` | org-public |
| `personal.tsx` (avatar user) | `<PhotoCropModal onSave>` | user-avatars |

## 7 · Pendientes (TODO al añadir feature)

- `MemberFormDialog.tsx` · avatar de team members editado por admin (bucket `user-avatars` con path `<member_user_id>/avatar.jpg` · requires admin permission for that user's avatar)
- `ContactoDetalle.tsx` · avatar de contacto (bucket nuevo `contact-avatars`?)
- `EmpresaAboutTab.tsx` · galería de promociones (bucket `promotion-public`)
- `UploadDocumentDialog.tsx` · documentos de contacto (bucket `documents-private`)
- `ContactWhatsAppTab.tsx` · attachments de WhatsApp (bucket nuevo `whatsapp-attachments`?)
- Migrar `inmuebles.photos` jsonb · cambiar URLs Unsplash a uploads propios

## 8 · Migrar imágenes seed (opcional)

Las imágenes seed actuales son URLs de Unsplash. Si quieres
independencia de Unsplash:

```bash
node scripts/migrate-unsplash-to-storage.mjs
# Descarga cada URL, sube a promotion-public/<id>/hero/seed.jpg
# Actualiza promotions.image_url con la URL local
```

(Script no creado todavía · se hace cuando aterrice phase 2.)

## 9 · Anti-patterns prohibidos

- ❌ `FileReader.readAsDataURL` + guardar dataURL en DB (rompe escalabilidad)
- ❌ `supabase.storage.from()` directo en componentes (saltarse el helper)
- ❌ Path sin organization_id como primer segmento (rompe RLS)
- ❌ Subir sin compresión imágenes >2MB (lento, caro)
- ❌ Usar bucket `*-public` para datos sensibles (cualquiera lee)
- ❌ Hardcodear URLs externas (Unsplash, Cloudinary) en seeds nuevos

## 10 · Verificación

```bash
# Bucket creado:
psql "$SUPABASE_DB_URL" -c "SELECT id, public, file_size_limit FROM storage.buckets;"

# Policies aplicadas:
psql "$SUPABASE_DB_URL" -c "SELECT polname FROM pg_policy WHERE polrelid='storage.objects'::regclass;"

# Test upload (login + admin):
node scripts/test-storage-buckets.mjs # (script pendiente · ver test E2E)
```
