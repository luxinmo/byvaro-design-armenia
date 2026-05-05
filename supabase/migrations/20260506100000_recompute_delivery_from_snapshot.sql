-- ════════════════════════════════════════════════════════════════════
-- Migración · Recomputar `promotions.delivery` desde wizardSnapshot
-- ════════════════════════════════════════════════════════════════════
--
-- CONTEXTO
-- ─────────
-- Promociones creadas antes del PR #112 tienen `delivery` con valor
-- stale: el helper `composeDelivery` de TS priorizaba `trimestreEntrega`
-- sobre `tipoEntrega` · cuando el promotor cambiaba de tipo "trimestre"
-- a "tras_licencia" en el wizard, el campo `trimestreEntrega` quedaba
-- residual y "ganaba" sobre la elección real (`tipoEntrega`).
--
-- Resultado · una promo configurada como "12 meses tras licencia" tenía
-- en DB `delivery="T2 2026"`. La ficha (`/promociones/:id`), el listado,
-- el panel agencia, los emails y el microsite mostraban ese valor stale.
--
-- El PR #113 introdujo `resolveDelivery(p)` en TS que recomputa al render
-- desde `metadata.wizardSnapshot` · pero los emails y consumidores que
-- leen la columna `delivery` directo de DB siguen leyendo el valor mal
-- guardado. Esta migración los arregla in-place.
--
-- LÓGICA · misma que `composeDelivery` en TS:
--   tipoEntrega="fecha"            → fechaEntrega
--   tipoEntrega="trimestre"        → trimestreEntrega
--   tipoEntrega="tras_contrato_cv" → "CPV + Nm" (o "Tras CPV")
--   tipoEntrega="tras_licencia"    → "Lic. + Nm" (o "Tras licencia")
--   sin tipoEntrega                → fechaEntrega ?? trimestreEntrega ?? ""
--
-- IDEMPOTENTE · re-ejecutar la migración no causa daño · cada UPDATE
-- recompone desde el snapshot · si el snapshot no existe la fila se
-- salta (NULL) · si ya está bien queda igual.
-- ════════════════════════════════════════════════════════════════════

-- Función helper que replica `composeDelivery` de TS · stable, sin
-- side effects · puede llamarse desde el UPDATE.
create or replace function public.compose_delivery_from_snapshot(snap jsonb)
returns text
language plpgsql
stable
as $$
declare
  v_tipo            text;
  v_fecha           text;
  v_trimestre       text;
  v_meses_contrato  int;
  v_meses_licencia  int;
begin
  if snap is null then
    return null;
  end if;

  v_tipo            := snap ->> 'tipoEntrega';
  v_fecha           := nullif(trim(snap ->> 'fechaEntrega'), '');
  v_trimestre       := nullif(trim(snap ->> 'trimestreEntrega'), '');
  v_meses_contrato  := coalesce((snap ->> 'mesesTrasContrato')::int, 0);
  v_meses_licencia  := coalesce((snap ->> 'mesesTrasLicencia')::int, 0);

  -- Prioridad canónica · `tipoEntrega` manda cuando está set.
  if v_tipo = 'fecha' then
    return v_fecha;
  end if;
  if v_tipo = 'trimestre' then
    return v_trimestre;
  end if;
  if v_tipo = 'tras_contrato_cv' then
    return case when v_meses_contrato > 0
      then 'CPV + ' || v_meses_contrato || 'm'
      else 'Tras CPV'
    end;
  end if;
  if v_tipo = 'tras_licencia' then
    return case when v_meses_licencia > 0
      then 'Lic. + ' || v_meses_licencia || 'm'
      else 'Tras licencia'
    end;
  end if;

  -- Fallback · sin tipoEntrega (drafts legacy) · usa lo que haya.
  return coalesce(v_fecha, v_trimestre, '');
end;
$$;

-- Recompose · update SOLO de filas donde:
--   1. `metadata->wizardSnapshot` existe (sino no podemos recomputar)
--   2. el delivery resultante difiere del actual (no-op si ya bien)
update public.promotions p
set delivery = nullif(
  public.compose_delivery_from_snapshot(p.metadata -> 'wizardSnapshot'),
  ''
)
where (p.metadata -> 'wizardSnapshot') is not null
  and coalesce(p.delivery, '') is distinct from coalesce(
    public.compose_delivery_from_snapshot(p.metadata -> 'wizardSnapshot'),
    ''
  );

-- Notify · cuántas filas se actualizaron (visible en logs de migración).
do $$
declare
  c bigint;
begin
  select count(*) into c
  from public.promotions
  where (metadata -> 'wizardSnapshot') is not null;
  raise notice 'compose_delivery: % filas con wizardSnapshot procesadas', c;
end;
$$;

-- Helper queda en el schema · útil para futuras hidrataciones server-side
-- (RPC, triggers de BEFORE UPDATE para auto-recomputar al editar, etc.).
-- Si en el futuro se prefiere quitarla, basta con:
--   drop function public.compose_delivery_from_snapshot(jsonb);
