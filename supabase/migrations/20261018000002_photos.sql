-- =====================================================================
-- Fotos das avaliações (máx. 3 por avaliação) no Supabase Storage.
-- Bucket privado: só membros veem, via URLs assinadas.
-- Caminho dos arquivos: <user_id>/<review_id>/<arquivo>.jpg
-- =====================================================================

create table public.review_photos (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.reviews (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  path       text not null unique check (char_length(path) <= 300),
  created_at timestamptz not null default now()
);

create index review_photos_review_idx on public.review_photos (review_id);

create function public.check_review_photos_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.review_photos where review_id = new.review_id) >= 3 then
    raise exception 'limite_de_fotos' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger review_photos_limit
  before insert on public.review_photos
  for each row execute function public.check_review_photos_limit();

revoke all on public.review_photos from anon, authenticated;
grant select, insert, delete on public.review_photos to authenticated;

alter table public.review_photos enable row level security;

create policy "fotos: membros veem"
  on public.review_photos for select to authenticated
  using (public.is_member());

-- Só dá pra anexar foto na própria avaliação, dentro da própria pasta.
create policy "fotos: anexar na própria avaliação"
  on public.review_photos for insert to authenticated
  with check (
    public.is_member()
    and user_id = auth.uid()
    and split_part(path, '/', 1) = auth.uid()::text
    and exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid())
  );

create policy "fotos: apagar as próprias ou admin"
  on public.review_photos for delete to authenticated
  using (public.is_admin() or (public.is_member() and user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- Bucket e políticas do Storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "fotos storage: membros veem"
  on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.is_member());

create policy "fotos storage: membros enviam na própria pasta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and public.is_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fotos storage: apagar as próprias ou admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'fotos'
    and (public.is_admin() or (public.is_member() and (storage.foldername(name))[1] = auth.uid()::text))
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.review_photos;
  end if;
end;
$$;
