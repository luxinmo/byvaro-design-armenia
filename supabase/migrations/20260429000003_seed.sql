-- ===================================================================
-- AUTO-GENERATED · do not edit manually.
-- Source: scripts/generate-supabase-seed.ts
-- Run `npm run seed:gen` to regenerate.
-- ===================================================================

-- Limpiamos antes para que el seed sea idempotente al re-ejecutar.
delete from public.collaboration_documents;
delete from public.promotion_collaborations;
delete from public.organization_collaborations;
delete from public.collab_requests;
delete from public.audit_events;
delete from public.promotions;
delete from public.offices;
delete from public.organization_profiles;
delete from public.organization_members;
delete from public.organizations;

-- ─── developer-default · Luxinmo ──────────────────────────────────
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_city, address_province, country,
  status, verified, verified_at
) values (
  'developer-default', 'developer',
  'Luxinmo Inversiones SL', 'Luxinmo', 'B98765432',
  'info@luxinmo.com', '+34 965 123 456', 'www.luxinmo.com',
  'https://api.dicebear.com/9.x/shapes/svg?seed=luxinmo&backgroundColor=1d4ed8&size=120', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1600&q=80',
  'Av. de la Estación 5, 03001 Alicante, España', 'Alicante',
  'Alicante', 'ES',
  'active', true, '2025-09-10'
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline, quote, quote_description,
  founded_year, license_number, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  marketing_top_nationalities, marketing_product_types, marketing_client_sources, marketing_portals,
  google_place_id, google_rating, google_ratings_total, google_fetched_at, google_maps_url,
  visibility_status
) values (
  'developer-default',
  'Promotor inmobiliario especializado en obra nueva premium en la Costa Blanca. Más de una década entregando proyectos a clientes nacionales e internacionales.',
  'Desde 2012 hemos entregado más de 800 viviendas en Alicante, Valencia y Murcia. Trabajamos con un equipo internacional que atiende a compradores en cinco idiomas y colaboramos con agencias verificadas en toda Europa.',
  'Inversión segura en la Costa Blanca',
  'Construimos lo que firmaríamos.',
  'Cada promoción se diseña pensando en cómo viviríamos nosotros allí · materiales nobles, ubicaciones estratégicas y atención post-venta de por vida.',
  2012,
  'RAICV-V-2345',
  '[{"tipo":"RAICV","numero":"RAICV-V-2345","verificada":true}]'::jsonb,
  '{"es","en","fr","de","ru"}',
  3,
  5,
  null, 'info@luxinmo.com', '+34 965 123 456', 'L-V 9:30-19:00',
  'luxinmo', 'luxinmo.es',
  '', '', '',
  '[{"countryIso":"ES","pct":35},{"countryIso":"GB","pct":20},{"countryIso":"DE","pct":12},{"countryIso":"FR","pct":10},{"countryIso":"BE","pct":8},{"countryIso":"NL","pct":8},{"countryIso":"OTROS","pct":7}]'::jsonb,
  '[{"tipo":"obra-nueva","precioDesde":350000},{"tipo":"villa-lujo","precioDesde":1500000}]'::jsonb,
  '[{"fuente":"portales","pct":40},{"fuente":"colab-int","pct":30},{"fuente":"colab-nac","pct":15},{"fuente":"referidos","pct":10},{"fuente":"cartera-propia","pct":5}]'::jsonb,
  '{"idealista","fotocasa","thinkspain","kyero"}',
  'ChIJ_LuxinmoDemoPlaceId',
  4.7,
  312,
  '2026-04-27T10:41:42.315Z',
  'https://maps.app.goo.gl/luxinmo',
  'visible'
);

-- ─── Agencies (10 mock agencies) ──────────────────────────────────
-- ─── ag-1 · Prime Properties Costa del Sol ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'ag-1', 'agency',
  'Prime Properties Costa del Sol S.L.', 'Prime Properties Costa del Sol', 'B92345678',
  'laura@primeproperties.com', '+34 612 345 678',
  'primeproperties.com', 'https://api.dicebear.com/9.x/shapes/svg?seed=prime-properties&backgroundColor=3b82f6&size=120', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=200&fit=crop',
  'Av. Ricardo Soriano, 72, 29601 Marbella', 'Av. Ricardo Soriano 72, 3º',
  '29601', 'Marbella',
  'Málaga', 'ES',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'ag-1',
  'Agencia boutique especializada en propiedades de lujo en la Costa del Sol. Red sólida de compradores internacionales.',
  'Agencia boutique especializada en propiedades de lujo en la Costa del Sol. Red sólida de compradores internacionales.',
  null,
  2014,
  '[{"tipo":"RAIA","numero":"RAIA-MA-000247","desde":"2018-06-14","verificada":true},{"tipo":"COAPI","numero":"COAPI-MA-01234","desde":"2017-03-02","verificada":true,"publicUrl":"https://www.coapi.org"},{"tipo":"GIPE","numero":"GIPE-3456","desde":"2019-11-20"}]'::jsonb,
  '{"ES","EN","DE","SV"}',
  4,
  4,
  'Laura Sánchez',
  'laura@primeproperties.com',
  '+34 612 345 678',
  'L-V 9:00-19:00 · S 10:00-14:00',
  'https://www.linkedin.com/company/prime-properties-costadelsol', 'https://www.instagram.com/primeproperties.es',
  'https://www.facebook.com/primeproperties.es', null, null,
  4.8, 247,
  '2026-04-26T10:41:42.313Z', 'https://maps.app.goo.gl/DEMO_Prime', 'ChIJDEMO_PrimeProperties',
  'visible'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-1-of-1', 'ag-1',
  'Oficina Marbella', 'Av. Ricardo Soriano, 72, 29601 Marbella',
  'Marbella', 'ES',
  true, 'active');
insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-1-of-2', 'ag-1',
  'Oficina Estepona', 'Calle Real, 15, 29680 Estepona',
  'Estepona', 'ES',
  false, 'active');

-- ─── ag-2 · Nordic Home Finders ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'ag-2', 'agency',
  'Nordic Home Finders AB', 'Nordic Home Finders', 'SE559234567801',
  'erik@nordichomefinders.com', '+46 70 123 4567',
  'nordichomefinders.com', 'https://api.dicebear.com/9.x/shapes/svg?seed=nordic-home&backgroundColor=10b981&size=120', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=200&fit=crop',
  'Birger Jarlsgatan 44, 114 29 Stockholm', 'Birger Jarlsgatan 44',
  '114 29', 'Stockholm',
  'Stockholms län', 'SE',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'ag-2',
  'Broker escandinavo de referencia que conecta compradores nórdicos con propiedades en la costa española. Especializados en servicios de relocación.',
  'Broker escandinavo de referencia que conecta compradores nórdicos con propiedades en la costa española. Especializados en servicios de relocación.',
  null,
  2015,
  '[{"tipo":"FMI","numero":"FMI-2018-4567","desde":"2018-02-10","verificada":true,"publicUrl":"https://fmi.se"},{"tipo":"FIABCI","numero":"FIABCI-SE-04321","desde":"2020-09-01","verificada":true,"publicUrl":"https://www.fiabci.org"},{"tipo":"RAICV","numero":"RAICV-A-002158","desde":"2024-01-15","verificada":true,"publicUrl":"https://habitatge.gva.es"}]'::jsonb,
  '{"SV","EN","ES","NO","DA","FI"}',
  5,
  5,
  'Erik Lindqvist',
  'erik@nordichomefinders.com',
  '+46 70 123 4567',
  'L-V 9:00-17:00 (CET)',
  'https://www.linkedin.com/company/nordic-home-finders', 'https://www.instagram.com/nordichomefinders',
  'https://www.facebook.com/nordichomefinders', 'https://www.youtube.com/@nordichomefinders', null,
  4.6, 183,
  '2026-04-24T10:41:42.314Z', 'https://maps.app.goo.gl/DEMO_Nordic', 'ChIJDEMO_Nordic',
  'visible'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-2-of-1', 'ag-2',
  'Oficina Stockholm', 'Birger Jarlsgatan 44, 114 29 Stockholm',
  'Stockholm', 'SE',
  true, 'active');

-- ─── ag-3 · Dutch & Belgian Realty ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'ag-3', 'agency',
  'Dutch & Belgian Realty B.V.', 'Dutch & Belgian Realty', 'NL854321987B01',
  'pieter@dutchbelgianrealty.com', '+31 20 555 1234',
  'dutchbelgianrealty.com', 'https://api.dicebear.com/9.x/shapes/svg?seed=dutch-belgian&backgroundColor=f59e0b&size=120', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=200&fit=crop',
  'Herengracht 180, 1016 BR Amsterdam', 'Herengracht 180',
  '1016 BR', 'Amsterdam',
  'Noord-Holland', 'NL',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'ag-3',
  'Red inmobiliaria pan-Benelux con oficinas en Ámsterdam, Bruselas y Amberes. Foco en compradores de segunda residencia.',
  'Red inmobiliaria pan-Benelux con oficinas en Ámsterdam, Bruselas y Amberes. Foco en compradores de segunda residencia.',
  null,
  2013,
  null,
  '{"NL","FR","EN","DE","ES"}',
  4.5,
  4.5,
  'Pieter De Vries',
  'pieter@dutchbelgianrealty.com',
  '+31 20 555 1234',
  'L-V 9:00-18:00 (CET)',
  'https://www.linkedin.com/company/dutch-belgian-realty', 'https://www.instagram.com/dutchbelgianrealty',
  'https://www.facebook.com/dutchbelgianrealty', null, null,
  4.3, 92,
  '2026-04-28T10:41:42.314Z', 'https://maps.app.goo.gl/DEMO_Dutch', 'ChIJDEMO_DutchBelgian',
  'visible'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-3-of-1', 'ag-3',
  'Oficina Amsterdam', 'Herengracht 180, 1016 BR Amsterdam',
  'Amsterdam', 'NL',
  true, 'active');
insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-3-of-2', 'ag-3',
  'Oficina Brussels', 'Avenue Louise 54, 1050 Bruxelles',
  'Brussels', 'NL',
  false, 'active');
insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-3-of-3', 'ag-3',
  'Oficina Antwerp', 'Meir 85, 2000 Antwerpen',
  'Antwerp', 'NL',
  false, 'active');

-- ─── ag-4 · Meridian Real Estate Group ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'ag-4', 'agency',
  'Meridian Real Estate Group Ltd', 'Meridian Real Estate Group', 'GB938472615',
  'james@meridianrealestate.co.uk', '+44 20 7946 0018',
  'meridianrealestate.co.uk', 'https://api.dicebear.com/9.x/shapes/svg?seed=meridian-group&backgroundColor=ef4444&size=120', 'https://images.unsplash.com/photo-1464938050520-ef2571e0d6d2?w=600&h=200&fit=crop',
  '32 Mayfair Place, W1J 8JR London', '32 Mayfair Place',
  'W1J 8JR', 'London',
  'Greater London', 'GB',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'ag-4',
  'Agencia británica especializada en inversión inmobiliaria en el Mediterráneo. El contrato de colaboración anterior ha expirado.',
  'Agencia británica especializada en inversión inmobiliaria en el Mediterráneo. El contrato de colaboración anterior ha expirado.',
  null,
  2009,
  null,
  '{"EN","ES","FR"}',
  3,
  3,
  'James Whitfield',
  'james@meridianrealestate.co.uk',
  '+44 20 7946 0018',
  'Mon-Fri 9:00-18:00 (GMT)',
  'https://www.linkedin.com/company/meridian-real-estate-group', 'https://www.instagram.com/meridian.realestate',
  null, null, null,
  3.4, 56,
  '2026-04-22T10:41:42.314Z', 'https://maps.app.goo.gl/DEMO_Meridian', 'ChIJDEMO_Meridian',
  'visible'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-4-of-1', 'ag-4',
  'Oficina London', '32 Mayfair Place, W1J 8JR London',
  'London', 'GB',
  true, 'active');

-- ─── ag-5 · Iberia Luxury Homes ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'ag-5', 'agency',
  'Iberia Luxury Homes Lda', 'Iberia Luxury Homes', 'PT512345678',
  'joao@iberialuxuryhomes.pt', '+351 21 350 7000',
  'iberialuxuryhomes.pt', 'https://api.dicebear.com/9.x/shapes/svg?seed=iberia-luxury&backgroundColor=8b5cf6&size=120', 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=600&h=200&fit=crop',
  'Av. da Liberdade 110, 1250-146 Lisboa', 'Av. da Liberdade 110, 4º',
  '1250-146', 'Lisboa',
  'Lisboa', 'PT',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'ag-5',
  'Agencia portuguesa de lujo expandiéndose al mercado español. Solicita colaboración por primera vez.',
  'Agencia portuguesa de lujo expandiéndose al mercado español. Solicita colaboración por primera vez.',
  null,
  2017,
  null,
  '{"PT","EN","ES","FR"}',
  0,
  0,
  'João Almeida',
  'joao@iberialuxuryhomes.pt',
  '+351 21 350 7000',
  'Seg-Sex 9:30-18:30 (WET)',
  'https://www.linkedin.com/company/iberia-luxury-homes', 'https://www.instagram.com/iberialuxuryhomes',
  null, null, null,
  4.5, 78,
  '2026-04-25T10:41:42.314Z', 'https://maps.app.goo.gl/DEMO_Iberia', null,
  'visible'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-5-of-1', 'ag-5',
  'Oficina Lisbon', 'Av. da Liberdade 110, 1250-146 Lisboa',
  'Lisbon', 'PT',
  true, 'active');
insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-5-of-2', 'ag-5',
  'Oficina Porto', 'Rua de Santa Catarina 200, 4000-451 Porto',
  'Porto', 'PT',
  false, 'active');

-- ─── ag-6 · Baltic Property Partners ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'ag-6', 'agency',
  'Baltic Property Partners', 'Baltic Property Partners', null,
  null, null,
  null, 'https://ui-avatars.com/api/?name=BP&background=06b6d4&color=fff&size=120&font-size=0.4&bold=true', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=200&fit=crop',
  'Mannerheimintie 14, 00100 Helsinki', null,
  null, 'Helsinki',
  null, 'FI',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'ag-6',
  'Broker finlandés con una red sólida en el Báltico, buscando partnerships en promociones de la Costa Blanca.',
  'Broker finlandés con una red sólida en el Báltico, buscando partnerships en promociones de la Costa Blanca.',
  null,
  null,
  null,
  null,
  0,
  0,
  null,
  null,
  null,
  null,
  null, null,
  null, null, null,
  null, null,
  null, null, null,
  'incomplete'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-6-of-1', 'ag-6',
  'Oficina Helsinki', 'Mannerheimintie 14, 00100 Helsinki',
  'Helsinki', 'FI',
  true, 'active');

-- ─── ag-7 · Mediterranean Lux Homes ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'ag-7', 'agency',
  'Mediterranean Lux Homes', 'Mediterranean Lux Homes', null,
  'elodie@medluxhomes.fr', '+33 4 92 12 34 56',
  null, 'https://api.dicebear.com/9.x/shapes/svg?seed=med-lux&backgroundColor=a855f7&size=120', 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=600&h=200&fit=crop',
  '12 Promenade des Anglais, 06000 Nice', null,
  null, 'Nice',
  null, 'FR',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'ag-7',
  'Boutique inmobiliaria en la Costa Azul con cartera de clientes franceses de alto poder adquisitivo.',
  'Boutique inmobiliaria en la Costa Azul con cartera de clientes franceses de alto poder adquisitivo.',
  null,
  null,
  null,
  null,
  0,
  0,
  'Élodie Laurent',
  'elodie@medluxhomes.fr',
  '+33 4 92 12 34 56',
  null,
  null, null,
  null, null, null,
  4.7, 134,
  null, null, null,
  'incomplete'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-7-of-1', 'ag-7',
  'Oficina Nice', '12 Promenade des Anglais, 06000 Nice',
  'Nice', 'FR',
  true, 'active');
insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-7-of-2', 'ag-7',
  'Oficina Cannes', '48 Boulevard de la Croisette, 06400 Cannes',
  'Cannes', 'FR',
  false, 'active');

-- ─── ag-8 · Moscow Estates ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'ag-8', 'agency',
  'Moscow Estates', 'Moscow Estates', null,
  'dmitri@moscowestates.ru', '+7 495 123 4567',
  null, 'https://api.dicebear.com/9.x/shapes/svg?seed=moscow-estates&backgroundColor=dc2626&size=120', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&h=200&fit=crop',
  'Tverskaya 25, 125009 Moscow', null,
  null, 'Moscow',
  null, 'RU',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'ag-8',
  'Broker ruso enfocado en clientela VIP que busca segunda residencia en España y Portugal.',
  'Broker ruso enfocado en clientela VIP que busca segunda residencia en España y Portugal.',
  null,
  null,
  null,
  null,
  0,
  0,
  'Dmitri Volkov',
  'dmitri@moscowestates.ru',
  '+7 495 123 4567',
  null,
  null, null,
  null, null, null,
  4.4, 68,
  null, null, null,
  'incomplete'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-8-of-1', 'ag-8',
  'Oficina Moscow', 'Tverskaya 25, 125009 Moscow',
  'Moscow', 'RU',
  true, 'active');

-- ─── ag-9 · Alpine Living ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'ag-9', 'agency',
  'Alpine Living', 'Alpine Living', null,
  'markus@alpineliving.ch', '+41 44 123 4567',
  null, 'https://api.dicebear.com/9.x/shapes/svg?seed=alpine-living&backgroundColor=0ea5e9&size=120', 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=200&fit=crop',
  'Bahnhofstrasse 45, 8001 Zurich', null,
  null, 'Zurich',
  null, 'CH',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'ag-9',
  'Red suiza con oficinas en los cantones alpinos, especializada en segunda residencia mediterránea.',
  'Red suiza con oficinas en los cantones alpinos, especializada en segunda residencia mediterránea.',
  null,
  null,
  null,
  null,
  0,
  0,
  'Markus Zimmermann',
  'markus@alpineliving.ch',
  '+41 44 123 4567',
  null,
  null, null,
  null, null, null,
  4.9, 312,
  null, null, null,
  'incomplete'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-9-of-1', 'ag-9',
  'Oficina Zurich', 'Bahnhofstrasse 45, 8001 Zurich',
  'Zurich', 'CH',
  true, 'active');
insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-9-of-2', 'ag-9',
  'Oficina Geneva', 'Rue du Rhône 30, 1204 Geneva',
  'Geneva', 'CH',
  false, 'active');
insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-9-of-3', 'ag-9',
  'Oficina Basel', 'Freie Strasse 78, 4001 Basel',
  'Basel', 'CH',
  false, 'active');

-- ─── ag-10 · Gulf Premium Realty ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'ag-10', 'agency',
  'Gulf Premium Realty', 'Gulf Premium Realty', null,
  'khalid@gulfpremium.ae', '+971 4 123 4567',
  null, 'https://api.dicebear.com/9.x/shapes/svg?seed=gulf-premium&backgroundColor=eab308&size=120', 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&h=200&fit=crop',
  'Sheikh Zayed Road 200, DIFC, Dubai', null,
  null, 'Dubai',
  null, 'UA',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'ag-10',
  'Agencia con sede en Dubai y red de clientes GCC con intereses en Europa del Sur.',
  'Agencia con sede en Dubai y red de clientes GCC con intereses en Europa del Sur.',
  null,
  null,
  null,
  null,
  0,
  0,
  'Khalid Al-Rashid',
  'khalid@gulfpremium.ae',
  '+971 4 123 4567',
  null,
  null, null,
  null, null, null,
  4.6, 89,
  null, null, null,
  'incomplete'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('ag-10-of-1', 'ag-10',
  'Oficina Dubai', 'Sheikh Zayed Road 200, DIFC, Dubai',
  'Dubai', 'UA',
  true, 'active');

-- ─── External promotores (4 mock developers) ─────────────────────
-- ─── prom-1 · AEDAS Homes ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'prom-1', 'developer',
  'AEDAS Homes S.A.', 'AEDAS Homes', 'ESA12345678',
  'carlos.mendieta@aedashomes.es', '+34 91 555 0142',
  'aedashomes.com', 'https://api.dicebear.com/9.x/shapes/svg?seed=aedas&backgroundColor=1d4ed8&size=120', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=200&fit=crop',
  'Paseo de la Castellana, 130, 28046 Madrid', null,
  null, 'Madrid',
  null, 'ES',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'prom-1',
  'Promotora cotizada española · obra nueva residencial premium.',
  'Promotora cotizada española · obra nueva residencial premium.',
  null,
  2017,
  null,
  null,
  3,
  3,
  'Carlos Mendieta',
  'carlos.mendieta@aedashomes.es',
  '+34 91 555 0142',
  null,
  null, null,
  null, null, null,
  4.4, 287,
  null, null, null,
  'incomplete'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('prom-1-of-1', 'prom-1',
  'Oficina Madrid', 'Paseo de la Castellana, 130, 28046 Madrid',
  'Madrid', 'ES',
  true, 'active');
insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('prom-1-of-2', 'prom-1',
  'Oficina Barcelona', 'Av. Diagonal, 640, 08017 Barcelona',
  'Barcelona', 'ES',
  false, 'active');

-- ─── prom-2 · Neinor Homes ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'prom-2', 'developer',
  'Neinor Homes S.A.', 'Neinor Homes', 'ESA98765432',
  'marta.ribera@neinor.com', '+34 944 123 456',
  'neinorhomes.com', 'https://api.dicebear.com/9.x/shapes/svg?seed=neinor&backgroundColor=ec4899&size=120', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=200&fit=crop',
  'Alameda de Recalde, 27, 48009 Bilbao', null,
  null, 'Bilbao',
  null, 'ES',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'prom-2',
  'Mayor promotora cotizada por capitalización · BTR + BTS.',
  'Mayor promotora cotizada por capitalización · BTR + BTS.',
  null,
  2015,
  null,
  null,
  3.5,
  3.5,
  'Marta Ribera',
  'marta.ribera@neinor.com',
  '+34 944 123 456',
  null,
  null, null,
  null, null, null,
  4.2, 412,
  null, null, null,
  'incomplete'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('prom-2-of-1', 'prom-2',
  'Oficina Bilbao', 'Alameda de Recalde, 27, 48009 Bilbao',
  'Bilbao', 'ES',
  true, 'active');
insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('prom-2-of-2', 'prom-2',
  'Oficina Madrid', 'C. de Velázquez, 105, 28006 Madrid',
  'Madrid', 'ES',
  false, 'active');
insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('prom-2-of-3', 'prom-2',
  'Oficina Málaga', 'Av. Andalucía, 26, 29002 Málaga',
  'Málaga', 'ES',
  false, 'active');

-- ─── prom-3 · Habitat Inmobiliaria ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'prom-3', 'developer',
  'Habitat Inmobiliaria S.L.', 'Habitat Inmobiliaria', 'ESB55667788',
  'jordi.puig@habitatinmobiliaria.com', '+34 93 222 5588',
  'habitatinmobiliaria.com', 'https://api.dicebear.com/9.x/shapes/svg?seed=habitat&backgroundColor=059669&size=120', 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=600&h=200&fit=crop',
  'Av. Diagonal, 477, 08036 Barcelona', null,
  null, 'Barcelona',
  null, 'ES',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'prom-3',
  'Promotora histórica con 70 años · obra nueva costera.',
  'Promotora histórica con 70 años · obra nueva costera.',
  null,
  1953,
  null,
  null,
  4,
  4,
  'Jordi Puig',
  'jordi.puig@habitatinmobiliaria.com',
  '+34 93 222 5588',
  null,
  null, null,
  null, null, null,
  4, 156,
  null, null, null,
  'incomplete'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('prom-3-of-1', 'prom-3',
  'Oficina Barcelona', 'Av. Diagonal, 477, 08036 Barcelona',
  'Barcelona', 'ES',
  true, 'active');

-- ─── prom-4 · Metrovacesa ──
insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  'prom-4', 'developer',
  'Metrovacesa S.A.', 'Metrovacesa', 'ESA87654321',
  'sara.llorente@metrovacesa.com', '+34 91 444 6677',
  'metrovacesa.com', 'https://api.dicebear.com/9.x/shapes/svg?seed=metrovacesa&backgroundColor=f59e0b&size=120', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=200&fit=crop',
  'Quintanavides 13, 28050 Madrid', null,
  null, 'Madrid',
  null, 'ES',
  'active',
  false,
  null
);

insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  'prom-4',
  'Inmobiliaria con cartera de suelo más grande de España.',
  'Inmobiliaria con cartera de suelo más grande de España.',
  null,
  1918,
  null,
  null,
  3,
  3,
  'Sara Llorente',
  'sara.llorente@metrovacesa.com',
  '+34 91 444 6677',
  null,
  null, null,
  null, null, null,
  3.9, 89,
  null, null, null,
  'incomplete'
);

insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values ('prom-4-of-1', 'prom-4',
  'Oficina Madrid', 'Quintanavides 13, 28050 Madrid',
  'Madrid', 'ES',
  true, 'active');

-- ─── Luxinmo offices (developer-default) ──────────────────────────
insert into public.offices (id, organization_id, name, address, city, province, country, is_main, status)
values ('of-1', 'developer-default', 'Oficina Central Marbella',
  'Av. del Mar 15', 'Marbella', 'Málaga', 'ES',
  true, 'active');
insert into public.offices (id, organization_id, name, address, city, province, country, is_main, status)
values ('of-2', 'developer-default', 'Showroom Puerto Banús',
  'Puerto Banús, Local 8', 'Marbella', 'Málaga', 'ES',
  false, 'active');
insert into public.offices (id, organization_id, name, address, city, province, country, is_main, status)
values ('of-3', 'developer-default', 'Sales Office Jávea',
  'Av. del Plá 12', 'Jávea', 'Alicante', 'ES',
  false, 'active');
insert into public.offices (id, organization_id, name, address, city, province, country, is_main, status)
values ('of-4', 'developer-default', 'Madrid HQ',
  'Paseo de la Castellana 89', 'Madrid', 'Madrid', 'ES',
  false, 'active');
insert into public.offices (id, organization_id, name, address, city, province, country, is_main, status)
values ('of-5', 'developer-default', 'Costa Blanca Office',
  'C/ del Sol 22', 'Torrevieja', 'Alicante', 'ES',
  false, 'active');
insert into public.offices (id, organization_id, name, address, city, province, country, is_main, status)
values ('of-6', 'developer-default', 'Mijas Showroom',
  'Av. de Mijas 5', 'Mijas', 'Málaga', 'ES',
  false, 'active');

-- ─── Luxinmo promotions (promotions.ts + developerOnlyPromotions.ts) ──
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  '1', 'developer-default', 'promotor',
  'Altea Hills Residences',
  null,
  'Altea, Alicante', null, 'ES',
  'active',
  48, 12,
  344000, 1400000, 'Q2 2026',
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=400&fit=crop',
  true,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  '2', 'developer-default', 'promotor',
  'Marina Bay Towers',
  null,
  'Málaga, Costa del Sol', null, 'ES',
  'active',
  32, 3,
  385000, 920000, 'Q4 2025',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop',
  true,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  '3', 'developer-default', 'promotor',
  'Serena Golf Villas',
  null,
  'Estepona, Costa del Sol', null, 'ES',
  'active',
  24, 18,
  890000, 2100000, 'Q1 2027',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop',
  true,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  '4', 'developer-default', 'promotor',
  'Skyline Residences',
  null,
  'Valencia, Ciudad de las Artes', null, 'ES',
  'active',
  80, 34,
  265000, 580000, 'Q3 2026',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop',
  true,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  '5', 'developer-default', 'promotor',
  'Puerta del Mar',
  null,
  'Alicante, Playa de San Juan', null, 'ES',
  'active',
  56, 1,
  310000, 490000, 'Q2 2025',
  'https://images.unsplash.com/photo-1580587771525-78b9dbd7c4ce?w=600&h=400&fit=crop',
  true,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  '6', 'developer-default', 'promotor',
  'Bosque Real',
  null,
  'Madrid, Las Rozas', null, 'ES',
  'active',
  16, 9,
  720000, 1800000, 'Q4 2026',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop',
  true,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  '7', 'developer-default', 'promotor',
  'Incomplete Project',
  null,
  '', null, 'ES',
  'incomplete',
  0, 0,
  0, 0, '',
  null,
  true,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  '8', 'developer-default', 'promotor',
  'Terramar Beach',
  null,
  'Sitges, Barcelona Coast', null, 'ES',
  'sold_out',
  40, 0,
  550000, 1200000, 'Q1 2026',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop',
  true,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  'dev-1', 'developer-default', 'promotor',
  'Villa Serena',
  null,
  'Marbella, Costa del Sol', null, 'ES',
  'active',
  1, 1,
  1250000, 1250000, 'Q4 2026',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&h=400&fit=crop',
  true,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  'dev-2', 'developer-default', 'promotor',
  'Villas del Pinar',
  null,
  'Jávea, Alicante', null, 'ES',
  'active',
  12, 6,
  680000, 1100000, 'Q2 2027',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop',
  true,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  'dev-3', 'developer-default', 'promotor',
  'Residencial Aurora',
  null,
  'Benalmádena, Málaga', null, 'ES',
  'incomplete',
  36, 24,
  290000, 520000, 'Q1 2027',
  null,
  false,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  'dev-4', 'developer-default', 'promotor',
  'Terrazas del Golf',
  null,
  'Mijas, Costa del Sol', null, 'ES',
  'incomplete',
  28, 18,
  345000, 780000, 'Q3 2026',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop',
  false,
  null
);
insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  'dev-5', 'developer-default', 'promotor',
  'Mar Azul Residences',
  null,
  'Torrevieja, Alicante', null, 'ES',
  'active',
  44, 30,
  215000, 410000, 'Q2 2026',
  'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600&h=400&fit=crop',
  true,
  null
);

