/* ════════════════════════════════════════════════════════════════════
 * Storage · permitir uploads a `promotion-public` bajo el id de un
 * borrador en curso (no solo de promociones ya creadas).
 *
 * CONTEXTO · los uploads del wizard (paso multimedia) usan el id del
 * draft como primer folder del path · ej:
 *     promotion-public/d-PR96691/gallery/1234.jpg
 *
 * La policy original (`promotion_public_write_member` ·
 * `20260502140000_storage_buckets.sql`) exigía que el primer folder
 * fuese un id de `public.promotions` Y el user fuera miembro de su
 * org. Como los drafts NO viven en `promotions`, los uploads se
 * rechazaban con `new row violates row-level security policy`.
 *
 * FIX · ampliar la policy para que ALSO acepte si el primer folder
 * es un id de `public.promotion_drafts` cuyo `user_id` coincide con
 * el `auth.uid()` actual. El user solo puede subir a SUS propios
 * drafts · no a los de otros.
 *
 * Cuando el draft pasa a promoción real (publish), las imágenes se
 * quedan en su path actual `d-PR.../gallery/...` · no se mueven · la
 * promoción referencia las URLs públicas existentes. La policy de
 * SELECT (lectura pública) ya cubre ambos casos sin cambios.
 * ════════════════════════════════════════════════════════════════════ */

drop policy if exists "promotion_public_write_member" on storage.objects;

create policy "promotion_public_write_member"
  on storage.objects for all
  using (
    bucket_id = 'promotion-public'
    and (
      /* Promoción ya creada · user es miembro de su org. */
      exists (
        select 1 from public.promotions promo
        where promo.id = (storage.foldername(storage.objects.name))[1]
          and public.is_org_member(promo.owner_organization_id)
      )
      /* O bien · borrador en curso del propio user. */
      or exists (
        select 1 from public.promotion_drafts d
        where d.id = (storage.foldername(storage.objects.name))[1]
          and d.user_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'promotion-public'
    and (
      exists (
        select 1 from public.promotions promo
        where promo.id = (storage.foldername(storage.objects.name))[1]
          and public.is_org_member(promo.owner_organization_id)
      )
      or exists (
        select 1 from public.promotion_drafts d
        where d.id = (storage.foldername(storage.objects.name))[1]
          and d.user_id = auth.uid()
      )
    )
  );
