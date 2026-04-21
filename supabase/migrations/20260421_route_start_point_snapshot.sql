begin;

alter table if exists public.trasy
  add column if not exists base_lat_snapshot numeric,
  add column if not exists base_lon_snapshot numeric;

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
    nazwa,
    data_trasy,
    planowany_start_at,
    status,
    base_address_snapshot,
    base_lat_snapshot,
    base_lon_snapshot,
    total_distance_m,
    total_duration_s,
    notes
  )
  values (
    nullif(p_route->>'nazwa', ''),
    (p_route->>'data_trasy')::date,
    (p_route->>'planowany_start_at')::timestamptz,
    coalesce(p_route->>'status', 'planned'),
    p_route->>'base_address_snapshot',
    nullif(p_route->>'base_lat_snapshot', '')::numeric,
    nullif(p_route->>'base_lon_snapshot', '')::numeric,
    coalesce((p_route->>'total_distance_m')::integer, 0),
    coalesce((p_route->>'total_duration_s')::integer, 0),
    nullif(p_route->>'notes', '')
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
      eta_to,
      czas_postoju_min
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
      nullif(v_stop->>'eta_to', '')::timestamptz,
      nullif(v_stop->>'czas_postoju_min', '')::integer
    )
    returning * into v_route_stop;

    update public.reklamacje
    set
      status = U&'Zaplanowano tras\0119',
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
        'trasa_nazwa', v_route.nazwa,
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
    'numer', v_route.numer,
    'nazwa', v_route.nazwa
  );
end;
$$;

commit;
