-- =====================================================================
-- Byvaro · permitir anon SELECT en tablas catálogo
-- ---------------------------------------------------------------------
-- En el sistema nuevo de keys de Supabase (sb_publishable_*), el cliente
-- supabase-js puede en algunos casos enviar la publishable key como
-- Authorization Bearer en lugar del JWT del usuario · esto hace que las
-- peticiones lleguen como rol `anon` aunque el user esté logueado.
-- Permitimos anon SELECT en organizations / profiles / offices /
-- promotions y promotion_* (catálogo público) · escrituras siguen
-- requiriendo authenticated + ser admin del workspace.
-- =====================================================================

drop policy if exists orgs_select_authenticated on public.organizations;
create policy orgs_select_public on public.organizations
  for select to anon, authenticated using (true);

drop policy if exists profiles_select_authenticated on public.organization_profiles;
create policy profiles_select_public on public.organization_profiles
  for select to anon, authenticated using (true);

drop policy if exists offices_select_authenticated on public.offices;
create policy offices_select_public on public.offices
  for select to anon, authenticated using (true);

drop policy if exists promotions_select_authenticated on public.promotions;
create policy promotions_select_public on public.promotions
  for select to anon, authenticated using (true);

drop policy if exists units_select on public.promotion_units;
create policy units_select_public on public.promotion_units
  for select to anon, authenticated using (true);
drop policy if exists anejos_select on public.promotion_anejos;
create policy anejos_select_public on public.promotion_anejos
  for select to anon, authenticated using (true);
drop policy if exists gallery_select on public.promotion_gallery;
create policy gallery_select_public on public.promotion_gallery
  for select to anon, authenticated using (true);
drop policy if exists ppplans_select on public.payment_plans;
create policy ppplans_select_public on public.payment_plans
  for select to anon, authenticated using (true);

-- Schema permissions · anon/authenticated necesitan USAGE en api y
-- SELECT en las views + tables. Idempotente.
grant usage on schema api, public to anon, authenticated, service_role;
grant select on all tables in schema api to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated, service_role;
grant insert, update, delete on all tables in schema public to authenticated, service_role;
grant insert, update, delete on all tables in schema api to authenticated, service_role;

notify pgrst, 'reload schema';
