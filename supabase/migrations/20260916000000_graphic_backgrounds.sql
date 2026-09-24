-- Public images; writes remain restricted to the authenticated admin Edge Function.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('graphic-backgrounds', 'graphic-backgrounds', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
