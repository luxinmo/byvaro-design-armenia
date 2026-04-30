-- =====================================================================
-- Byvaro · seed de promociones externas (AEDAS, Neinor, Habitat,
-- Metrovacesa). Antes vivían SOLO en TS mock · ahora se persisten para
-- que cada promotor tenga sus PROPIAS promociones en BD y no se
-- confunda visualmente con las de Luxinmo.
--
-- Idempotente · re-ejecutable.
-- =====================================================================

insert into public.promotions (
  id, owner_organization_id, owner_role, name, description,
  address, city, country, status, total_units, available_units,
  price_from, price_to, delivery, image_url, can_share_with_agencies
) values
  -- AEDAS Homes (prom-1)
  ('aedas-1', 'prom-1', 'promotor', 'Célere Castellana',
   'Obra nueva en Chamartín · 96 unidades premium',
   null, 'Madrid', 'ES', 'active', 96, 38, 580000, 1400000, 'Q2 2027',
   'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop', true),
  ('aedas-2', 'prom-1', 'promotor', 'Aura Rivas',
   'Residencial en Rivas Vaciamadrid · 142 viviendas',
   null, 'Rivas Vaciamadrid', 'ES', 'active', 142, 17, 320000, 480000, 'Q4 2025',
   'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop', true),

  -- Neinor Homes (prom-2)
  ('neinor-1', 'prom-2', 'promotor', 'Edificio Bilbao Alta',
   'Obra nueva en Abando · últimas unidades',
   null, 'Bilbao', 'ES', 'active', 56, 4, 420000, 950000, 'Q1 2026',
   'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop', true),
  ('neinor-2', 'prom-2', 'promotor', 'Vegas del Saz',
   'Residencial en El Saz, Madrid',
   null, 'Madrid', 'ES', 'active', 82, 22, 290000, 410000, 'Q3 2026',
   'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop', true),

  -- Habitat Inmobiliaria (prom-3)
  ('habitat-1', 'prom-3', 'promotor', 'Habitat Diagonal Mar',
   'Obra nueva en Diagonal Mar, Barcelona',
   null, 'Barcelona', 'ES', 'active', 64, 11, 510000, 1200000, 'Q4 2026',
   'https://images.unsplash.com/photo-1565953522043-baea26b83b7e?w=800&h=600&fit=crop', true),

  -- Metrovacesa (prom-4)
  ('metrovacesa-1', 'prom-4', 'promotor', 'Mirador del Levante',
   'Marina Real, Valencia · 110 unidades',
   null, 'Valencia', 'ES', 'active', 110, 41, 380000, 720000, 'Q3 2027',
   'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop', true),
  ('metrovacesa-2', 'prom-4', 'promotor', 'Skyline Plaza',
   'Cartuja, Sevilla · 88 viviendas premium',
   null, 'Sevilla', 'ES', 'active', 88, 64, 260000, 410000, 'Q2 2027',
   'https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&h=600&fit=crop', true)
on conflict (id) do update set
  owner_organization_id = excluded.owner_organization_id,
  name = excluded.name,
  description = excluded.description,
  city = excluded.city,
  status = excluded.status,
  total_units = excluded.total_units,
  available_units = excluded.available_units,
  price_from = excluded.price_from,
  price_to = excluded.price_to,
  delivery = excluded.delivery,
  image_url = excluded.image_url;

notify pgrst, 'reload schema';
