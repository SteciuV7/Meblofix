alter table public.ustawienia_operacyjne
  add column if not exists sms_kontakt_telefon text,
  add column if not exists sms_szablon_potwierdzenia text not null default 'Twoja reklamacja zostala zaplanowana na {{okno}}, prosimy o potwierdzenie pod linkiem {{link}} lub kontakt {{telefon}}',
  add column if not exists sms_szablon_startu_trasy text not null default 'Zaplanowana reklamacja wyruszyla w trase. Termin: {{okno}}. Pozdrawiamy, Meblofix';

update public.ustawienia_operacyjne
set
  sms_szablon_potwierdzenia = coalesce(
    nullif(sms_szablon_potwierdzenia, ''),
    'Twoja reklamacja zostala zaplanowana na {{okno}}, prosimy o potwierdzenie pod linkiem {{link}} lub kontakt {{telefon}}'
  ),
  sms_szablon_startu_trasy = coalesce(
    nullif(sms_szablon_startu_trasy, ''),
    'Zaplanowana reklamacja wyruszyla w trase. Termin: {{okno}}. Pozdrawiamy, Meblofix'
  );

alter table public.trasy
  add column if not exists sms_potwierdzenia_wyslane_at timestamp with time zone;

alter table public.trasy_punkty
  add column if not exists sms_potwierdzenie_status text not null default 'not_sent',
  add column if not exists sms_potwierdzenie_sent_at timestamp with time zone,
  add column if not exists sms_potwierdzenie_confirmed_at timestamp with time zone,
  add column if not exists sms_potwierdzenie_token_hash text,
  add column if not exists sms_potwierdzenie_short_url text;

update public.trasy_punkty
set sms_potwierdzenie_status = 'not_sent'
where sms_potwierdzenie_status is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trasy_punkty_sms_potwierdzenie_status_check'
  ) then
    alter table public.trasy_punkty
      add constraint trasy_punkty_sms_potwierdzenie_status_check
      check (
        sms_potwierdzenie_status in (
          'not_sent',
          'sent',
          'confirmed',
          'manual_rejected'
        )
      );
  end if;
end
$$;

create unique index if not exists trasy_punkty_sms_potwierdzenie_token_hash_unique
  on public.trasy_punkty (sms_potwierdzenie_token_hash)
  where sms_potwierdzenie_token_hash is not null;
