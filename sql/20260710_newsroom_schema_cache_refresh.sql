-- Run this after applying or re-applying newsroom table changes in Supabase.
-- It asks PostgREST to refresh its schema cache so new draft tables/columns are
-- visible to the REST API used by supabase-js.

select pg_notify('pgrst', 'reload schema');
