REVOKE ALL ON FUNCTION public.record_audit(text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_and_check_ask_limit(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_audit(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_and_check_ask_limit(integer, integer) TO authenticated;