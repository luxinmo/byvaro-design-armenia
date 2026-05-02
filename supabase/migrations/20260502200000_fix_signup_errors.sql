/* ════════════════════════════════════════════════════════════════════
 * 20260502 · Fix errores tras signup
 *
 * 1. promotions · revertir column-level GRANT que rompía SELECT *.
 *    Mantener SELECT general · privacy de private_metadata se enforce
 *    via RLS por fila (no por columna · era inviable).
 *
 * 2. org_settings · alinear shape con frontend · de {data jsonb} a
 *    {key, value} con PK compuesta. Lo que tenía era un shape mal.
 *
 * 3. list_promotion_private_metadata · crear alias en public para que
 *    el cliente Supabase JS lo encuentre via rpc('name').
 * ════════════════════════════════════════════════════════════════════ */

/* ─── 1. Restaurar SELECT en promotions ─────────────────────────────── */
grant select on public.promotions to authenticated, anon;
grant insert, update, delete on public.promotions to authenticated;

/* ─── 2. org_settings · migrar shape ───────────────────────────────── */
/* Si tabla tiene shape viejo (data jsonb · sin key) la rehago. */
do $$
declare
  has_key_col boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='org_settings'
      and column_name='key'
  ) into has_key_col;

  if not has_key_col then
    drop table public.org_settings cascade;
    create table public.org_settings (
      organization_id text not null references public.organizations(id) on delete cascade,
      key text not null,
      value jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now(),
      primary key (organization_id, key)
    );
    create index idx_org_settings_key on public.org_settings(key);
    alter table public.org_settings enable row level security;
    create policy "org_settings_select_member"
      on public.org_settings for select
      using (public.is_org_member(organization_id));
    create policy "org_settings_write_member"
      on public.org_settings for all
      using (public.is_org_member(organization_id))
      with check (public.is_org_member(organization_id));
    grant select, insert, update, delete on public.org_settings to authenticated;
  end if;
end $$;

/* ─── 3. RPC list_promotion_private_metadata en schema public ────── */
create or replace function public.list_promotion_private_metadata()
returns table(promotion_id text, private_metadata jsonb)
language sql security definer
set search_path = public, pg_catalog
as $$
  select pm.id, pm.private_metadata
  from public.promotions pm
  where
    public.is_org_member(pm.owner_organization_id)
    or exists (
      select 1 from public.promotion_collaborations pc
      where pc.promotion_id = pm.id
        and pc.status in ('active', 'paused', 'pending_contract')
        and public.is_org_member(pc.agency_organization_id)
    );
$$;
revoke all on function public.list_promotion_private_metadata() from public;
grant execute on function public.list_promotion_private_metadata() to authenticated;
