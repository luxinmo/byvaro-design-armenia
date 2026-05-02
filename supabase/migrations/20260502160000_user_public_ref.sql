/* ════════════════════════════════════════════════════════════════════
 * 20260502 · User public_ref · `USXXXXXXX` (7 dígitos)
 *
 * Cumple el scheme canónico de CLAUDE.md:
 *   Usuario · prefijo "US" · 7 dígitos · espacio 10M · aleatorio.
 *
 * Como `auth.users` es schema gestionado por Supabase y no podemos
 * añadirle columnas custom de forma limpia, creamos una tabla satélite
 * `public.user_profiles` 1:1 con auth.users que aloja:
 *   · public_ref (USXXXXXXX · inmutable · auto-generado)
 *   · full_name, avatar_url (cache de campos del JWT/storage)
 *   · job_title, department, languages, bio (proyección global · los
 *     equivalentes en `organization_members` son per-org)
 *
 * Las URLs de equipo y perfil pasan a usar `public_ref` en vez del UUID:
 *   /equipo/USXXXXXXX  (en vez de /equipo/<uuid>)
 *   /ajustes/perfil/personal  (no usa el UUID en la URL · self-only)
 *
 * RLS · SELECT público (directorio) · UPDATE solo el propio user.
 * ════════════════════════════════════════════════════════════════════ */

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_ref text unique not null,
  full_name text,
  avatar_url text,
  job_title text,
  department text,
  languages text[],
  bio text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_public_ref on public.user_profiles(public_ref);

alter table public.user_profiles enable row level security;

/* SELECT público · directorio de usuarios visible (cualquier
 *  authenticated puede ver nombre + avatar + ref). Esto es coherente
 *  con `organizations` y `organization_profiles` que también
 *  exponen el directorio. */
drop policy if exists "user_profiles_select_public" on public.user_profiles;
create policy "user_profiles_select_public"
  on public.user_profiles for select
  using (true);

/* INSERT/UPDATE solo el propio user · cada cuenta gestiona su perfil. */
drop policy if exists "user_profiles_self_write" on public.user_profiles;
create policy "user_profiles_self_write"
  on public.user_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

/* ══════ Generador de public_ref · USXXXXXXX ══════════════════════════
 * Mismo patrón que gen_tenant_public_ref · loop hasta hallar un ref
 * libre · solo dígitos para legibilidad humana (sin O/0/I/1
 * ambigüedad porque son números). */
create or replace function public.gen_user_public_ref()
returns text
language plpgsql
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  loop
    candidate := 'US' || lpad(floor(random() * 10000000)::text, 7, '0');
    if not exists (select 1 from public.user_profiles where public_ref = candidate) then
      return candidate;
    end if;
    attempts := attempts + 1;
    if attempts > 50 then
      /* Fallback · muy improbable en espacio 10M · usar timestamp */
      return 'US' || lpad((extract(epoch from now())::bigint % 10000000)::text, 7, '0');
    end if;
  end loop;
end;
$$;

/* Trigger · auto-rellena public_ref al INSERT si no se especifica. */
create or replace function public.user_profiles_set_public_ref()
returns trigger language plpgsql as $$
begin
  if NEW.public_ref is null or NEW.public_ref = '' then
    NEW.public_ref := public.gen_user_public_ref();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_user_profiles_set_public_ref on public.user_profiles;
create trigger trg_user_profiles_set_public_ref
  before insert on public.user_profiles
  for each row execute function public.user_profiles_set_public_ref();

/* Trigger · public_ref es INMUTABLE · rechaza UPDATE que la cambie. */
create or replace function public.user_profiles_protect_public_ref()
returns trigger language plpgsql as $$
begin
  if OLD.public_ref is not null and NEW.public_ref is distinct from OLD.public_ref then
    raise exception 'user_profiles.public_ref es inmutable · no se puede modificar';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_user_profiles_protect_public_ref on public.user_profiles;
create trigger trg_user_profiles_protect_public_ref
  before update on public.user_profiles
  for each row execute function public.user_profiles_protect_public_ref();

/* Trigger · touch_updated_at */
drop trigger if exists trg_touch_user_profiles on public.user_profiles;
create trigger trg_touch_user_profiles
  before update on public.user_profiles
  for each row execute function public.touch_updated_at();

/* ══════ Backfill · todos los users en auth.users sin row aún ════════ */
insert into public.user_profiles (user_id, full_name, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  null
from auth.users u
where not exists (
  select 1 from public.user_profiles up where up.user_id = u.id
);

/* ══════ RPC · find_user_by_ref(public_ref) ════════════════════════════
 *  Equivalente a find_org_by_ref. Permite resolver un user por su
 *  publicRef sin exponer el UUID interno. Devuelve solo campos safe
 *  del directorio. */
create or replace function public.find_user_by_ref(p_ref text)
returns table(
  user_id uuid,
  public_ref text,
  full_name text,
  avatar_url text,
  job_title text
)
language sql stable security definer
set search_path to public, pg_catalog
as $$
  select up.user_id, up.public_ref, up.full_name, up.avatar_url, up.job_title
  from public.user_profiles up
  where up.public_ref = upper(p_ref)
  limit 1;
$$;
revoke all on function public.find_user_by_ref(text) from public;
grant execute on function public.find_user_by_ref(text) to authenticated, anon;

/* ══════ Bridge view en api schema ═══════════════════════════════════ */
drop view if exists api.user_profiles cascade;
create view api.user_profiles with (security_invoker = on) as
  select * from public.user_profiles;
grant select, insert, update on api.user_profiles to authenticated;

drop view if exists api.user_directory cascade;
create view api.user_directory with (security_invoker = on) as
  select user_id, public_ref, full_name, avatar_url, job_title
  from public.user_profiles;
grant select on api.user_directory to authenticated, anon;
