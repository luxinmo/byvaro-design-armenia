/**
 * lib/storage.ts · Helper canónico de upload a Supabase Storage.
 *
 * REGLA DE ORO · NUNCA guardar imágenes como base64 en columnas
 * text de DB. Toda imagen/documento sube a un bucket de Supabase
 * Storage y la columna en DB guarda la URL pública (o el path para
 * archivos privados con signed URL).
 *
 * BUCKETS CANÓNICOS (creados en migración 20260502140000):
 *   · org-public          · logos, covers, oficinas (público lectura)
 *   · promotion-public    · imágenes y galería de promociones (público)
 *   · inmueble-public     · fotos de inmuebles cartera (público)
 *   · user-avatars        · avatares de usuarios (público)
 *   · documents-private   · contratos, facturas, licencias (RLS member-only)
 *
 * CONVENCIÓN DE PATHS · primer segmento = identificador para RLS:
 *   org-public/<organization_id>/<entity>/<file>
 *   promotion-public/<promotion_id>/<entity>/<file>
 *   inmueble-public/<inmueble_id>/<entity>/<file>
 *   user-avatars/<user_id>/<file>
 *   documents-private/<organization_id>/<kind>/<file>
 *
 * COMPRESIÓN AUTOMÁTICA · imágenes pasan por canvas resize antes de
 * subir. maxWidth default 1600px · quality 0.85. Los logos se
 * recortan y comprimen mucho más (max 400px · 0.92).
 */

import { supabase, isSupabaseConfigured } from "./supabaseClient";

export type StorageBucket =
  | "org-public"
  | "promotion-public"
  | "inmueble-public"
  | "user-avatars"
  | "documents-private";

export interface UploadOpts {
  /** Bucket destino. */
  bucket: StorageBucket;
  /** Path relativo al bucket · `<org_id>/<entity>/<file>.ext` */
  path: string;
  /** Archivo o blob a subir. */
  file: File | Blob;
  /** Resize opcional · solo aplica a imágenes. Default 1600px. */
  maxWidth?: number;
  /** Calidad JPEG/WEBP · 0..1. Default 0.85. */
  quality?: number;
  /** Si true · sobreescribe archivo existente con mismo path. */
  upsert?: boolean;
}

export interface UploadResult {
  /** URL pública (solo buckets `*-public`) o path para signed URL. */
  url: string;
  /** Path relativo dentro del bucket · útil para borrar / regenerar URL. */
  path: string;
  /** Bucket donde quedó. */
  bucket: StorageBucket;
}

/* ══════ Resize en canvas ════════════════════════════════════════════ */

async function resizeImage(file: File | Blob, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas 2d context unavailable")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("canvas.toBlob failed")),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image load failed")); };
    img.src = url;
  });
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/") && mime !== "image/svg+xml" && mime !== "image/gif";
}

/* ══════ API pública ══════════════════════════════════════════════════ */

/** Sube un archivo a Supabase Storage · retorna URL pública.
 *
 * @throws Error si Supabase no está configurado o el upload falla.
 */
export async function uploadFile(opts: UploadOpts): Promise<UploadResult> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase no está configurado · upload deshabilitado");
  }

  const { bucket, path, file, upsert = true } = opts;
  let body: File | Blob = file;

  /* Compresión automática para imágenes · NO para PDF/SVG. */
  if (file.type && isImage(file.type)) {
    const maxWidth = opts.maxWidth ?? 1600;
    const quality = opts.quality ?? 0.85;
    try {
      body = await resizeImage(file, maxWidth, quality);
    } catch (e) {
      console.warn("[storage] resize failed · subiendo original:", e);
    }
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, {
      upsert,
      contentType: file.type || "application/octet-stream",
    });

  if (error) throw new Error(`[storage:${bucket}] upload failed: ${error.message}`);

  /* Buckets públicos · URL pública directa. Privados · path raw para
   *  generar signed URL bajo demanda. */
  if (bucket.endsWith("-public") || bucket === "user-avatars") {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path, bucket };
  }

  /* documents-private · devolvemos el path. Quien quiera servirlo
   *  llama a `signedUrl(bucket, path)` con expiración corta. */
  return { url: path, path, bucket };
}

/** Genera signed URL temporal (default 1h) para un archivo privado. */
export async function signedUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.warn(`[storage:${bucket}] signed URL failed:`, error.message);
    return null;
  }
  return data.signedUrl;
}

/** Borra un archivo. Best-effort · errores se loggean. */
export async function deleteFile(bucket: StorageBucket, path: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.warn(`[storage:${bucket}] delete failed:`, error.message);
}

/* ══════ Conveniencia · upload imagen + retorna URL ════════════════════ */

/** Sube logo de empresa. Path: org-public/<org_id>/logo/main.<ext> */
export async function uploadOrgLogo(orgId: string, file: File | Blob): Promise<string> {
  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const result = await uploadFile({
    bucket: "org-public",
    path: `${orgId}/logo/main-${Date.now()}.${ext}`,
    file,
    maxWidth: 400,
    quality: 0.92,
  });
  return result.url;
}

/** Sube cover de empresa. Path: org-public/<org_id>/cover/main.<ext> */
export async function uploadOrgCover(orgId: string, file: File | Blob): Promise<string> {
  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const result = await uploadFile({
    bucket: "org-public",
    path: `${orgId}/cover/main-${Date.now()}.${ext}`,
    file,
    maxWidth: 1920,
    quality: 0.85,
  });
  return result.url;
}

/** Sube logo de oficina. Path: org-public/<org_id>/offices/<office_id>/logo.<ext> */
export async function uploadOfficeLogo(orgId: string, officeId: string, file: File | Blob): Promise<string> {
  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const result = await uploadFile({
    bucket: "org-public",
    path: `${orgId}/offices/${officeId}/logo-${Date.now()}.${ext}`,
    file,
    maxWidth: 400,
    quality: 0.92,
  });
  return result.url;
}

/** Sube imagen de promoción (hero o galería).
 *  Path: promotion-public/<promo_id>/<kind>/<filename> */
export async function uploadPromotionImage(
  promotionId: string,
  file: File | Blob,
  kind: "hero" | "gallery" | "unit" = "hero",
): Promise<string> {
  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const result = await uploadFile({
    bucket: "promotion-public",
    path: `${promotionId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
    file,
    maxWidth: 1920,
    quality: 0.85,
  });
  return result.url;
}

/** Sube foto de inmueble. Path: inmueble-public/<inmueble_id>/photo-N.<ext> */
export async function uploadInmueblePhoto(inmuebleId: string, file: File | Blob): Promise<string> {
  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const result = await uploadFile({
    bucket: "inmueble-public",
    path: `${inmuebleId}/photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
    file,
    maxWidth: 1920,
    quality: 0.85,
  });
  return result.url;
}

/** Sube avatar del user. Path: user-avatars/<user_id>/avatar.<ext> */
export async function uploadUserAvatar(userId: string, file: File | Blob): Promise<string> {
  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const result = await uploadFile({
    bucket: "user-avatars",
    path: `${userId}/avatar-${Date.now()}.${ext}`,
    file,
    maxWidth: 400,
    quality: 0.92,
  });
  return result.url;
}

/** Borra todos los avatares previos del user EXCEPTO el path indicado.
 *  Útil tras subir uno nuevo · evita acumular blobs huérfanos en el
 *  bucket. Best-effort · errores se loggean. */
export async function pruneUserAvatars(userId: string, keepPath?: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data, error } = await supabase.storage.from("user-avatars").list(userId, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) {
      console.warn("[storage:user-avatars] list failed:", error.message);
      return;
    }
    if (!data || data.length === 0) return;
    const targets = data
      .map((f) => `${userId}/${f.name}`)
      .filter((p) => p !== keepPath);
    if (targets.length === 0) return;
    const { error: rmErr } = await supabase.storage.from("user-avatars").remove(targets);
    if (rmErr) console.warn("[storage:user-avatars] prune failed:", rmErr.message);
  } catch (e) {
    console.warn("[storage:user-avatars] prune exception:", e);
  }
}

/** Sube documento privado · contrato, factura, licencia.
 *  Path: documents-private/<org_id>/<kind>/<filename> */
export async function uploadDocument(
  orgId: string,
  kind: "contract" | "invoice" | "license" | "doc-request" | "other",
  file: File | Blob,
  filename?: string,
): Promise<{ path: string; getSignedUrl: (expiresIn?: number) => Promise<string | null> }> {
  const ext = filename?.split(".").pop()
    ?? (file.type.split("/")[1] || "pdf").replace("jpeg", "jpg");
  const safeName = filename
    ? filename.replace(/[^a-zA-Z0-9._-]/g, "_")
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const result = await uploadFile({
    bucket: "documents-private",
    path: `${orgId}/${kind}/${safeName}`,
    file,
    upsert: false,
  });
  return {
    path: result.path,
    getSignedUrl: (expiresIn = 3600) => signedUrl("documents-private", result.path, expiresIn),
  };
}
