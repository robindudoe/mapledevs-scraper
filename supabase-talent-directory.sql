-- MapleDevs Talent Directory
-- Run this in Supabase SQL Editor after the account tables exist.
-- It exposes only opted-in candidate profile fields. Login emails are not returned.

drop function if exists public.get_public_candidate_directory();

create or replace function public.get_public_candidate_directory()
returns table (
  public_id text,
  username text,
  display_name text,
  headline text,
  location text,
  website_url text,
  resume_title text,
  summary text,
  skills text[],
  engines text[],
  preferred_locations text[],
  preferred_work_modes text[],
  portfolio_url text,
  linkedin_url text,
  github_url text,
  open_to_work boolean,
  years_experience integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(nullif(p.username, ''), 'candidate-' || left(p.id::text, 8)) as public_id,
    p.username::text as username,
    p.display_name::text as display_name,
    p.headline::text as headline,
    p.location::text as location,
    p.website_url::text as website_url,
    c.resume_title::text as resume_title,
    c.summary::text as summary,
    coalesce(c.skills, array[]::text[]) as skills,
    coalesce(c.engines, array[]::text[]) as engines,
    coalesce(c.preferred_locations, array[]::text[]) as preferred_locations,
    coalesce(c.preferred_work_modes, array[]::text[]) as preferred_work_modes,
    c.portfolio_url::text as portfolio_url,
    c.linkedin_url::text as linkedin_url,
    c.github_url::text as github_url,
    coalesce(c.open_to_work, true) as open_to_work,
    c.years_experience::integer as years_experience,
    coalesce(p.updated_at, p.created_at, now()) as updated_at
  from public.profiles p
  join public.candidate_profiles c on c.user_id = p.id
  where p.account_type = 'candidate'
    and c.visibility = 'public'
  order by coalesce(c.open_to_work, true) desc, coalesce(p.updated_at, p.created_at, now()) desc;
$$;

revoke all on function public.get_public_candidate_directory() from public;
grant execute on function public.get_public_candidate_directory() to anon, authenticated;
