-- ===================================================================
-- AUTO-GENERATED · do not edit manually.
-- Source: scripts/generate-crm-seed.ts
-- ===================================================================

-- Idempotente · limpia datos CRM antes de re-seedear.
delete from public.visit_evaluations;
delete from public.calendar_events where id like 'ce-%' or id like 'ev-%';
delete from public.sale_payments;
delete from public.sales;
delete from public.registro_events;
delete from public.registros;

-- ─── registros ──────────────────────────────────────────
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-001', 'developer-default', 'ag-1', '1', null,
  'collaborator', 'registration', 'pendiente',
  'Émilie Rousseau', 'emilie.rousseau@gmail.com', '+33 6 12 34 56 78',
  'Francia', 'FR', 'FR-21837291',
  0, null, null, 'Apto para aprobación directa · sin coincidencias.',
  null, null, null,
  null,
  null, null, null, null,
  'Buscando ático con vistas al mar, presupuesto hasta 1.2M€.', true, null, 're000033',
  '2026-04-29T11:53:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-002', 'developer-default', 'ag-2', '2', null,
  'collaborator', 'registration_visit', 'pendiente',
  'Lars Bergström', 'l.bergstrom@nordichomes.se', '+46 70 987 1123',
  'Suecia', 'SE', 'SE-19810423',
  0, null, null, null,
  '2026-04-28', '10:30', null,
  null,
  null, null, null, null,
  null, true, null, 're000027',
  '2026-04-29T10:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-003', 'developer-default', 'ag-3', '3', null,
  'collaborator', 'registration', 'pendiente',
  'Joris van der Berg', 'joris.vdb@dutchrealty.nl', '+31 6 2345 6789',
  'Países Bajos', 'NL', 'NL-PS5419230',
  0, null, null, null,
  null, null, null,
  null,
  null, null, null, null,
  null, true, null, 're000024',
  '2026-04-29T07:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-004', 'developer-default', 'ag-2', '1', null,
  'collaborator', 'registration', 'aprobado',
  'Anna-Liisa Virtanen', 'anna.virtanen@outlook.fi', '+358 40 555 2211',
  'Finlandia', 'FI', 'FI-120385-999X',
  0, null, null, null,
  null, null, null,
  null,
  '2026-04-28T12:07:09.291Z', null, null, null,
  null, true, null, 're000017',
  '2026-04-28T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-005', 'developer-default', 'ag-1', '2', null,
  'collaborator', 'registration', 'pendiente',
  'James O''Connor', 'james.oconnor@gmail.com', '+44 7700 900 301',
  'Reino Unido', 'GB', 'GB-98765432',
  42, 'Jamie O''Connor · contacto propio desde 2025', '{"nombre":"Jamie O''Connor","email":"jamie.connor@outlook.com","telefono":"+44 7700 900 499","dni":"GB-98765491","nacionalidad":"Reino Unido"}'::jsonb, null,
  null, null, null,
  null,
  null, null, null, null,
  'Coincide el apellido y nacionalidad, pero teléfono y email distintos.', true, null, 're000023',
  '2026-04-29T05:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-006', 'developer-default', 'ag-3', '4', null,
  'collaborator', 'registration_visit', 'pendiente',
  'Sofía Martínez Ruiz', 'sofia.mruiz@hotmail.com', '+34 656 443 221',
  'España', 'ES', '12345678B',
  55, 'Sofía M. Ruiz · registrada por Prime Properties (hace 11 días)', '{"nombre":"Sofía M. Ruiz","email":"sofimr@gmail.com","telefono":"+34 656 443 221","dni":"12345678B","nacionalidad":"España"}'::jsonb, 'Coincidencia parcial · revisa email y teléfono antes de decidir.',
  '2026-04-29', '16:00', null,
  null,
  null, null, null, null,
  null, true, null, 're000021',
  '2026-04-29T02:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-007', 'developer-default', 'ag-2', '3', null,
  'collaborator', 'registration', 'pendiente',
  'Mikhail Volkov', 'mvolkov@mail.ru', '+7 916 234 5678',
  'Rusia', 'RU', 'RU-7701985',
  38, 'Mikhail V. · contacto propio (email diferente)', '{"nombre":"Mikhail V.","email":"volkov.m@yandex.ru","telefono":"+7 916 234 5699","dni":"RU-7701985","nacionalidad":"Rusia"}'::jsonb, null,
  null, null, null,
  null,
  null, null, null, null,
  null, true, null, 're000013',
  '2026-04-27T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-008', 'developer-default', 'ag-3', '1', null,
  'collaborator', 'registration', 'pendiente',
  'Hans Dieter Schmidt', 'hd.schmidt@t-online.de', '+49 170 4455 889',
  'Alemania', 'DE', 'DE-AR3928473',
  61, 'Hans D. Schmidt · registrado hace 45 días', '{"nombre":"Hans D. Schmidt","email":"hds@gmx.de","telefono":"+49 170 4455 889","dni":"DE-AR3928473","nacionalidad":"Alemania"}'::jsonb, null,
  null, null, null,
  null,
  null, null, null, null,
  null, true, null, 're000012',
  '2026-04-26T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-009', 'developer-default', 'ag-3', '2', null,
  'collaborator', 'registration', 'pendiente',
  'Lars Bergström', 'l.bergstrom@nordichomes.se', '+46 70 987 1123',
  'Suecia', 'SE', 'SE-19810423',
  96, 'reg-002 · Nordic Home Finders (hace 2h)', '{"nombre":"Lars Bergström","email":"l.bergstrom@nordichomes.se","telefono":"+46 70 987 1123","dni":"SE-19810423","nacionalidad":"Suecia"}'::jsonb, null,
  null, null, null,
  null,
  null, null, null, null,
  'Mismo cliente exacto: teléfono, DNI y email coinciden.', true, null, 're000028',
  '2026-04-29T11:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-010', 'developer-default', 'ag-2', '1', null,
  'collaborator', 'registration', 'pendiente',
  'Émilie Rousseau', 'emilie.r@gmail.com', '+33 6 12 34 56 78',
  'Francia', 'FR', 'FR-21837291',
  88, 'reg-001 · Prime Properties (hace 14 min)', '{"nombre":"Émilie Rousseau","email":"emilie.rousseau@gmail.com","telefono":"+33 6 12 34 56 78","dni":"FR-21837291","nacionalidad":"Francia"}'::jsonb, null,
  null, null, null,
  null,
  null, null, null, null,
  null, true, null, 're000029',
  '2026-04-29T11:22:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-011', 'developer-default', 'ag-1', '4', null,
  'collaborator', 'registration', 'duplicado',
  'Sofía Martínez', 'sofimr@gmail.com', '+34 656 443 221',
  'España', 'ES', '12345678B',
  92, 'Contacto CRM propio (desde Nov 2025)', '{"nombre":"Sofía M. Ruiz","email":"sofimr@gmail.com","telefono":"+34 656 443 221","dni":"12345678B","nacionalidad":"España"}'::jsonb, null,
  null, null, null,
  null,
  null, null, null, null,
  null, true, null, 're000009',
  '2026-04-24T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-012', 'developer-default', 'ag-1', '3', null,
  'collaborator', 'registration', 'rechazado',
  'Johan De Vries', 'j.devries@ziggo.nl', '+31 6 1122 3344',
  'Países Bajos', 'NL', 'NL-BSN8839921',
  78, 'Registrado previamente por Dutch & Belgian Realty', '{"nombre":"Johan De Vries","email":"jdv@gmail.com","telefono":"+31 6 1122 3344","dni":"NL-BSN8839921","nacionalidad":"Países Bajos"}'::jsonb, null,
  null, null, null,
  null,
  '2026-04-25T12:07:09.291Z', null, null, null,
  'Rechazado — la otra agencia registró primero.', true, null, 're000011',
  '2026-04-25T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-013', 'developer-default', 'ag-2', '2', null,
  'collaborator', 'registration', 'aprobado',
  'Ingrid Johansen', 'ingrid.johansen@gmail.com', '+47 918 44 552',
  'Noruega', 'NO', 'NO-23048811',
  0, null, null, null,
  null, null, null,
  null,
  '2026-04-28T12:07:09.291Z', null, 'Arman Rahmanov', 'Admin',
  null, true, '1h 24min', 're000018',
  '2026-04-28T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-014', 'developer-default', 'ag-1', '1', null,
  'collaborator', 'registration', 'aprobado',
  'Pierre Lefèvre', 'pierre.lefevre@orange.fr', '+33 6 78 90 12 34',
  'Francia', 'FR', 'FR-43298172',
  15, 'Contacto parecido (nombre frecuente)', '{"nombre":"Pierre Lefebvre","email":"p.lefebvre@wanadoo.fr","telefono":"+33 6 78 90 99 99","dni":"FR-43290000","nacionalidad":"Francia"}'::jsonb, null,
  null, null, null,
  null,
  '2026-04-27T12:07:09.291Z', null, 'Laura Gómez', 'Comercial senior',
  null, true, '3h 12min', 're000014',
  '2026-04-27T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-015', 'developer-default', 'ag-2', '4', null,
  'collaborator', 'registration', 'pendiente',
  'Olivia Thompson', 'o.thompson@icloud.com', '+44 7712 445 889',
  'Reino Unido', 'GB', 'GB-PP1122334',
  0, null, null, null,
  null, null, null,
  null,
  null, null, null, null,
  'Interesada en duplex con terraza orientación sur.', true, null, 're000025',
  '2026-04-29T08:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-016', 'developer-default', 'ag-3', '3', null,
  'collaborator', 'registration', 'rechazado',
  'Matteo Ricci', 'matteo.ricci@tiscali.it', '+39 333 445 6677',
  'Italia', 'IT', 'IT-RCCMTT80',
  0, null, null, null,
  null, null, null,
  null,
  '2026-04-23T12:07:09.291Z', null, null, null,
  'Rechazado por falta de consentimiento RGPD.', false, null, 're000008',
  '2026-04-23T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-017', 'developer-default', 'ag-1', '2', null,
  'collaborator', 'registration', 'pendiente',
  'Katarzyna Nowak', 'k.nowak@onet.pl', '+48 602 334 891',
  'Polonia', 'PL', 'PL-82051244765',
  0, null, null, null,
  null, null, null,
  null,
  null, null, null, null,
  null, true, null, 're000031',
  '2026-04-29T11:32:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-018', 'developer-default', 'ag-3', '1', null,
  'collaborator', 'registration', 'pendiente',
  'Carlos Mendoza Vega', 'carlos.mvega@gmail.com', '+52 55 6632 1144',
  'México', 'MX', 'MX-MEVC850203',
  33, 'Carlos M. Vega · contacto con email parecido', '{"nombre":"Carlos M. Vega","email":"carlos.mvega.01@gmail.com","telefono":"+52 55 6632 9988","dni":"MX-MEVC850299","nacionalidad":"México"}'::jsonb, null,
  null, null, null,
  null,
  null, null, null, null,
  null, true, null, 're000022',
  '2026-04-29T03:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-019', 'developer-default', null, '1', null,
  'direct', 'registration', 'aprobado',
  'Sophie Laurent', 'sophie.laurent@privatemail.fr', '+33 1 45 67 89 01',
  'Francia', 'FR', 'FR-92847361',
  0, null, null, null,
  null, null, null,
  null,
  '2026-04-29T09:07:09.291Z', null, 'Promotor', null,
  'Contacto vía formulario del microsite. Interesada en planta alta.', true, null, 're000026',
  '2026-04-29T09:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-020', 'developer-default', null, '2', null,
  'direct', 'registration_visit', 'aprobado',
  'Markus Schulz', 'markus.schulz@outlook.de', '+49 30 1234 5678',
  'Alemania', 'DE', 'DE-PA98712345',
  0, null, null, null,
  '2026-04-30', '17:00', null,
  null,
  '2026-04-28T16:07:09.291Z', null, 'Promotor', null,
  'Llamada entrante. Quiere visitar con su mujer el finde.', true, null, 're000019',
  '2026-04-28T16:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-021', 'developer-default', null, '3', null,
  'direct', 'registration', 'pendiente',
  'Beatriz Ribeiro', 'beatriz.ribeiro@hotmail.pt', '+351 93 456 7890',
  'Portugal', 'PT', 'PT-18724569',
  72, 'Beatriz Ribeiro · ya registrada por Iberia Homes hace 6 días', '{"nombre":"Beatriz Ribeiro","email":"b.ribeiro@hotmail.pt","telefono":"+351 93 456 7890","dni":"PT-18724569","nacionalidad":"Portugal"}'::jsonb, 'Atención: cliente ya en sistema por una agencia colaboradora. Revisar antes de aprobar.',
  null, null, null,
  null,
  null, null, null, null,
  null, true, null, 're000015',
  '2026-04-27T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-022', 'developer-default', null, '4', null,
  'direct', 'registration', 'aprobado',
  'Alex Petrov', 'alex.petrov@gmail.com', '+7 916 555 0123',
  'Rusia', 'RU', 'RU-7812345678',
  0, null, null, null,
  null, null, null,
  null,
  '2026-04-29T11:22:09.291Z', null, 'Promotor', null,
  null, true, null, 're000030',
  '2026-04-29T11:22:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-024', 'developer-default', 'ag-3', '4', null,
  'collaborator', 'registration', 'aprobado',
  'James O''Connor', 'james.oconnor@gmail.com', '+44 7700 900 301',
  'Reino Unido', 'GB', null,
  0, null, null, null,
  null, null, null,
  null,
  '2026-03-31T12:07:09.291Z', null, 'Arman Rahmanov', null,
  'Cliente registrado y activo en Residencial Costa Brava.', true, null, 're000006',
  '2026-03-30T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-023', 'developer-default', 'ag-2', '1', null,
  'collaborator', 'visit_only', 'pendiente',
  'Anna-Liisa Virtanen', 'anna.virtanen@outlook.fi', '+358 40 555 2211',
  'Finlandia', 'FI', null,
  0, null, null, 'Cliente ya aprobado previamente · solo confirma la visita.',
  '2026-04-30', '17:00', null,
  'reg-004',
  null, null, null, null,
  null, true, null, 're000032',
  '2026-04-29T11:37:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-024-m', 'developer-default', 'ag-4', '1', null,
  'collaborator', 'registration', 'aprobado',
  'Charles Pemberton', 'c.pemberton@btinternet.com', '+44 7700 900245',
  'Reino Unido', 'GB', 'GB-PP998877',
  8, null, null, null,
  null, null, null,
  null,
  '2025-12-30T12:07:09.291Z', null, 'Arman Rahmanov', 'Director',
  'Cliente repetidor de Meridian · cerró villa 2 unidades.', true, '2h 45min', 're000001',
  '2025-12-30T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-025-m', 'developer-default', 'ag-4', '2', null,
  'collaborator', 'registration', 'aprobado',
  'Margaret Ashworth', 'm.ashworth@gmail.com', '+44 7984 112233',
  'Reino Unido', 'GB', 'GB-PP554433',
  12, null, null, null,
  null, null, null,
  null,
  '2026-01-24T12:07:09.291Z', null, 'Arman Rahmanov', 'Director',
  null, true, '5h 18min', 're000002',
  '2026-01-24T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-026-m', 'developer-default', 'ag-4', '1', null,
  'collaborator', 'registration', 'rechazado',
  'Edward Sinclair', 'edward.sinclair@yahoo.co.uk', '+44 7445 887766',
  'Reino Unido', 'GB', null,
  78, 'Cliente ya activo en otra agencia', null, null,
  null, null, null,
  null,
  '2026-02-08T12:07:09.291Z', null, 'Laura Gómez', 'Comercial senior',
  null, true, '1h 22min', 're000003',
  '2026-02-08T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-027-m', 'developer-default', 'ag-4', '3', null,
  'collaborator', 'registration', 'aprobado',
  'Niamh O''Sullivan', 'niamh.osullivan@hotmail.com', '+353 87 555 4321',
  'Irlanda', 'IE', null,
  6, null, null, null,
  null, null, null,
  null,
  '2026-02-18T12:07:09.291Z', null, 'Arman Rahmanov', 'Director',
  null, true, '3h 50min', 're000004',
  '2026-02-18T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-028-m', 'developer-default', 'ag-4', '2', null,
  'collaborator', 'registration', 'caducado',
  'Robert Whitaker', 'r.whitaker@outlook.com', '+44 7831 224466',
  'Reino Unido', 'GB', null,
  22, null, null, null,
  null, null, null,
  null,
  null, null, null, null,
  'Pre-registro caducado · cliente desistió antes de la visita.', true, null, 're000005',
  '2026-03-10T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-029-i', 'developer-default', 'ag-5', '1', null,
  'collaborator', 'registration', 'pendiente',
  'Rafael Martins', 'r.martins@iol.pt', '+351 93 555 7788',
  'Portugal', 'PT', null,
  4, null, null, null,
  null, null, null,
  null,
  null, null, null, null,
  'Cliente premium · cerró 2 operaciones con Iberia el año pasado.', true, null, 're000007',
  '2026-04-21T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-030-i', 'developer-default', 'ag-5', '2', null,
  'collaborator', 'registration', 'pendiente',
  'Catarina Mendes', 'c.mendes@sapo.pt', '+351 96 222 3344',
  'Portugal', 'PT', null,
  0, null, null, null,
  null, null, null,
  null,
  null, null, null, null,
  null, true, null, 're000010',
  '2026-04-24T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-031-i', 'developer-default', 'ag-5', '1', null,
  'collaborator', 'registration', 'pendiente',
  'Pedro Almeida', 'p.almeida@portugalmail.pt', '+351 21 555 9000',
  'Portugal', 'PT', null,
  18, null, null, null,
  null, null, null,
  null,
  null, null, null, null,
  null, true, null, 're000016',
  '2026-04-27T12:07:09.291Z'
);
insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  'reg-032-i', 'developer-default', 'ag-5', '3', null,
  'collaborator', 'registration', 'pendiente',
  'Lucas Oliveira', 'lucas.oliveira@globo.com.br', '+55 11 9 8765 4321',
  'Brasil', 'BR', null,
  2, null, null, null,
  null, null, null,
  null,
  null, null, null, null,
  'Inversor brasileño · busca segunda residencia en Costa del Sol.', true, null, 're000020',
  '2026-04-28T16:07:09.291Z'
);

-- ─── sales ──────────────────────────────────────────────
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-001', 'developer-default', 'ag-2', '1', null, null,
  '1-11A-2B', '11A · 2ºB · 3 hab · 112 m²', 'Hans Müller', 'h.mueller@example.de',
  '+49 176 2234 1198', 'Alemania',
  'Erik Lindqvist', 'reservada',
  '2026-04-02', null, null, null,
  6000, 612000, 625000, 13000,
  5, false,
  'hipoteca', 'Firma de contrato privado', '2026-04-28', 'Cliente con hipoteca pre-aprobada por Sabadell.'
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-001', '2026-04-02', 'Señal de reserva', 6000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-002', 'developer-default', 'ag-1', '2', null, null,
  '2-11A-4A', '11A · 4ºA · 2 hab · 88 m²', 'Olivia Ramsay', 'olivia.r@example.co.uk',
  '+44 7700 900123', 'Reino Unido',
  'Marta Jiménez', 'reservada',
  '2026-04-11', null, null, null,
  10000, 495000, 495000, null,
  4.5, false,
  'contado', 'Firma de contrato privado', '2026-05-05', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-002', '2026-04-11', 'Señal de reserva', 10000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-003', 'developer-default', null, '4', null, null,
  '4-11A-1C', '11A · 1ºC · 1 hab · 62 m²', 'Ana García', 'ana.garcia@example.es',
  '+34 654 332 119', 'España',
  'Arman (Promotor)', 'reservada',
  '2026-04-14', null, null, null,
  5000, 285000, 290000, 5000,
  0, true,
  'mixto', 'Aportar documentación bancaria', '2026-04-25', 'Venta directa sin agencia.'
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-003', '2026-04-14', 'Señal de reserva', 5000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-004', 'developer-default', 'ag-2', '3', null, null,
  '3-11A-0A', 'Villa G-04 · 4 hab · 220 m²', 'Sven Johansson', 'sven.j@example.se',
  '+46 70 123 45 67', 'Suecia',
  'Kristina Eriksson', 'reservada',
  '2026-04-08', null, null, null,
  25000, 1460000, 1490000, 30000,
  6, false,
  'contado', 'Firma de contrato privado', '2026-05-02', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-004', '2026-04-08', 'Señal de reserva', 25000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-005', 'developer-default', 'ag-3', '6', null, null,
  '6-11A-0A', 'Villa 3 · 5 hab · 340 m²', 'Pierre Dubois', 'p.dubois@example.fr',
  '+33 6 12 34 56 78', 'Francia',
  'Thomas Janssen', 'reservada',
  '2026-04-16', null, null, null,
  15000, 1320000, 1320000, null,
  5.5, false,
  'hipoteca', 'Aportar tasación bancaria', '2026-05-10', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-005', '2026-04-16', 'Señal de reserva', 15000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-006', 'developer-default', 'ag-2', 'dev-3', null, null,
  'dev-3-11A-2A', '11A · 2ºA · 2 hab · 78 m²', 'Nina Kowalski', 'n.kowalski@example.pl',
  '+48 601 234 567', 'Polonia',
  'Erik Lindqvist', 'reservada',
  '2026-04-17', null, null, null,
  5000, 345000, 345000, null,
  4, false,
  'hipoteca', 'Firma de contrato privado', '2026-05-14', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-006', '2026-04-17', 'Señal de reserva', 5000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-007', 'developer-default', 'ag-2', 'dev-5', null, null,
  'dev-5-11A-1B', '11A · 1ºB · 2 hab · 72 m²', 'Lars Andersen', 'lars.a@example.no',
  '+47 928 11 223', 'Noruega',
  'Kristina Eriksson', 'reservada',
  '2026-04-18', null, null, null,
  4000, 268000, 275000, 7000,
  4, false,
  'mixto', 'Firma de contrato privado', '2026-05-12', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-007', '2026-04-18', 'Señal de reserva', 4000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-010', 'developer-default', 'ag-2', '1', null, null,
  '1-11A-3A', '11A · 3ºA · 3 hab · 118 m²', 'Klaus Weber', 'k.weber@example.de',
  '+49 152 5512 9933', 'Alemania',
  'Erik Lindqvist', 'contratada',
  '2026-02-21', '2026-03-14', null, null,
  6000, 655000, 665000, 10000,
  5, false,
  'hipoteca', 'Escritura pública', '2026-06-18', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-010', '2026-02-21', 'Señal de reserva', 6000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-010', '2026-03-14', 'Pago a la firma de contrato', 65500);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-011', 'developer-default', 'ag-3', '2', null, null,
  '2-11A-3B', '11A · 3ºB · 3 hab · 105 m²', 'Charlotte Verhaegen', 'c.verhaegen@example.be',
  '+32 476 22 33 44', 'Bélgica',
  'Thomas Janssen', 'contratada',
  '2026-01-30', '2026-02-20', null, null,
  10000, 720000, 730000, 10000,
  4.5, false,
  'contado', 'Escritura pública', '2026-05-22', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-011', '2026-01-30', 'Señal de reserva', 10000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-011', '2026-02-20', 'Pago a la firma de contrato', 206000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-012', 'developer-default', 'ag-1', '4', null, null,
  '4-11A-2B', '11A · 2ºB · 2 hab · 75 m²', 'Marco Rossi', 'marco.r@example.it',
  '+39 320 111 2233', 'Italia',
  'Marta Jiménez', 'contratada',
  '2026-02-05', '2026-03-01', null, null,
  5000, 395000, 410000, 15000,
  4, true,
  'hipoteca', 'Escritura pública', '2026-07-04', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-012', '2026-02-05', 'Señal de reserva', 5000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-012', '2026-03-01', 'Pago a la firma de contrato', 34500);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-013', 'developer-default', 'ag-3', '6', null, null,
  '6-11A-1A', 'Villa 1 · 4 hab · 290 m²', 'Daniel van Dijk', 'd.vandijk@example.nl',
  '+31 6 1234 5678', 'Países Bajos',
  'Thomas Janssen', 'contratada',
  '2026-02-12', '2026-03-22', null, null,
  15000, 1150000, 1180000, 30000,
  5.5, false,
  'mixto', 'Escritura pública', '2026-08-10', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-013', '2026-02-12', 'Señal de reserva', 15000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-013', '2026-03-22', 'Pago a la firma de contrato', 100000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-014', 'developer-default', 'ag-1', 'dev-2', null, null,
  'dev-2-11A-2A', '11A · 2ºA · 3 hab · 115 m²', 'Sofia Popescu', 'sofia.p@example.ro',
  '+40 723 112 445', 'Rumanía',
  'Marta Jiménez', 'contratada',
  '2026-03-04', '2026-03-30', null, null,
  8000, 790000, 795000, 5000,
  5, false,
  'hipoteca', 'Escritura pública', '2026-07-25', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-014', '2026-03-04', 'Señal de reserva', 8000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-014', '2026-03-30', 'Pago a la firma de contrato', 71000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-015', 'developer-default', null, 'dev-4', null, null,
  'dev-4-11A-1D', '11A · 1ºD · 2 hab · 82 m²', 'Isabel Moreno', 'isabel.m@example.es',
  '+34 610 554 887', 'España',
  'Arman (Promotor)', 'contratada',
  '2026-02-18', '2026-03-10', null, null,
  5000, 412000, 420000, 8000,
  0, true,
  'hipoteca', 'Escritura pública', '2026-06-30', 'Venta directa sin agencia.'
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-015', '2026-02-18', 'Señal de reserva', 5000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-015', '2026-03-10', 'Pago a la firma de contrato', 36200);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-020', 'developer-default', 'ag-2', '2', null, null,
  '2-11A-5B', '11A · 5ºB · Ático · 140 m²', 'Henrik Berg', 'h.berg@example.se',
  '+46 70 555 11 22', 'Suecia',
  'Erik Lindqvist', 'escriturada',
  '2025-10-12', '2025-11-08', '2026-04-03', null,
  10000, 890000, 920000, 30000,
  4.5, true,
  'contado', null, null, null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-020', '2025-10-12', 'Señal de reserva', 10000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-020', '2025-11-08', 'Pago a la firma de contrato', 250000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-020', '2026-04-03', 'Pago final en escritura', 630000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-021', 'developer-default', 'ag-1', '5', null, null,
  '5-11A-2A', '11A · 2ºA · 2 hab · 80 m²', 'Jakob Schmidt', 'j.schmidt@example.de',
  '+49 151 1122 8844', 'Alemania',
  'Marta Jiménez', 'escriturada',
  '2025-09-04', '2025-10-15', '2026-04-08', null,
  8000, 365000, 365000, null,
  3.5, true,
  'hipoteca', null, null, null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-021', '2025-09-04', 'Señal de reserva', 8000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-021', '2025-10-15', 'Pago a la firma de contrato', 28500);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-021', '2026-04-08', 'Pago final en escritura', 328500);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-022', 'developer-default', 'ag-2', '4', null, null,
  '4-11A-1A', '11A · 1ºA · 1 hab · 58 m²', 'Sara Nilsson', 'sara.n@example.se',
  '+46 70 999 22 11', 'Suecia',
  'Kristina Eriksson', 'escriturada',
  '2025-11-20', '2025-12-18', '2026-04-12', null,
  5000, 272000, 275000, 3000,
  4, false,
  'hipoteca', null, null, null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-022', '2025-11-20', 'Señal de reserva', 5000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-022', '2025-12-18', 'Pago a la firma de contrato', 22000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-022', '2026-04-12', 'Pago final en escritura', 245000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-023', 'developer-default', 'ag-1', '1', null, null,
  '1-11A-4C', '11A · 4ºC · 3 hab · 120 m²', 'Emily Thompson', 'emily.t@example.co.uk',
  '+44 7911 000555', 'Reino Unido',
  'Marta Jiménez', 'escriturada',
  '2025-09-28', '2025-10-30', '2026-03-24', null,
  6000, 710000, 710000, null,
  5, true,
  'contado', null, null, null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-023', '2025-09-28', 'Señal de reserva', 6000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-023', '2025-10-30', 'Pago a la firma de contrato', 64000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-023', '2026-03-24', 'Pago final en escritura', 640000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-024', 'developer-default', 'ag-3', '8', null, null,
  '8-11A-3B', '11A · 3ºB · 2 hab · 92 m²', 'Alexia Constantin', 'alexia.c@example.ro',
  '+40 744 002 331', 'Rumanía',
  'Thomas Janssen', 'escriturada',
  '2025-08-15', '2025-09-18', '2026-04-15', null,
  12000, 680000, 690000, 10000,
  4.5, true,
  'hipoteca', null, null, null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-024', '2025-08-15', 'Señal de reserva', 12000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-024', '2025-09-18', 'Pago a la firma de contrato', 56000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-024', '2026-04-15', 'Pago final en escritura', 612000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-025', 'developer-default', 'ag-2', 'dev-2', null, null,
  'dev-2-11A-1B', '11A · 1ºB · 3 hab · 118 m²', 'Victor Olsen', 'victor.o@example.dk',
  '+45 22 33 44 55', 'Dinamarca',
  'Erik Lindqvist', 'escriturada',
  '2025-10-02', '2025-11-06', '2026-04-18', null,
  8000, 825000, 830000, 5000,
  5, false,
  'contado', null, null, null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-025', '2025-10-02', 'Señal de reserva', 8000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-025', '2025-11-06', 'Pago a la firma de contrato', 74500);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-025', '2026-04-18', 'Pago final en escritura', 742500);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-030', 'developer-default', 'ag-2', '3', null, null,
  '3-11A-0B', 'Villa G-07 · 4 hab · 235 m²', 'Yuri Volkov', 'yuri.v@example.ru',
  '+7 921 555 1234', 'Rusia',
  'Erik Lindqvist', 'caida',
  '2026-01-18', null, null, '2026-03-02',
  25000, 1520000, 1520000, null,
  6, false,
  'contado', null, null, 'Hipoteca denegada, el cliente retira la reserva. Señal no reembolsable retenida.'
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-030', '2026-01-18', 'Señal de reserva', 25000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-031', 'developer-default', 'ag-1', '4', null, null,
  '4-11A-2A', '11A · 2ºA · 3 hab · 90 m²', 'Thomas Fischer', 't.fischer@example.de',
  '+49 171 3344 5566', 'Alemania',
  'Marta Jiménez', 'caida',
  '2026-02-24', null, null, '2026-03-28',
  5000, 458000, 460000, 2000,
  4, false,
  'hipoteca', null, null, 'Cliente cambia de opinión antes de la firma de contrato. Se devuelve señal íntegra.'
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-031', '2026-02-24', 'Señal de reserva', 5000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-031', '2026-03-28', 'Devolución de señal', -5000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-032', 'developer-default', 'ag-3', 'dev-5', null, null,
  'dev-5-11A-2C', '11A · 2ºC · 2 hab · 74 m²', 'Mikhail Ivanov', 'm.ivanov@example.ru',
  '+7 911 222 3344', 'Rusia',
  'Thomas Janssen', 'caida',
  '2026-02-02', null, null, '2026-04-10',
  4000, 295000, 300000, 5000,
  4, false,
  'hipoteca', null, null, 'Problemas bancarios para transferir fondos. Operación cancelada.'
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-032', '2026-02-02', 'Señal de reserva', 4000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-032', '2026-04-10', 'Devolución de señal', -4000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-040-m', 'developer-default', 'ag-4', '1', 'reg-024-m', null,
  '1-12B-3A', '12B · 3ºA · 2 hab · 96 m²', 'Charles Pemberton', 'c.pemberton@btinternet.com',
  '+44 7700 900245', 'Reino Unido',
  'James Whitfield', 'escriturada',
  '2025-12-15', '2026-01-20', '2026-03-12', null,
  8000, 545000, 560000, 15000,
  3, true,
  'hipoteca', null, null, null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-040-m', '2025-12-15', 'Señal de reserva', 8000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-040-m', '2026-01-20', 'Pago a la firma del CPV', 100000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-040-m', '2026-03-12', 'Escritura · resto', 437000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-041-m', 'developer-default', 'ag-4', '2', 'reg-025-m', null,
  '2-3F-1B', '3F · 1ºB · 2 hab · 88 m²', 'Margaret Ashworth', 'm.ashworth@gmail.com',
  '+44 7984 112233', 'Reino Unido',
  'Olivia Carter', 'contratada',
  '2026-01-10', '2026-02-15', null, null,
  6000, 412000, 420000, 8000,
  3, false,
  'contado', 'Escritura pública', '2026-05-20', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-041-m', '2026-01-10', 'Señal de reserva', 6000);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-041-m', '2026-02-15', 'Pago a la firma del CPV', 80000);
insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  'v-042-m', 'developer-default', 'ag-4', '3', 'reg-027-m', null,
  '3-7A-2C', '7A · 2ºC · 3 hab · 124 m²', 'Niamh O''Sullivan', 'niamh.osullivan@hotmail.com',
  '+353 87 555 4321', 'Irlanda',
  'James Whitfield', 'reservada',
  '2026-02-25', null, null, null,
  5000, 375000, 385000, 10000,
  3, false,
  'hipoteca', 'Firma de contrato privado', '2026-04-30', null
);
insert into public.sale_payments (sale_id, fecha, concepto, importe)
values ('v-042-m', '2026-02-25', 'Señal de reserva', 5000);

-- ─── calendar_events ────────────────────────────────────
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-1', 'developer-default',
  'visit',
  'confirmed',
  'Visita · Villa Serena',
  null,
  '2026-04-29T08:00:00.000Z', '2026-04-29T09:00:00.000Z',
  null, null,
  'dev-1',
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-2', 'developer-default',
  'call',
  'confirmed',
  'Llamada seguimiento',
  null,
  '2026-04-29T09:30:00.000Z', '2026-04-29T10:00:00.000Z',
  null, null,
  null,
  null,
  null,
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-3', 'developer-default',
  'block',
  'confirmed',
  'Comida con equipo',
  null,
  '2026-04-29T12:00:00.000Z', '2026-04-29T13:00:00.000Z',
  null, null,
  null,
  null,
  null,
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-4', 'developer-default',
  'visit',
  'confirmed',
  'Visita · Terrazas del Golf',
  null,
  '2026-04-29T14:30:00.000Z', '2026-04-29T15:30:00.000Z',
  null, null,
  'dev-4',
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-5', 'developer-default',
  'visit',
  'confirmed',
  'Visita · Mar Azul Residences',
  null,
  '2026-04-30T08:00:00.000Z', '2026-04-30T09:00:00.000Z',
  null, null,
  'dev-5',
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-6', 'developer-default',
  'meeting',
  'confirmed',
  'Reunión semanal comercial',
  null,
  '2026-04-30T07:00:00.000Z', '2026-04-30T07:45:00.000Z',
  null, null,
  null,
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-7', 'developer-default',
  'visit',
  'scheduled',
  'Visita · Residencial Aurora',
  null,
  '2026-04-30T10:00:00.000Z', '2026-04-30T11:00:00.000Z',
  null, null,
  'dev-3',
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-8', 'developer-default',
  'call',
  'confirmed',
  'Llamada prospección',
  null,
  '2026-04-30T13:00:00.000Z', '2026-04-30T13:30:00.000Z',
  null, null,
  null,
  null,
  null,
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-9', 'developer-default',
  'task',
  'confirmed',
  'Enviar dossier a Ivan Petrov',
  null,
  '2026-04-30T15:30:00.000Z', '2026-04-30T15:30:00.000Z',
  null, null,
  null,
  null,
  null,
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-10', 'developer-default',
  'visit',
  'confirmed',
  'Visita · Villa Serena',
  null,
  '2026-05-01T09:00:00.000Z', '2026-05-01T10:00:00.000Z',
  null, null,
  'dev-1',
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-11', 'developer-default',
  'visit',
  'confirmed',
  'Visita · Villas del Pinar',
  null,
  '2026-05-01T14:00:00.000Z', '2026-05-01T15:00:00.000Z',
  null, null,
  'dev-2',
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-12', 'developer-default',
  'call',
  'confirmed',
  'Llamada · negociación',
  null,
  '2026-05-02T08:00:00.000Z', '2026-05-02T08:30:00.000Z',
  null, null,
  null,
  null,
  null,
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-13', 'developer-default',
  'visit',
  'confirmed',
  'Visita · Villa Serena',
  null,
  '2026-05-02T11:00:00.000Z', '2026-05-02T12:00:00.000Z',
  null, null,
  'dev-1',
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-14', 'developer-default',
  'meeting',
  'confirmed',
  'Visita técnica arquitecto',
  null,
  '2026-05-02T14:00:00.000Z', '2026-05-02T15:30:00.000Z',
  null, null,
  null,
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-15', 'developer-default',
  'visit',
  'confirmed',
  'Visita · Mar Azul Residences',
  null,
  '2026-05-03T08:30:00.000Z', '2026-05-03T09:30:00.000Z',
  null, null,
  'dev-5',
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-16', 'developer-default',
  'visit',
  'done',
  'Visita · Residencial Aurora',
  null,
  '2026-04-28T09:00:00.000Z', '2026-04-28T10:00:00.000Z',
  null, null,
  'dev-3',
  null,
  null,
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-17', 'developer-default',
  'call',
  'done',
  'Llamada primer contacto',
  null,
  '2026-04-28T13:30:00.000Z', '2026-04-28T14:00:00.000Z',
  null, null,
  null,
  null,
  null,
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-18', 'developer-default',
  'visit',
  'cancelled',
  'Visita cancelada · Villa Serena',
  null,
  '2026-04-28T15:00:00.000Z', '2026-04-28T16:00:00.000Z',
  null, null,
  'dev-1',
  null,
  null,
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-19', 'developer-default',
  'visit',
  'cancelled',
  'Visita · Villas del Pinar',
  null,
  '2026-04-27T08:00:00.000Z', '2026-04-27T09:00:00.000Z',
  null, null,
  'dev-2',
  null,
  null,
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-20', 'developer-default',
  'visit',
  'confirmed',
  'Visita · Terrazas del Golf',
  null,
  '2026-05-04T08:00:00.000Z', '2026-05-04T09:00:00.000Z',
  null, null,
  'dev-4',
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-21', 'developer-default',
  'meeting',
  'confirmed',
  'Firma reserva · Olivier',
  null,
  '2026-05-04T14:00:00.000Z', '2026-05-04T15:00:00.000Z',
  null, null,
  null,
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-22', 'developer-default',
  'visit',
  'scheduled',
  'Visita · Villa Serena',
  null,
  '2026-05-06T09:00:00.000Z', '2026-05-06T10:00:00.000Z',
  null, null,
  'dev-1',
  null,
  '[object Object]',
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-23', 'developer-default',
  'block',
  'confirmed',
  'Vacaciones',
  null,
  '2026-05-09T07:00:00.000Z', '2026-05-09T16:00:00.000Z',
  null, null,
  null,
  null,
  null,
  null
);
insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  'ev-24', 'developer-default',
  'call',
  'confirmed',
  'Llamada seguimiento Ivan',
  null,
  '2026-05-06T08:30:00.000Z', '2026-05-06T09:00:00.000Z',
  null, null,
  null,
  null,
  null,
  null
);

