alter table public.suitfire_editorial_reports add column story_type text not null default 'match' check (story_type in ('match','season','event','vanguard','faction','rivalry'));
