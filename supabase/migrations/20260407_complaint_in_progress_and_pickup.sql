alter table if exists public.reklamacje
  add column if not exists informacje text,
  add column if not exists element_odebrany boolean not null default false;

update public.reklamacje
set element_odebrany = false
where element_odebrany is null;

update public.reklamacje
set status = 'W trakcie realizacji'
where status = 'Oczekuje na informacje';
