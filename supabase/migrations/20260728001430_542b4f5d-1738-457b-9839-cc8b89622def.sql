
create policy "admin read corporate docs" on storage.objects for select to authenticated
  using (bucket_id = 'corporate-documents' and public.has_role(auth.uid(),'admin'));
create policy "admin insert corporate docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'corporate-documents' and public.has_role(auth.uid(),'admin'));
create policy "admin update corporate docs" on storage.objects for update to authenticated
  using (bucket_id = 'corporate-documents' and public.has_role(auth.uid(),'admin'));
create policy "admin delete corporate docs" on storage.objects for delete to authenticated
  using (bucket_id = 'corporate-documents' and public.has_role(auth.uid(),'admin'));
