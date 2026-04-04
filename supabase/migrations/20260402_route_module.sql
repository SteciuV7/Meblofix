create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.ustawienia_operacyjne (
  id uuid primary key default gen_random_uuid(),
  nazwa text not null default 'Domyslna konfiguracja',
  adres_bazy text not null,
  lat numeric not null,
  lon numeric not null,
  domyslny_czas_obslugi_min integer not null default 30,
  szerokosc_okna_min integer not null default 60,
  aktywny boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists ustawienia_operacyjne_aktywny_unique
on public.ustawienia_operacyjne (aktywny)
where aktywny = true;

drop trigger if exists ustawienia_operacyjne_set_updated_at on public.ustawienia_operacyjne;
create trigger ustawienia_operacyjne_set_updated_at
before update on public.ustawienia_operacyjne
for each row
execute function public.set_updated_at();

create table if not exists public.trasy (
  id uuid primary key default gen_random_uuid(),
  numer text not null unique,
  data_trasy date not null,
  planowany_start_at timestamp with time zone not null,
  status text not null check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  driver_firma_id uuid references public.firmy(firma_id) on delete set null,
  base_address_snapshot text,
  total_distance_m integer default 0,
  total_duration_s integer default 0,
  notes text,
  created_at timestamp with time zone not null default now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);

create index if not exists trasy_status_data_idx
on public.trasy (status, data_trasy, planowany_start_at);

drop trigger if exists trasy_set_updated_at on public.trasy;
create trigger trasy_set_updated_at
before update on public.trasy
for each row
execute function public.set_updated_at();

create table if not exists public.trasy_punkty (
  id uuid primary key default gen_random_uuid(),
  trasa_id uuid not null references public.trasy(id) on delete cascade,
  reklamacja_id uuid not null references public.reklamacje(id) on delete restrict,
  kolejnosc integer not null,
  status text not null check (status in ('planned', 'in_progress', 'delivered')),
  previous_reklamacja_status text,
  distance_from_prev_m integer default 0,
  duration_from_prev_s integer default 0,
  eta_from timestamp with time zone,
  eta_to timestamp with time zone,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists trasy_punkty_trasa_kolejnosc_unique
on public.trasy_punkty (trasa_id, kolejnosc);

create unique index if not exists trasy_punkty_reklamacja_active_unique
on public.trasy_punkty (reklamacja_id)
where status in ('planned', 'in_progress');

create index if not exists trasy_punkty_trasa_idx
on public.trasy_punkty (trasa_id, status, kolejnosc);

drop trigger if exists trasy_punkty_set_updated_at on public.trasy_punkty;
create trigger trasy_punkty_set_updated_at
before update on public.trasy_punkty
for each row
execute function public.set_updated_at();

create table if not exists public.logi_operacyjne (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('reklamacja', 'trasa', 'trasa_punkt')),
  entity_id uuid not null,
  reklamacja_id uuid references public.reklamacje(id) on delete cascade,
  trasa_id uuid references public.trasy(id) on delete cascade,
  trasa_punkt_id uuid references public.trasy_punkty(id) on delete cascade,
  action text not null,
  actor_firma_id uuid references public.firmy(firma_id) on delete set null,
  actor_email text,
  actor_role text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists logi_operacyjne_entity_idx
on public.logi_operacyjne (entity_type, entity_id, created_at desc);

create index if not exists logi_operacyjne_reklamacja_idx
on public.logi_operacyjne (reklamacja_id, created_at desc);

create index if not exists logi_operacyjne_trasa_idx
on public.logi_operacyjne (trasa_id, created_at desc);

create or replace function public.write_operational_log(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_reklamacja_id uuid default null,
  p_trasa_id uuid default null,
  p_trasa_punkt_id uuid default null,
  p_actor_firma_id uuid default null,
  p_actor_email text default null,
  p_actor_role text default null,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid := gen_random_uuid();
begin
  insert into public.logi_operacyjne (
    id,
    entity_type,
    entity_id,
    reklamacja_id,
    trasa_id,
    trasa_punkt_id,
    action,
    actor_firma_id,
    actor_email,
    actor_role,
    before_state,
    after_state,
    metadata
  )
  values (
    v_log_id,
    p_entity_type,
    p_entity_id,
    p_reklamacja_id,
    p_trasa_id,
    p_trasa_punkt_id,
    p_action,
    p_actor_firma_id,
    p_actor_email,
    p_actor_role,
    p_before_state,
    p_after_state,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return v_log_id;
end;
$$;

create or replace function public.create_route_with_stops(
  p_route jsonb,
  p_stops jsonb,
  p_actor_firma_id uuid default null,
  p_actor_email text default null,
  p_actor_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route public.trasy%rowtype;
  v_stop jsonb;
  v_reklamacja public.reklamacje%rowtype;
  v_updated_reklamacja public.reklamacje%rowtype;
  v_route_stop public.trasy_punkty%rowtype;
begin
  insert into public.trasy (
    numer,
    data_trasy,
    planowany_start_at,
    status,
    driver_firma_id,
    base_address_snapshot,
    total_distance_m,
    total_duration_s,
    notes
  )
  values (
    p_route->>'numer',
    (p_route->>'data_trasy')::date,
    (p_route->>'planowany_start_at')::timestamptz,
    coalesce(p_route->>'status', 'planned'),
    nullif(p_route->>'driver_firma_id', '')::uuid,
    p_route->>'base_address_snapshot',
    coalesce((p_route->>'total_distance_m')::integer, 0),
    coalesce((p_route->>'total_duration_s')::integer, 0),
    p_route->>'notes'
  )
  returning * into v_route;

  for v_stop in
    select value
    from jsonb_array_elements(coalesce(p_stops, '[]'::jsonb))
  loop
    select *
    into v_reklamacja
    from public.reklamacje
    where id = (v_stop->>'reklamacja_id')::uuid
    for update;

    if not found then
      raise exception 'Nie znaleziono reklamacji %', v_stop->>'reklamacja_id';
    end if;

    insert into public.trasy_punkty (
      trasa_id,
      reklamacja_id,
      kolejnosc,
      status,
      previous_reklamacja_status,
      distance_from_prev_m,
      duration_from_prev_s,
      eta_from,
      eta_to
    )
    values (
      v_route.id,
      v_reklamacja.id,
      coalesce((v_stop->>'kolejnosc')::integer, 1),
      coalesce(v_stop->>'status', 'planned'),
      coalesce(v_stop->>'previous_reklamacja_status', v_reklamacja.status),
      coalesce((v_stop->>'distance_from_prev_m')::integer, 0),
      coalesce((v_stop->>'duration_from_prev_s')::integer, 0),
      nullif(v_stop->>'eta_from', '')::timestamptz,
      nullif(v_stop->>'eta_to', '')::timestamptz
    )
    returning * into v_route_stop;

    update public.reklamacje
    set
      status = 'Zaplanowano trasę',
      trasa = v_route.data_trasy,
      nieprzeczytane_dla_uzytkownika = true
    where id = v_reklamacja.id
    returning * into v_updated_reklamacja;

    perform public.write_operational_log(
      'trasa_punkt',
      v_route_stop.id,
      'route_stop_created',
      v_reklamacja.id,
      v_route.id,
      v_route_stop.id,
      p_actor_firma_id,
      p_actor_email,
      p_actor_role,
      null,
      to_jsonb(v_route_stop),
      jsonb_build_object('kolejnosc', v_route_stop.kolejnosc)
    );

    perform public.write_operational_log(
      'reklamacja',
      v_reklamacja.id,
      'route_assigned',
      v_reklamacja.id,
      v_route.id,
      v_route_stop.id,
      p_actor_firma_id,
      p_actor_email,
      p_actor_role,
      to_jsonb(v_reklamacja),
      to_jsonb(v_updated_reklamacja),
      jsonb_build_object(
        'trasa_numer', v_route.numer,
        'kolejnosc', v_route_stop.kolejnosc
      )
    );
  end loop;

  perform public.write_operational_log(
    'trasa',
    v_route.id,
    'route_created',
    null,
    v_route.id,
    null,
    p_actor_firma_id,
    p_actor_email,
    p_actor_role,
    null,
    to_jsonb(v_route),
    jsonb_build_object('stops_count', jsonb_array_length(coalesce(p_stops, '[]'::jsonb)))
  );

  return jsonb_build_object(
    'route_id', v_route.id,
    'numer', v_route.numer
  );
end;
$$;

create or replace function public.replace_route_stops(
  p_route_id uuid,
  p_planowany_start_at timestamptz,
  p_total_distance_m integer,
  p_total_duration_s integer,
  p_stops jsonb,
  p_actor_firma_id uuid default null,
  p_actor_email text default null,
  p_actor_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route public.trasy%rowtype;
  v_existing_stop public.trasy_punkty%rowtype;
  v_stop jsonb;
  v_reklamacja public.reklamacje%rowtype;
  v_updated_reklamacja public.reklamacje%rowtype;
  v_route_stop public.trasy_punkty%rowtype;
begin
  select *
  into v_route
  from public.trasy
  where id = p_route_id
  for update;

  if not found then
    raise exception 'Nie znaleziono trasy %', p_route_id;
  end if;

  if v_route.status <> 'planned' then
    raise exception 'Przeliczenie jest dozwolone tylko dla tras zaplanowanych.';
  end if;

  for v_existing_stop in
    select *
    from public.trasy_punkty
    where trasa_id = p_route_id
    order by kolejnosc
  loop
    select *
    into v_reklamacja
    from public.reklamacje
    where id = v_existing_stop.reklamacja_id
    for update;

    update public.reklamacje
    set
      status = coalesce(v_existing_stop.previous_reklamacja_status, status),
      trasa = null,
      nieprzeczytane_dla_uzytkownika = true
    where id = v_existing_stop.reklamacja_id
    returning * into v_updated_reklamacja;

    perform public.write_operational_log(
      'reklamacja',
      v_reklamacja.id,
      'route_unassigned',
      v_reklamacja.id,
      p_route_id,
      v_existing_stop.id,
      p_actor_firma_id,
      p_actor_email,
      p_actor_role,
      to_jsonb(v_reklamacja),
      to_jsonb(v_updated_reklamacja),
      jsonb_build_object('source', 'replace_route_stops')
    );

    perform public.write_operational_log(
      'trasa_punkt',
      v_existing_stop.id,
      'route_stop_removed',
      v_existing_stop.reklamacja_id,
      p_route_id,
      v_existing_stop.id,
      p_actor_firma_id,
      p_actor_email,
      p_actor_role,
      to_jsonb(v_existing_stop),
      null,
      jsonb_build_object('source', 'replace_route_stops')
    );
  end loop;

  delete from public.trasy_punkty where trasa_id = p_route_id;

  update public.trasy
  set
    planowany_start_at = p_planowany_start_at,
    data_trasy = p_planowany_start_at::date,
    total_distance_m = coalesce(p_total_distance_m, 0),
    total_duration_s = coalesce(p_total_duration_s, 0)
  where id = p_route_id
  returning * into v_route;

  for v_stop in
    select value
    from jsonb_array_elements(coalesce(p_stops, '[]'::jsonb))
  loop
    select *
    into v_reklamacja
    from public.reklamacje
    where id = (v_stop->>'reklamacja_id')::uuid
    for update;

    insert into public.trasy_punkty (
      trasa_id,
      reklamacja_id,
      kolejnosc,
      status,
      previous_reklamacja_status,
      distance_from_prev_m,
      duration_from_prev_s,
      eta_from,
      eta_to
    )
    values (
      p_route_id,
      v_reklamacja.id,
      coalesce((v_stop->>'kolejnosc')::integer, 1),
      coalesce(v_stop->>'status', 'planned'),
      coalesce(v_stop->>'previous_reklamacja_status', v_reklamacja.status),
      coalesce((v_stop->>'distance_from_prev_m')::integer, 0),
      coalesce((v_stop->>'duration_from_prev_s')::integer, 0),
      nullif(v_stop->>'eta_from', '')::timestamptz,
      nullif(v_stop->>'eta_to', '')::timestamptz
    )
    returning * into v_route_stop;

    update public.reklamacje
    set
      status = 'Zaplanowano trasę',
      trasa = v_route.data_trasy,
      nieprzeczytane_dla_uzytkownika = true
    where id = v_reklamacja.id
    returning * into v_updated_reklamacja;

    perform public.write_operational_log(
      'trasa_punkt',
      v_route_stop.id,
      'route_stop_created',
      v_reklamacja.id,
      v_route.id,
      v_route_stop.id,
      p_actor_firma_id,
      p_actor_email,
      p_actor_role,
      null,
      to_jsonb(v_route_stop),
      jsonb_build_object('source', 'replace_route_stops')
    );

    perform public.write_operational_log(
      'reklamacja',
      v_reklamacja.id,
      'route_assigned',
      v_reklamacja.id,
      v_route.id,
      v_route_stop.id,
      p_actor_firma_id,
      p_actor_email,
      p_actor_role,
      to_jsonb(v_reklamacja),
      to_jsonb(v_updated_reklamacja),
      jsonb_build_object(
        'trasa_numer', v_route.numer,
        'kolejnosc', v_route_stop.kolejnosc,
        'source', 'replace_route_stops'
      )
    );
  end loop;

  perform public.write_operational_log(
    'trasa',
    v_route.id,
    'route_recalculated',
    null,
    v_route.id,
    null,
    p_actor_firma_id,
    p_actor_email,
    p_actor_role,
    null,
    to_jsonb(v_route),
    jsonb_build_object('stops_count', jsonb_array_length(coalesce(p_stops, '[]'::jsonb)))
  );

  return jsonb_build_object(
    'route_id', v_route.id,
    'stops_count', jsonb_array_length(coalesce(p_stops, '[]'::jsonb))
  );
end;
$$;

create or replace function public.start_route(
  p_route_id uuid,
  p_actor_firma_id uuid default null,
  p_actor_email text default null,
  p_actor_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route public.trasy%rowtype;
  v_stop public.trasy_punkty%rowtype;
  v_updated_stop public.trasy_punkty%rowtype;
  v_reklamacja public.reklamacje%rowtype;
  v_updated_reklamacja public.reklamacje%rowtype;
begin
  select *
  into v_route
  from public.trasy
  where id = p_route_id
  for update;

  if not found then
    raise exception 'Nie znaleziono trasy %', p_route_id;
  end if;

  if v_route.status <> 'planned' then
    raise exception 'Trasę można wystartować tylko ze statusu planned.';
  end if;

  update public.trasy
  set
    status = 'in_progress',
    started_at = coalesce(started_at, now())
  where id = p_route_id
  returning * into v_route;

  for v_stop in
    select *
    from public.trasy_punkty
    where trasa_id = p_route_id
      and status <> 'delivered'
    order by kolejnosc
  loop
    update public.trasy_punkty
    set status = 'in_progress'
    where id = v_stop.id
    returning * into v_updated_stop;

    select *
    into v_reklamacja
    from public.reklamacje
    where id = v_stop.reklamacja_id
    for update;

    update public.reklamacje
    set
      status = 'W trasie',
      nieprzeczytane_dla_uzytkownika = true
    where id = v_reklamacja.id
    returning * into v_updated_reklamacja;

    perform public.write_operational_log(
      'trasa_punkt',
      v_updated_stop.id,
      'route_stop_started',
      v_updated_stop.reklamacja_id,
      p_route_id,
      v_updated_stop.id,
      p_actor_firma_id,
      p_actor_email,
      p_actor_role,
      to_jsonb(v_stop),
      to_jsonb(v_updated_stop),
      jsonb_build_object('kolejnosc', v_updated_stop.kolejnosc)
    );

    perform public.write_operational_log(
      'reklamacja',
      v_reklamacja.id,
      'route_started',
      v_reklamacja.id,
      p_route_id,
      v_updated_stop.id,
      p_actor_firma_id,
      p_actor_email,
      p_actor_role,
      to_jsonb(v_reklamacja),
      to_jsonb(v_updated_reklamacja),
      jsonb_build_object('trasa_numer', v_route.numer)
    );
  end loop;

  perform public.write_operational_log(
    'trasa',
    v_route.id,
    'route_started',
    null,
    v_route.id,
    null,
    p_actor_firma_id,
    p_actor_email,
    p_actor_role,
    null,
    to_jsonb(v_route),
    null
  );

  return jsonb_build_object(
    'route_id', v_route.id,
    'status', v_route.status
  );
end;
$$;

create or replace function public.deliver_route_stop(
  p_route_id uuid,
  p_stop_id uuid,
  p_actor_firma_id uuid default null,
  p_actor_email text default null,
  p_actor_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route public.trasy%rowtype;
  v_stop public.trasy_punkty%rowtype;
  v_updated_stop public.trasy_punkty%rowtype;
  v_reklamacja public.reklamacje%rowtype;
  v_updated_reklamacja public.reklamacje%rowtype;
begin
  select *
  into v_route
  from public.trasy
  where id = p_route_id
  for update;

  if not found then
    raise exception 'Nie znaleziono trasy %', p_route_id;
  end if;

  if v_route.status <> 'in_progress' then
    raise exception 'Dostarczenie punktu jest możliwe tylko dla trasy w toku.';
  end if;

  select *
  into v_stop
  from public.trasy_punkty
  where id = p_stop_id
    and trasa_id = p_route_id
  for update;

  if not found then
    raise exception 'Nie znaleziono punktu % dla trasy %', p_stop_id, p_route_id;
  end if;

  if v_stop.status = 'delivered' then
    raise exception 'Ten punkt został już oznaczony jako dostarczony.';
  end if;

  update public.trasy_punkty
  set
    status = 'delivered',
    delivered_at = now()
  where id = p_stop_id
  returning * into v_updated_stop;

  select *
  into v_reklamacja
  from public.reklamacje
  where id = v_stop.reklamacja_id
  for update;

  update public.reklamacje
  set
    status = 'Zakończone',
    data_zakonczenia = now(),
    nieprzeczytane_dla_uzytkownika = true
  where id = v_stop.reklamacja_id
  returning * into v_updated_reklamacja;

  perform public.write_operational_log(
    'trasa_punkt',
    v_updated_stop.id,
    'route_stop_delivered',
    v_updated_stop.reklamacja_id,
    p_route_id,
    v_updated_stop.id,
    p_actor_firma_id,
    p_actor_email,
    p_actor_role,
    to_jsonb(v_stop),
    to_jsonb(v_updated_stop),
    null
  );

  perform public.write_operational_log(
    'reklamacja',
    v_updated_reklamacja.id,
    'route_delivered',
    v_updated_reklamacja.id,
    p_route_id,
    v_updated_stop.id,
    p_actor_firma_id,
    p_actor_email,
    p_actor_role,
    to_jsonb(v_reklamacja),
    to_jsonb(v_updated_reklamacja),
    jsonb_build_object('trasa_numer', v_route.numer)
  );

  return jsonb_build_object(
    'stop_id', v_updated_stop.id,
    'reklamacja_id', v_updated_reklamacja.id
  );
end;
$$;

create or replace function public.complete_route(
  p_route_id uuid,
  p_actor_firma_id uuid default null,
  p_actor_email text default null,
  p_actor_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route public.trasy%rowtype;
  v_open_stops integer;
begin
  select *
  into v_route
  from public.trasy
  where id = p_route_id
  for update;

  if not found then
    raise exception 'Nie znaleziono trasy %', p_route_id;
  end if;

  select count(*)
  into v_open_stops
  from public.trasy_punkty
  where trasa_id = p_route_id
    and status <> 'delivered';

  if v_open_stops > 0 then
    raise exception 'Nie można ukończyć trasy dopóki wszystkie punkty nie są dostarczone.';
  end if;

  update public.trasy
  set
    status = 'completed',
    completed_at = now()
  where id = p_route_id
  returning * into v_route;

  perform public.write_operational_log(
    'trasa',
    v_route.id,
    'route_completed',
    null,
    v_route.id,
    null,
    p_actor_firma_id,
    p_actor_email,
    p_actor_role,
    null,
    to_jsonb(v_route),
    null
  );

  return jsonb_build_object(
    'route_id', v_route.id,
    'status', v_route.status
  );
end;
$$;

create or replace function public.acknowledge_reklamacja(
  p_reklamacja_id uuid,
  p_actor_firma_id uuid default null,
  p_actor_email text default null,
  p_actor_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reklamacja public.reklamacje%rowtype;
  v_updated_reklamacja public.reklamacje%rowtype;
begin
  select *
  into v_reklamacja
  from public.reklamacje
  where id = p_reklamacja_id
  for update;

  if not found then
    raise exception 'Nie znaleziono reklamacji %', p_reklamacja_id;
  end if;

  update public.reklamacje
  set nieprzeczytane_dla_uzytkownika = false
  where id = p_reklamacja_id
  returning * into v_updated_reklamacja;

  perform public.write_operational_log(
    'reklamacja',
    v_updated_reklamacja.id,
    'reklamacja_acknowledged',
    v_updated_reklamacja.id,
    null,
    null,
    p_actor_firma_id,
    p_actor_email,
    p_actor_role,
    to_jsonb(v_reklamacja),
    to_jsonb(v_updated_reklamacja),
    null
  );

  return jsonb_build_object(
    'reklamacja_id', v_updated_reklamacja.id,
    'nieprzeczytane_dla_uzytkownika', v_updated_reklamacja.nieprzeczytane_dla_uzytkownika
  );
end;
$$;

create or replace function public.migrate_legacy_trasy(
  p_actor_firma_id uuid default null,
  p_actor_email text default null,
  p_actor_role text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group record;
  v_reklamacja public.reklamacje%rowtype;
  v_route public.trasy%rowtype;
  v_route_stop public.trasy_punkty%rowtype;
  v_counter integer := 0;
  v_sequence integer;
  v_status text;
begin
  for v_group in
    select
      trasa::date as legacy_date
    from public.reklamacje
    where trasa is not null
    group by trasa::date
    order by trasa::date
  loop
    select
      case
        when count(*) filter (where status in ('Zakończone', 'Archiwum')) = count(*) then 'completed'
        else 'planned'
      end
    into v_status
    from public.reklamacje
    where trasa::date = v_group.legacy_date;

    insert into public.trasy (
      numer,
      data_trasy,
      planowany_start_at,
      status,
      base_address_snapshot,
      notes
    )
    values (
      'LEGACY-' || to_char(v_group.legacy_date, 'YYYYMMDD'),
      v_group.legacy_date,
      v_group.legacy_date::timestamptz,
      v_status,
      'legacy_migration',
      'Migracja z pola reklamacje.trasa'
    )
    on conflict (numer) do update
      set notes = excluded.notes
    returning * into v_route;

    v_sequence := 0;

    for v_reklamacja in
      select *
      from public.reklamacje
      where trasa::date = v_group.legacy_date
      order by coalesce(realizacja_do, data_zgloszenia), data_zgloszenia
    loop
      v_sequence := v_sequence + 1;

      insert into public.trasy_punkty (
        trasa_id,
        reklamacja_id,
        kolejnosc,
        status,
        previous_reklamacja_status,
        eta_from,
        eta_to
      )
      values (
        v_route.id,
        v_reklamacja.id,
        v_sequence,
        case
          when v_reklamacja.status in ('Zakończone', 'Archiwum') then 'delivered'
          else 'planned'
        end,
        v_reklamacja.status,
        v_reklamacja.realizacja_do,
        v_reklamacja.realizacja_do
      )
      on conflict do nothing
      returning * into v_route_stop;

      if v_route_stop.id is not null then
        perform public.write_operational_log(
          'trasa_punkt',
          v_route_stop.id,
          'legacy_migration',
          v_reklamacja.id,
          v_route.id,
          v_route_stop.id,
          p_actor_firma_id,
          p_actor_email,
          p_actor_role,
          null,
          to_jsonb(v_route_stop),
          jsonb_build_object('legacy_date', v_group.legacy_date)
        );
      end if;
    end loop;

    perform public.write_operational_log(
      'trasa',
      v_route.id,
      'legacy_migration',
      null,
      v_route.id,
      null,
      p_actor_firma_id,
      p_actor_email,
      p_actor_role,
      null,
      to_jsonb(v_route),
      jsonb_build_object('legacy_date', v_group.legacy_date)
    );

    v_counter := v_counter + 1;
  end loop;

  return v_counter;
end;
$$;
