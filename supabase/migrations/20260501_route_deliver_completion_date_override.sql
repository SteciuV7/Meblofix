drop function if exists public.deliver_route_stop(uuid, uuid, text, text, jsonb, text, uuid, text, text);

create function public.deliver_route_stop(
  p_route_id uuid,
  p_stop_id uuid,
  p_data_zakonczenia timestamptz default null,
  p_opis_przebiegu text default null,
  p_zalacznik_pdf_zakonczenie text default null,
  p_zalacznik_zakonczenie jsonb default '[]'::jsonb,
  p_informacje text default null,
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
    raise exception 'Dostarczenie punktu jest mozliwe tylko dla trasy w toku.';
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
    raise exception 'Ten punkt zostal juz oznaczony jako dostarczony.';
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
    status = U&'Zako\0144czone',
    data_zakonczenia = coalesce(p_data_zakonczenia, now()),
    informacje = case
      when p_informacje is null then informacje
      else nullif(trim(p_informacje), '')
    end,
    opis_przebiegu = nullif(trim(coalesce(p_opis_przebiegu, '')), ''),
    zalacznik_pdf_zakonczenie = p_zalacznik_pdf_zakonczenie,
    zalacznik_zakonczenie = array(
      select jsonb_array_elements_text(coalesce(p_zalacznik_zakonczenie, '[]'::jsonb))
    ),
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
    jsonb_build_object(
      'trasa_numer', v_route.numer,
      'images_count', jsonb_array_length(coalesce(p_zalacznik_zakonczenie, '[]'::jsonb)),
      'has_pdf', p_zalacznik_pdf_zakonczenie is not null
    )
  );

  return jsonb_build_object(
    'stop_id', v_updated_stop.id,
    'reklamacja_id', v_updated_reklamacja.id
  );
end;
$$;
