/* ════════════════════════════════════════════════════════════════════
 * 20260502 · Supabase Storage buckets · imágenes y documentos
 *
 * Reemplaza el patrón actual `FileReader.readAsDataURL → DB text
 * column` por uploads reales a Supabase Storage. Cada bucket tiene su
 * propósito + RLS apropiado.
 *
 * Convención de paths:
 *   <bucket>/<organization_id>/<entidad>/<id>.<ext>
 *   Ejemplo · org-public/ag-1/logo/main.png
 *           · promotion-public/dev-1/gallery/foto-001.jpg
 *           · documents-private/dev-1/contracts/contract-abc123.pdf
 *
 * Las RLS de storage.objects aplican a operaciones INSERT/UPDATE/DELETE
 * basadas en el primer segmento del path (organization_id). Para SELECT,
 * los buckets *-public son read-by-anyone (necesario para microsites,
 * directorio, ficha pública). Los *-private requieren membership.
 * ════════════════════════════════════════════════════════════════════ */

/* ══════ 1. Crear buckets ════════════════════════════════════════════ */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  /* Imágenes públicas de organizaciones · logo, cover, oficina logo. */
  ('org-public', 'org-public', true, 5242880,                    -- 5 MB
    array['image/jpeg','image/png','image/webp','image/svg+xml']),

  /* Imágenes públicas de promociones · hero, galería, fotos unidades.
   *  Caben más MB porque renderizan en microsite. */
  ('promotion-public', 'promotion-public', true, 10485760,       -- 10 MB
    array['image/jpeg','image/png','image/webp']),

  /* Fotos de inmuebles (cartera segunda mano · inmuebles.photos jsonb). */
  ('inmueble-public', 'inmueble-public', true, 10485760,         -- 10 MB
    array['image/jpeg','image/png','image/webp']),

  /* Avatares de usuarios · per-user. Path: user-avatars/<user_id>/avatar.jpg */
  ('user-avatars', 'user-avatars', true, 2097152,                -- 2 MB
    array['image/jpeg','image/png','image/webp']),

  /* Documentos privados · contratos, facturas, licencias. RLS por
   *  organization_id. Path: documents-private/<org_id>/<kind>/<file>.pdf */
  ('documents-private', 'documents-private', false, 26214400,    -- 25 MB
    array['application/pdf','image/jpeg','image/png',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

/* ══════ 2. Policies en storage.objects ════════════════════════════════
 *
 * Convención · primer segmento del path = organization_id (excepto
 * user-avatars que usa user_id). Las policies parsean
 * `(storage.foldername(name))[1]` para extraerlo.
 * ──────────────────────────────────────────────────────────────────── */

/* Limpiar policies viejas si re-corremos */
drop policy if exists "org_public_select" on storage.objects;
drop policy if exists "org_public_write_admin" on storage.objects;
drop policy if exists "promotion_public_select" on storage.objects;
drop policy if exists "promotion_public_write_member" on storage.objects;
drop policy if exists "inmueble_public_select" on storage.objects;
drop policy if exists "inmueble_public_write_member" on storage.objects;
drop policy if exists "user_avatars_select" on storage.objects;
drop policy if exists "user_avatars_write_self" on storage.objects;
drop policy if exists "documents_private_select" on storage.objects;
drop policy if exists "documents_private_write_member" on storage.objects;

/* ─── org-public · cualquier authenticated/anon lee · admin del org escribe ─ */
create policy "org_public_select"
  on storage.objects for select
  using (bucket_id = 'org-public');

create policy "org_public_write_admin"
  on storage.objects for all
  using (
    bucket_id = 'org-public'
    and public.is_org_admin((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'org-public'
    and public.is_org_admin((storage.foldername(name))[1])
  );

/* ─── promotion-public · lectura pública · member del owner_org escribe ─ */
create policy "promotion_public_select"
  on storage.objects for select
  using (bucket_id = 'promotion-public');

/* IMPORTANTE · alias `promo` (no `p`) para no sombrear el `name`
 *  del outer `storage.objects` al usar `storage.foldername(name)`.
 *  Bug previo · alias `p` hacía que `(storage.foldername(p.name))[1]`
 *  parseara el name de la PROMO en lugar del path del archivo. */
create policy "promotion_public_write_member"
  on storage.objects for all
  using (
    bucket_id = 'promotion-public'
    and exists (
      select 1 from public.promotions promo
      where promo.id = (storage.foldername(storage.objects.name))[1]
        and public.is_org_member(promo.owner_organization_id)
    )
  )
  with check (
    bucket_id = 'promotion-public'
    and exists (
      select 1 from public.promotions promo
      where promo.id = (storage.foldername(storage.objects.name))[1]
        and public.is_org_member(promo.owner_organization_id)
    )
  );

/* ─── inmueble-public · lectura pública · member del org escribe ─ */
create policy "inmueble_public_select"
  on storage.objects for select
  using (bucket_id = 'inmueble-public');

/* Mismo cuidado con el alias · `inm` (no `i`) para no chocar con
 *  `storage.objects.name` en `storage.foldername`. */
create policy "inmueble_public_write_member"
  on storage.objects for all
  using (
    bucket_id = 'inmueble-public'
    and exists (
      select 1 from public.inmuebles inm
      where inm.id = (storage.foldername(storage.objects.name))[1]
        and public.is_org_member(inm.organization_id)
    )
  )
  with check (
    bucket_id = 'inmueble-public'
    and exists (
      select 1 from public.inmuebles inm
      where inm.id = (storage.foldername(storage.objects.name))[1]
        and public.is_org_member(inm.organization_id)
    )
  );

/* ─── user-avatars · lectura pública · cada user escribe SU avatar ─ */
create policy "user_avatars_select"
  on storage.objects for select
  using (bucket_id = 'user-avatars');

create policy "user_avatars_write_self"
  on storage.objects for all
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

/* ─── documents-private · ambos lados de la colaboración leen/escriben ─
 * Path: documents-private/<org_id>/<kind>/<file>. El primer segmento
 * es el org dueño · members del org pueden leer/escribir. Las
 * colaboraciones cross-tenant que necesiten acceso compartido pasan
 * por endpoints específicos (ej. GET /api/contracts/:id/file que devuelve
 * signed URL temporal). */
create policy "documents_private_select"
  on storage.objects for select
  using (
    bucket_id = 'documents-private'
    and public.is_org_member((storage.foldername(name))[1])
  );

create policy "documents_private_write_member"
  on storage.objects for all
  using (
    bucket_id = 'documents-private'
    and public.is_org_member((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'documents-private'
    and public.is_org_member((storage.foldername(name))[1])
  );
