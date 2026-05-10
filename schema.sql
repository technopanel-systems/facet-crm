-- ============================================================
-- FACET CRM — Complete Database Schema
-- Paste this ENTIRE file into Supabase → SQL Editor → Run
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists reps (
  id                   uuid primary key default uuid_generate_v4(),
  name                 text not null,
  email                text not null unique,
  role                 text not null default 'rep' check (role in ('rep','manager')),
  status               text not null default 'active' check (status in ('active','inactive')),
  monthly_target_sqm   numeric not null default 0,
  auth_user_id         uuid unique,
  created_at           timestamptz not null default now()
);

create table if not exists companies (
  id                       uuid primary key default uuid_generate_v4(),
  customer_code            text unique,
  company_name             text not null,
  company_name_normalized  text,
  company_type             text check (company_type in ('Factory','Contractor','Developer','Consultant','Trading','Government','Other')),
  contact1_name            text,
  contact1_phone           text,
  contact2_name            text,
  contact2_phone           text,
  region                   text check (region in ('Central','West','East','North','South','Foreign')),
  source                   text check (source in ('Form','Marketing','Management','Referral','Direct','Exhibition')),
  primary_rep_id           uuid references reps(id),
  shared_with              text,
  status                   text not null default 'active' check (status in ('active','inactive','blocked')),
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table if not exists projects (
  id               uuid primary key default uuid_generate_v4(),
  project_code     text unique,
  customer_id      uuid references companies(id) on delete set null,
  company_name     text not null,
  project_name     text,
  city             text,
  stage            text not null default 'New Lead' check (stage in (
                     'New Lead','Catalog Sent','Quotation Sent',
                     'Under Review','Won','In Production','Delivered','Lost'
                   )),
  quoted_sqm       numeric not null default 0,
  won_sqm          numeric not null default 0,
  assigned_rep_id  uuid references reps(id),
  shared_with      text,
  sqm_split        text,
  quote_date       date,
  expected_close   date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists activities (
  id                 uuid primary key default uuid_generate_v4(),
  activity_code      text unique,
  activity_date      date not null,
  month              text,
  rep_id             uuid references reps(id),
  rep_name           text not null,
  company_name       text not null,
  company_type       text,
  contact_person     text,
  phone              text,
  interaction_type   text check (interaction_type in ('Visit','Call','WhatsApp','Email','Meeting','Site Visit')),
  project_name       text,
  notes              text,
  region             text,
  sqm_done           numeric default 0,
  sqm_expected       numeric default 0,
  submitted_at       timestamptz not null default now(),
  submission_status  text check (submission_status in ('on_time','late','missing')),
  created_at         timestamptz not null default now()
);

create table if not exists duplicate_flags (
  id              uuid primary key default uuid_generate_v4(),
  customer_id_1   uuid references companies(id) on delete cascade,
  customer_id_2   uuid references companies(id) on delete cascade,
  match_type      text check (match_type in ('phone','name')),
  match_key       text,
  classification  text not null default 'pending' check (classification in ('pending','shared','conflict','resolved')),
  resolved_at     timestamptz,
  resolved_by     uuid references reps(id),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- AUTO-CODE SEQUENCES
-- ============================================================

create sequence if not exists customer_code_seq start 1;
create sequence if not exists project_code_seq start 1;
create sequence if not exists activity_code_seq start 1;

create or replace function set_customer_code()
returns trigger language plpgsql as $$
begin
  if new.customer_code is null then
    new.customer_code := 'CUST-' || lpad(nextval('customer_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create or replace function set_project_code()
returns trigger language plpgsql as $$
begin
  if new.project_code is null then
    new.project_code := 'PROJ-' || lpad(nextval('project_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create or replace function set_activity_code()
returns trigger language plpgsql as $$
begin
  if new.activity_code is null then
    new.activity_code := 'ACT-' || lpad(nextval('activity_code_seq')::text, 5, '0');
  end if;
  if new.activity_date is not null then
    new.month := to_char(new.activity_date, 'Month YYYY');
  end if;
  if new.submission_status is null then
    if date(new.submitted_at at time zone 'Asia/Riyadh') = new.activity_date then
      new.submission_status := 'on_time';
    elsif date(new.submitted_at at time zone 'Asia/Riyadh') > new.activity_date then
      new.submission_status := 'late';
    end if;
  end if;
  return new;
end;
$$;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_customer_code on companies;
create trigger trg_customer_code before insert on companies
  for each row execute function set_customer_code();

drop trigger if exists trg_project_code on projects;
create trigger trg_project_code before insert on projects
  for each row execute function set_project_code();

drop trigger if exists trg_activity_code on activities;
create trigger trg_activity_code before insert on activities
  for each row execute function set_activity_code();

drop trigger if exists trg_companies_updated on companies;
create trigger trg_companies_updated before update on companies
  for each row execute function set_updated_at();

drop trigger if exists trg_projects_updated on projects;
create trigger trg_projects_updated before update on projects
  for each row execute function set_updated_at();

-- ============================================================
-- ARABIC NORMALIZATION
-- ============================================================

create or replace function normalize_arabic(input text)
returns text language plpgsql as $$
declare result text;
begin
  result := lower(coalesce(input, ''));
  result := regexp_replace(result, '[\u064B-\u065F\u0670]', '', 'g');
  result := replace(result, 'أ', 'ا');
  result := replace(result, 'إ', 'ا');
  result := replace(result, 'آ', 'ا');
  result := replace(result, 'ٱ', 'ا');
  result := replace(result, 'ة', 'ه');
  result := replace(result, 'ى', 'ي');
  result := regexp_replace(result, '^ال', '', 'g');
  result := trim(regexp_replace(result, '\s+', ' ', 'g'));
  return result;
end;
$$;

create or replace function auto_normalize_customer()
returns trigger language plpgsql as $$
begin
  new.company_name_normalized := normalize_arabic(new.company_name);
  return new;
end;
$$;

drop trigger if exists trg_normalize_customer on companies;
create trigger trg_normalize_customer before insert or update on companies
  for each row execute function auto_normalize_customer();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table reps enable row level security;
alter table companies enable row level security;
alter table projects enable row level security;
alter table activities enable row level security;
alter table duplicate_flags enable row level security;

create or replace function current_user_role()
returns text language sql security definer stable as $$
  select role from reps where auth_user_id = auth.uid() limit 1;
$$;

create or replace function current_rep_id()
returns uuid language sql security definer stable as $$
  select id from reps where auth_user_id = auth.uid() limit 1;
$$;

create or replace function current_rep_name()
returns text language sql security definer stable as $$
  select name from reps where auth_user_id = auth.uid() limit 1;
$$;

-- REPS
drop policy if exists "reps_read" on reps;
create policy "reps_read" on reps for select using (auth.uid() is not null);
drop policy if exists "reps_manager_write" on reps;
create policy "reps_manager_write" on reps for all using (current_user_role() = 'manager');

-- companies: managers all, reps see assigned or shared
drop policy if exists "companies_manager" on companies;
create policy "companies_manager" on companies for all using (current_user_role() = 'manager');

drop policy if exists "companies_rep_read" on companies;
create policy "companies_rep_read" on companies for select using (
  current_user_role() = 'rep' and (
    primary_rep_id = current_rep_id() or
    shared_with ilike '%' || current_rep_name() || '%'
  )
);

drop policy if exists "companies_rep_update" on companies;
create policy "companies_rep_update" on companies for update using (
  current_user_role() = 'rep' and (
    primary_rep_id = current_rep_id() or
    shared_with ilike '%' || current_rep_name() || '%'
  )
);

-- PROJECTS: managers all, reps see assigned or shared
drop policy if exists "projects_manager" on projects;
create policy "projects_manager" on projects for all using (current_user_role() = 'manager');

drop policy if exists "projects_rep_read" on projects;
create policy "projects_rep_read" on projects for select using (
  current_user_role() = 'rep' and (
    assigned_rep_id = current_rep_id() or
    shared_with ilike '%' || current_rep_name() || '%'
  )
);

-- ACTIVITIES: managers all, reps only their own
drop policy if exists "activities_manager" on activities;
create policy "activities_manager" on activities for all using (current_user_role() = 'manager');

drop policy if exists "activities_rep_read" on activities;
create policy "activities_rep_read" on activities for select using (
  current_user_role() = 'rep' and rep_id = current_rep_id()
);

drop policy if exists "activities_rep_insert" on activities;
create policy "activities_rep_insert" on activities for insert with check (
  current_user_role() = 'rep' and rep_id = current_rep_id()
);

-- DUPLICATES: managers only
drop policy if exists "duplicates_manager" on duplicate_flags;
create policy "duplicates_manager" on duplicate_flags for all using (current_user_role() = 'manager');

-- ============================================================
-- VIEWS
-- ============================================================

create or replace view rep_monthly_sqm as
select
  r.id as rep_id,
  r.name as rep_name,
  r.monthly_target_sqm as target_sqm,
  date_trunc('month', a.activity_date)::date as month_start,
  to_char(a.activity_date, 'Month YYYY') as month_label,
  coalesce(sum(a.sqm_done), 0) as achieved_sqm,
  coalesce(sum(a.sqm_expected), 0) as pipeline_sqm,
  count(a.id) as activity_count
from reps r
left join activities a on a.rep_id = r.id
where r.status = 'active'
group by r.id, r.name, r.monthly_target_sqm,
         date_trunc('month', a.activity_date),
         to_char(a.activity_date, 'Month YYYY');

-- ============================================================
-- SEED REPS
-- Update emails to match your actual company email addresses
-- ============================================================

insert into reps (name, email, role, status, monthly_target_sqm) values
  ('Ahmed Alzaben',     'ahmed.alzaben@technopanel.com.sa',     'rep',     'active', 2000),
  ('Ahmed Salahdin',    'ahmed.salahdin@technopanel.com.sa',    'rep',     'active', 2000),
  ('Ibrahem Humran',    'ibrahem.humran@technopanel.com.sa',    'rep',     'active', 2000),
  ('Moein Momani',      'moein.momani@technopanel.com.sa',      'rep',     'active', 2000),
  ('Mohammed Basiouny', 'mohammed.basiouny@technopanel.com.sa', 'rep',     'active', 2000),
  ('Najla AlSalami',    'najla.alsalami@technopanel.com.sa',    'rep',     'active', 2000),
  ('Omar Ahmed',        'omar.ahmed@technopanel.com.sa',        'rep',     'active', 2000),
  ('Reefah AlShammeri', 'reefah.alshammeri@technopanel.com.sa', 'rep',     'active', 2000),
  ('Sales Department',  'sales@technopanel.com.sa',             'rep',     'active', 0),
  ('Zaid Arar',         'zaid.arar@technopanel.com.sa',         'manager', 'active', 0),
  ('Zyad Osama',        'zyad.osama@technopanel.com.sa',        'rep',     'active', 2000)
on conflict (email) do nothing;

-- ============================================================
-- Done! FACET CRM database is ready.
-- ============================================================
