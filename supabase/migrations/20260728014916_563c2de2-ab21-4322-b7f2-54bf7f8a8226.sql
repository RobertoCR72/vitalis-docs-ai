-- 1) documents: restringe leitura por classificação para não-admins
DROP POLICY IF EXISTS "auth read published" ON public.documents;
CREATE POLICY "auth read published"
ON public.documents
FOR SELECT
TO authenticated
USING (
  (
    status = 'published'::document_status
    AND processing_status = 'ready'::processing_status
    AND classification = 'demo'::classification_level
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2) document_chunks: mesma restrição
DROP POLICY IF EXISTS "auth read chunks of published" ON public.document_chunks;
CREATE POLICY "auth read chunks of published"
ON public.document_chunks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_chunks.document_id
      AND (
        (
          d.status = 'published'::document_status
          AND d.processing_status = 'ready'::processing_status
          AND d.classification = 'demo'::classification_level
        )
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- 3) match_document_chunks: filtro por classificação
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector,
  query_text text,
  match_count integer DEFAULT 12
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  page_start integer,
  page_end integer,
  section_title text,
  similarity double precision,
  text_rank double precision,
  document_title text,
  document_code text,
  document_version text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select c.id, c.document_id, c.chunk_index, c.content, c.page_start, c.page_end, c.section_title,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity,
    coalesce(ts_rank(c.search_vector, plainto_tsquery('portuguese', query_text)), 0) as text_rank,
    d.title, d.document_code, d.version
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where d.status = 'published'
    and d.processing_status = 'ready'
    and (d.effective_date is null or d.effective_date <= current_date)
    and (d.classification = 'demo'::classification_level or public.has_role(auth.uid(), 'admin'::app_role))
    and c.embedding is not null
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;

-- 4) Auditoria segura (grava sempre em nome do próprio auth.uid())
CREATE OR REPLACE FUNCTION public.record_audit(
  _action text,
  _resource_type text,
  _resource_id text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.audit_events(actor_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), _action, _resource_type, _resource_id, coalesce(_metadata, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.record_audit(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_audit(text, text, text, jsonb) TO authenticated;

-- 5) Rate limit atômico: insere primeiro e devolve decisão sem corrida
CREATE OR REPLACE FUNCTION public.record_and_check_ask_limit(
  _per_hour integer,
  _per_day integer
)
RETURNS TABLE(allowed boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  hour_cnt integer;
  day_cnt integer;
BEGIN
  IF uid IS NULL THEN
    allowed := false; reason := 'unauthenticated'; RETURN NEXT; RETURN;
  END IF;
  INSERT INTO public.usage_events(user_id, kind) VALUES (uid, 'ask');
  SELECT count(*) INTO hour_cnt FROM public.usage_events
    WHERE user_id = uid AND kind = 'ask' AND created_at >= now() - interval '1 hour';
  SELECT count(*) INTO day_cnt FROM public.usage_events
    WHERE user_id = uid AND kind = 'ask' AND created_at >= now() - interval '1 day';
  IF hour_cnt > _per_hour THEN
    allowed := false; reason := 'hourly'; RETURN NEXT; RETURN;
  END IF;
  IF day_cnt > _per_day THEN
    allowed := false; reason := 'daily'; RETURN NEXT; RETURN;
  END IF;
  allowed := true; reason := NULL; RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.record_and_check_ask_limit(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_and_check_ask_limit(integer, integer) TO authenticated;