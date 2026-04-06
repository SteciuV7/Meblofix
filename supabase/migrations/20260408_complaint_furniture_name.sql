alter table if exists public.reklamacje
add column if not exists nazwa_mebla text;

update public.reklamacje
set nazwa_mebla = 'Nie podano'
where nazwa_mebla is null or btrim(nazwa_mebla) = '';

alter table if exists public.reklamacje
alter column nazwa_mebla set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reklamacje_nazwa_mebla_not_blank_check'
  ) then
    alter table public.reklamacje
      add constraint reklamacje_nazwa_mebla_not_blank_check
      check (btrim(nazwa_mebla) <> '');
  end if;
end
$$;
