alter table if exists public.reklamacje
add column if not exists imie_klienta text;

alter table if exists public.reklamacje
add column if not exists nazwisko_klienta text;

alter table if exists public.reklamacje
add column if not exists telefon_klienta text;
