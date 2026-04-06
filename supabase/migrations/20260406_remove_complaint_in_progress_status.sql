update public.reklamacje
set status = U&'Oczekuje na dostaw\0119'
where status = 'W trakcie realizacji';
