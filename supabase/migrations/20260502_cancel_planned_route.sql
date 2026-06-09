drop function if exists public.cancel_planned_route(uuid, uuid, text, text);

create function public.cancel_planned_route(
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
  v_cancelled_route public.trasy%rowtype;
  v_existing_stop public.trasy_punkty%rowtype;
  v_reklamacja public.reklamacje%rowtype;
  v_updated_reklamacja public.reklamacje%rowtype;
  v_removed_count integer := 0;
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
    raise exception 'Usuniecie jest dozwolone tylko dla tras zaplanowanych.';
  end if;

  for v_existing_stop in
    select *
    from public.trasy_punkty
    where trasa_id = p_route_id
    order by kolejnosc
    for update
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
      null,
      p_actor_firma_id,
      p_actor_email,
      p_actor_role,
      to_jsonb(v_reklamacja),
      to_jsonb(v_updated_reklamacja),
      jsonb_build_object(
        'source', 'cancel_planned_route',
        'trasa_numer', v_route.numer,
        'trasa_nazwa', v_route.nazwa,
        'kolejnosc', v_existing_stop.kolejnosc
      )
    );

    perform public.write_operational_log(
      'trasa_punkt',
      v_existing_stop.id,
      'route_stop_removed',
      v_existing_stop.reklamacja_id,
      p_route_id,
      null,
      p_actor_firma_id,
      p_actor_email,
      p_actor_role,
      to_jsonb(v_existing_stop),
      null,
      jsonb_build_object(
        'source', 'cancel_planned_route',
        'trasa_numer', v_route.numer,
        'trasa_nazwa', v_route.nazwa
      )
    );

    v_removed_count := v_removed_count + 1;
  end loop;

  delete from public.trasy_punkty
  where trasa_id = p_route_id;

  update public.trasy
  set
    status = 'cancelled'
  where id = p_route_id
  returning * into v_cancelled_route;

  perform public.write_operational_log(
    'trasa',
    v_cancelled_route.id,
    'route_cancelled',
    null,
    v_cancelled_route.id,
    null,
    p_actor_firma_id,
    p_actor_email,
    p_actor_role,
    to_jsonb(v_route),
    to_jsonb(v_cancelled_route),
    jsonb_build_object(
      'source', 'cancel_planned_route',
      'trasa_numer', v_route.numer,
      'trasa_nazwa', v_route.nazwa,
      'stops_count', v_removed_count
    )
  );

  return jsonb_build_object(
    'route_id', v_cancelled_route.id,
    'status', v_cancelled_route.status,
    'stops_count', v_removed_count
  );
end;
$$;
