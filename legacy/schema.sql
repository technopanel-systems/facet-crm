-- ============================================================
-- FACET CRM — Production Schema
-- Last updated: May 2026
-- This file reflects the actual production database state.
-- DO NOT run this blindly on production — it uses IF NOT EXISTS
-- but constraints and policies may conflict with existing ones.
-- Use this as documentation and for staging environment setup.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TABLES
-- ============================================================

-- Branches (regional offices)
CREATE TABLE IF NOT EXISTS branches (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text NOT NULL,
  region     text CHECK (region IN ('Central','West','East','North','South')),
  is_active  boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Reps (all users: rep, manager, sales_coordinator, marketing)
CREATE TABLE IF NOT EXISTS reps (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 text NOT NULL,
  email                text NOT NULL UNIQUE,
  role                 text NOT NULL DEFAULT 'rep'
                         CHECK (role IN ('rep','manager','sales_coordinator','marketing')),
  status               text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','inactive','pending')),
  monthly_target_sqm   numeric NOT NULL DEFAULT 0,
  auth_user_id         uuid UNIQUE,
  branch_id            uuid REFERENCES branches(id),
  language_pref        text DEFAULT 'en',
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Companies (root CRM entity, previously called customers)
CREATE TABLE IF NOT EXISTS companies (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code            text UNIQUE,
  company_name             text NOT NULL,
  company_name_normalized  text,
  company_type             text CHECK (company_type IN (
                             'Factory','Advertising','Real Estate','Owner',
                             'Consultant','Contractor','Station Management',
                             'Workshop','Other'
                           )),
  region                   text CHECK (region IN (
                             'Central','West','East','North','South','Foreign'
                           )),
  source                   text CHECK (source IN (
                             'Form','Marketing','Management','Referral','Direct','Exhibition'
                           )),
  primary_rep_id           uuid REFERENCES reps(id),
  status                   text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','inactive','blocked')),
  branch_id                uuid REFERENCES branches(id),
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Company ↔ Rep junction table (replaces shared_with text column)
CREATE TABLE IF NOT EXISTS company_reps (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rep_id      uuid NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('primary','shared')),
  assigned_by uuid REFERENCES reps(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, rep_id)
);

-- Contacts (multiple per company)
CREATE TABLE IF NOT EXISTS contacts (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_code text UNIQUE,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  full_name_ar text,
  title        text,
  phone        text,
  whatsapp     text,
  email        text,
  is_primary   boolean DEFAULT false,
  notes        text,
  created_by   uuid REFERENCES reps(id),
  created_at   timestamptz,
  updated_at   timestamptz
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_code     text UNIQUE,
  customer_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  company_name     text, -- legacy cache, populated by trigger
  project_name     text,
  city             text,
  stage            text NOT NULL DEFAULT 'New Lead' CHECK (stage IN (
                     'New Lead','Catalog Sent','Quotation Sent',
                     'Under Review','Won','In Production','Delivered','Lost'
                   )),
  quoted_sqm       numeric NOT NULL DEFAULT 0,
  won_sqm          numeric NOT NULL DEFAULT 0,
  assigned_rep_id  uuid REFERENCES reps(id), -- legacy cache
  contact_id       uuid REFERENCES contacts(id),
  stage_changed_at timestamptz,
  next_follow_up   date,
  loss_reason      text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Project ↔ Rep junction table (replaces shared_with text column)
CREATE TABLE IF NOT EXISTS project_reps (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rep_id      uuid NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('primary','shared')),
  sqm_split   numeric,
  assigned_by uuid REFERENCES reps(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, rep_id)
);

-- Activities (daily rep reports)
CREATE TABLE IF NOT EXISTS activities (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_code      text UNIQUE,
  activity_date      date NOT NULL,
  month              text, -- auto-set by trigger
  rep_id             uuid REFERENCES reps(id),
  rep_name           text NOT NULL, -- legacy cache
  company_id         uuid REFERENCES companies(id),
  company_name       text NOT NULL,
  company_type       text,
  contact_id         uuid REFERENCES contacts(id),
  contact_person     text,
  phone              text,
  interaction_type   text CHECK (interaction_type IN (
                       'Visit','Call','WhatsApp','Email','Meeting','Site Visit'
                     )),
  project_id         uuid REFERENCES projects(id),
  project_name       text,
  notes              text,
  region             text,
  sqm_done           numeric DEFAULT 0,
  sqm_expected       numeric DEFAULT 0,
  submitted_at       timestamptz NOT NULL DEFAULT now(),
  submission_status  text CHECK (submission_status IN ('on_time','late','missing')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Quotations (created by sales coordinator, mirrors ERP)
CREATE TABLE IF NOT EXISTS quotations (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_code   text UNIQUE,
  project_id       uuid REFERENCES projects(id) ON DELETE CASCADE,
  company_id       uuid REFERENCES companies(id),
  rep_id           uuid REFERENCES reps(id),
  coordinator_id   uuid REFERENCES reps(id),
  product_type     text CHECK (product_type IN (
                     'Normal ACP','FR B1 ACP','FR A2 ACP','A2G2 ACP','Other'
                   )),
  finish           text CHECK (finish IN ('Solid Color','Wood Finish','Custom')),
  sqm_quoted       numeric NOT NULL DEFAULT 0,
  price_per_sqm    numeric,
  quote_date       date,
  valid_until      date,
  revision_number  integer DEFAULT 1,
  last_revised_at  timestamptz,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN (
                     'pending','submitted','won','lost','expired','cancelled'
                   )),
  sqm_invoiced     numeric DEFAULT 0,
  sqm_delivered    numeric DEFAULT 0,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Duplicate flags (system-detected, manager-resolved)
CREATE TABLE IF NOT EXISTS duplicate_flags (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id_1   uuid REFERENCES companies(id) ON DELETE CASCADE,
  company_id_2   uuid REFERENCES companies(id) ON DELETE CASCADE,
  match_type     text CHECK (match_type IN ('phone','name')),
  match_key      text,
  classification text NOT NULL DEFAULT 'pending'
                   CHECK (classification IN ('pending','shared','conflict','resolved')),
  resolved_at    timestamptz,
  resolved_by    uuid REFERENCES reps(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Notifications (in-app, per recipient)
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id uuid REFERENCES reps(id) ON DELETE CASCADE,
  type         text CHECK (type IN (
                 'duplicate_alert','pending_approval','assignment',
                 'project_stale','quotation_expiry','follow_up_due',
                 'lead_submitted','missing_submission','system'
               )),
  title        text NOT NULL,
  body         text,
  entity_type  text CHECK (entity_type IN (
                 'company','contact','project','quotation','rep'
               )),
  entity_id    uuid,
  is_read      boolean DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Company holidays (team-wide excused days)
CREATE TABLE IF NOT EXISTS company_holidays (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  holiday_name text NOT NULL,
  date_from    date NOT NULL,
  date_to      date NOT NULL,
  created_by   uuid REFERENCES reps(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (date_to >= date_from)
);

-- Rep absences (individual excused periods)
CREATE TABLE IF NOT EXISTS rep_absences (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rep_id       uuid NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  absence_type text NOT NULL CHECK (absence_type IN (
                  'sick','annual_leave','eid_vacation','other'
                )),
  date_from    date NOT NULL,
  date_to      date NOT NULL,
  notes        text,
  created_by   uuid REFERENCES reps(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_absence_range CHECK (date_to >= date_from)
);

-- ============================================================
-- AUTO-CODE SEQUENCES
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS customer_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS project_code_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS activity_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS quotation_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS contact_code_seq  START 1;

-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION set_customer_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.customer_code IS NULL THEN
    new.customer_code := 'CUST-' || lpad(nextval('customer_code_seq')::text, 5, '0');
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION set_project_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.project_code IS NULL THEN
    new.project_code := 'PROJ-' || lpad(nextval('project_code_seq')::text, 5, '0');
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION set_quotation_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.quotation_code IS NULL THEN
    new.quotation_code := 'QUO-' || lpad(nextval('quotation_code_seq')::text, 5, '0');
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION set_contact_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.contact_code IS NULL THEN
    new.contact_code := 'CON-' || lpad(nextval('contact_code_seq')::text, 5, '0');
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at := now();
  RETURN new;
END;
$$;

-- Activity code + submission status (weekend + holiday + absence aware)
CREATE OR REPLACE FUNCTION set_activity_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  submitted_date   date;
  activity_dow     int;
  next_working_day date;
  is_excused       boolean := false;
BEGIN
  IF new.activity_code IS NULL THEN
    new.activity_code := 'ACT-' || lpad(nextval('activity_code_seq')::text, 5, '0');
  END IF;

  IF new.activity_date IS NOT NULL THEN
    new.month := to_char(new.activity_date, 'Month YYYY');
  END IF;

  IF new.submission_status IS NULL THEN
    submitted_date := date(new.submitted_at AT TIME ZONE 'Asia/Riyadh');
    activity_dow   := EXTRACT(DOW FROM new.activity_date);

    IF activity_dow IN (5, 6) THEN
      new.submission_status := 'on_time';
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM company_holidays
        WHERE new.activity_date BETWEEN date_from AND date_to
      ) INTO is_excused;

      IF NOT is_excused AND new.rep_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM rep_absences
          WHERE rep_id = new.rep_id
          AND new.activity_date BETWEEN date_from AND date_to
        ) INTO is_excused;
      END IF;

      IF is_excused THEN
        new.submission_status := 'on_time';
      ELSIF submitted_date = new.activity_date THEN
        new.submission_status := 'on_time';
      ELSIF submitted_date > new.activity_date THEN
        next_working_day := new.activity_date + 1;
        LOOP
          IF EXTRACT(DOW FROM next_working_day) IN (5, 6) THEN
            next_working_day := next_working_day + 1;
            CONTINUE;
          END IF;
          IF EXISTS (
            SELECT 1 FROM company_holidays
            WHERE next_working_day BETWEEN date_from AND date_to
          ) THEN
            next_working_day := next_working_day + 1;
            CONTINUE;
          END IF;
          EXIT;
        END LOOP;

        IF submitted_date <= next_working_day THEN
          new.submission_status := 'on_time';
        ELSE
          new.submission_status := 'late';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN new;
END;
$$;

-- Arabic normalization
CREATE OR REPLACE FUNCTION normalize_arabic(input text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE result text;
BEGIN
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
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION auto_normalize_customer()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.company_name_normalized := normalize_arabic(new.company_name);
  RETURN new;
END;
$$;

-- Missing submission notifications (called from dashboard on load)
CREATE OR REPLACE FUNCTION check_missing_submissions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  prev_working_day date;
  rep_record       RECORD;
  manager_record   RECORD;
  already_notified boolean;
  is_excused       boolean;
BEGIN
  prev_working_day := CURRENT_DATE - 1;
  LOOP
    IF EXTRACT(DOW FROM prev_working_day) IN (5, 6) THEN
      prev_working_day := prev_working_day - 1;
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM company_holidays
      WHERE prev_working_day BETWEEN date_from AND date_to
    ) THEN
      prev_working_day := prev_working_day - 1;
      CONTINUE;
    END IF;
    EXIT;
  END LOOP;

  FOR rep_record IN
    SELECT id, name FROM reps
    WHERE status = 'active' AND role IN ('rep', 'marketing')
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM rep_absences
      WHERE rep_id = rep_record.id
      AND prev_working_day BETWEEN date_from AND date_to
    ) INTO is_excused;

    IF is_excused THEN CONTINUE; END IF;

    IF NOT EXISTS (
      SELECT 1 FROM activities
      WHERE rep_id = rep_record.id
      AND activity_date = prev_working_day
    ) THEN
      SELECT EXISTS (
        SELECT 1 FROM notifications
        WHERE recipient_id = rep_record.id
        AND type = 'missing_submission'
        AND created_at::date = CURRENT_DATE
        AND body LIKE '%' || prev_working_day::text || '%'
      ) INTO already_notified;

      IF NOT already_notified THEN
        INSERT INTO notifications (recipient_id, type, title, body, entity_type)
        VALUES (
          rep_record.id, 'missing_submission', 'Missing Daily Report',
          'You have not submitted your daily report for ' ||
            to_char(prev_working_day, 'DD Mon YYYY') ||
            '. Please submit it or ask your manager to record an absence.',
          'rep'
        );

        FOR manager_record IN
          SELECT id FROM reps WHERE status = 'active' AND role = 'manager'
        LOOP
          SELECT EXISTS (
            SELECT 1 FROM notifications
            WHERE recipient_id = manager_record.id
            AND type = 'missing_submission'
            AND created_at::date = CURRENT_DATE
            AND body LIKE '%' || rep_record.name || '%'
            AND body LIKE '%' || prev_working_day::text || '%'
          ) INTO already_notified;

          IF NOT already_notified THEN
            INSERT INTO notifications (recipient_id, type, title, body, entity_type)
            VALUES (
              manager_record.id, 'missing_submission',
              'Missing Report: ' || rep_record.name,
              rep_record.name || ' has not submitted their daily report for ' ||
                to_char(prev_working_day, 'DD Mon YYYY') || '.',
              'rep'
            );
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Duplicate detection (server-side, pg_trgm)
CREATE OR REPLACE FUNCTION detect_duplicate_companies()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_flags integer := 0;
BEGIN
  INSERT INTO duplicate_flags (
    company_id_1, company_id_2, match_type, match_key, classification
  )
  SELECT a.id, b.id, 'name', a.company_name, 'pending'
  FROM companies a
  JOIN companies b ON b.id > a.id
  WHERE a.status = 'active' AND b.status = 'active'
  AND (
    a.company_name_normalized = b.company_name_normalized
    OR similarity(
      COALESCE(a.company_name_normalized, a.company_name),
      COALESCE(b.company_name_normalized, b.company_name)
    ) > 0.6
  )
  AND NOT EXISTS (
    SELECT 1 FROM duplicate_flags df
    WHERE (df.company_id_1 = a.id AND df.company_id_2 = b.id)
    OR    (df.company_id_1 = b.id AND df.company_id_2 = a.id)
  );

  GET DIAGNOSTICS new_flags = ROW_COUNT;
  RETURN new_flags;
END;
$$;

-- Atomic project creation with rep assignment
CREATE OR REPLACE FUNCTION create_project_with_rep(
  p_customer_id    uuid,
  p_project_name   text,
  p_city           text,
  p_stage          text,
  p_quoted_sqm     numeric,
  p_next_follow_up date,
  p_notes          text,
  p_contact_id     uuid,
  p_rep_id         uuid
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_project_id   uuid;
  v_company_name text;
BEGIN
  SELECT company_name INTO v_company_name FROM companies WHERE id = p_customer_id;

  INSERT INTO projects (
    customer_id, company_name, project_name, city, stage,
    quoted_sqm, next_follow_up, notes, contact_id, assigned_rep_id
  ) VALUES (
    p_customer_id, v_company_name, p_project_name, p_city, p_stage,
    p_quoted_sqm, p_next_follow_up, p_notes, p_contact_id, p_rep_id
  ) RETURNING id INTO v_project_id;

  IF p_rep_id IS NOT NULL THEN
    INSERT INTO project_reps (project_id, rep_id, role, assigned_by)
    VALUES (v_project_id, p_rep_id, 'primary', p_rep_id);
  END IF;

  RETURN v_project_id;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_customer_code ON companies;
CREATE TRIGGER trg_customer_code BEFORE INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION set_customer_code();

DROP TRIGGER IF EXISTS trg_normalize_customer ON companies;
CREATE TRIGGER trg_normalize_customer BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION auto_normalize_customer();

DROP TRIGGER IF EXISTS trg_companies_updated ON companies;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_contact_code ON contacts;
CREATE TRIGGER trg_contact_code BEFORE INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_contact_code();

DROP TRIGGER IF EXISTS trg_contacts_updated ON contacts;
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_project_code ON projects;
CREATE TRIGGER trg_project_code BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION set_project_code();

DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_activity_code ON activities;
CREATE TRIGGER trg_activity_code BEFORE INSERT ON activities
  FOR EACH ROW EXECUTE FUNCTION set_activity_code();

DROP TRIGGER IF EXISTS trg_quotation_code ON quotations;
CREATE TRIGGER trg_quotation_code BEFORE INSERT ON quotations
  FOR EACH ROW EXECUTE FUNCTION set_quotation_code();

DROP TRIGGER IF EXISTS trg_quotations_updated ON quotations;
CREATE TRIGGER trg_quotations_updated BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE reps              ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_reps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_reps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_flags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_holidays  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_absences      ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM reps WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_rep_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM reps WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- REPS
CREATE POLICY "reps_read"           ON reps FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "reps_manager_write"  ON reps FOR ALL    USING (current_user_role() = 'manager');

-- COMPANIES
CREATE POLICY "companies_manager"          ON companies FOR ALL    USING (current_user_role() IN ('manager','sales_coordinator'));
CREATE POLICY "companies_coordinator_read" ON companies FOR SELECT USING (current_user_role() = 'sales_coordinator');
CREATE POLICY "companies_rep_read"         ON companies FOR SELECT USING (
  current_user_role() IN ('rep','marketing') AND EXISTS (
    SELECT 1 FROM company_reps WHERE company_id = companies.id AND rep_id = current_rep_id()
  )
);
CREATE POLICY "companies_rep_update"       ON companies FOR UPDATE USING (
  current_user_role() IN ('rep','marketing') AND EXISTS (
    SELECT 1 FROM company_reps WHERE company_id = companies.id AND rep_id = current_rep_id()
  )
);
CREATE POLICY "companies_rep_insert"       ON companies FOR INSERT WITH CHECK (
  current_user_role() IN ('rep','marketing')
);

-- COMPANY_REPS
CREATE POLICY "company_reps_manager" ON company_reps FOR ALL    USING (current_user_role() = 'manager');
CREATE POLICY "company_reps_rep_read" ON company_reps FOR SELECT USING (
  current_user_role() IN ('rep','marketing') AND rep_id = current_rep_id()
);

-- CONTACTS
CREATE POLICY "contacts_manager"    ON contacts FOR ALL    USING (current_user_role() IN ('manager','sales_coordinator'));
CREATE POLICY "contacts_rep_read"   ON contacts FOR SELECT USING (
  current_user_role() IN ('rep','marketing') AND EXISTS (
    SELECT 1 FROM company_reps WHERE company_id = contacts.company_id AND rep_id = current_rep_id()
  )
);
CREATE POLICY "contacts_rep_insert" ON contacts FOR INSERT WITH CHECK (
  current_user_role() IN ('rep','marketing')
);

-- PROJECTS
CREATE POLICY "projects_manager"          ON projects FOR ALL    USING (current_user_role() IN ('manager','sales_coordinator'));
CREATE POLICY "projects_coordinator_read" ON projects FOR SELECT USING (current_user_role() = 'sales_coordinator');
CREATE POLICY "projects_rep_read"         ON projects FOR SELECT USING (
  current_user_role() IN ('rep','marketing') AND (
    assigned_rep_id = current_rep_id() OR EXISTS (
      SELECT 1 FROM project_reps WHERE project_id = projects.id AND rep_id = current_rep_id()
    )
  )
);
CREATE POLICY "projects_rep_update"       ON projects FOR UPDATE USING (
  current_user_role() IN ('rep','marketing') AND EXISTS (
    SELECT 1 FROM project_reps WHERE project_id = projects.id AND rep_id = current_rep_id()
  )
);
CREATE POLICY "projects_rep_insert"       ON projects FOR INSERT WITH CHECK (
  current_user_role() IN ('rep','marketing')
);

-- PROJECT_REPS
CREATE POLICY "project_reps_manager"  ON project_reps FOR ALL    USING (current_user_role() = 'manager');
CREATE POLICY "project_reps_rep_read" ON project_reps FOR SELECT USING (
  current_user_role() IN ('rep','marketing') AND rep_id = current_rep_id()
);

-- ACTIVITIES
CREATE POLICY "activities_manager"    ON activities FOR ALL    USING (current_user_role() = 'manager');
CREATE POLICY "activities_rep_read"   ON activities FOR SELECT USING (
  current_user_role() IN ('rep','marketing') AND rep_id = current_rep_id()
);
CREATE POLICY "activities_rep_insert" ON activities FOR INSERT WITH CHECK (
  current_user_role() IN ('rep','marketing') AND rep_id = current_rep_id()
);

-- QUOTATIONS
CREATE POLICY "quotations_manager"       ON quotations FOR ALL    USING (current_user_role() IN ('manager','sales_coordinator'));
CREATE POLICY "quotations_rep_read"      ON quotations FOR SELECT USING (
  current_user_role() IN ('rep','marketing') AND rep_id = current_rep_id()
);

-- DUPLICATE FLAGS
CREATE POLICY "duplicates_manager"       ON duplicate_flags FOR ALL USING (current_user_role() = 'manager');

-- NOTIFICATIONS
CREATE POLICY "notifications_own"        ON notifications FOR ALL    USING (recipient_id = current_rep_id());
CREATE POLICY "allow_insert_notifications" ON notifications FOR INSERT WITH CHECK (true);

-- COMPANY HOLIDAYS
CREATE POLICY "holidays_manager"         ON company_holidays FOR ALL    USING (current_user_role() = 'manager');
CREATE POLICY "holidays_read_all"        ON company_holidays FOR SELECT USING (auth.uid() IS NOT NULL);

-- REP ABSENCES
CREATE POLICY "absences_manager"         ON rep_absences FOR ALL    USING (current_user_role() = 'manager');
CREATE POLICY "absences_rep_read"        ON rep_absences FOR SELECT USING (
  current_user_role() IN ('rep','marketing') AND rep_id = current_rep_id()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_activities_rep_id     ON activities(rep_id);
CREATE INDEX IF NOT EXISTS idx_activities_date        ON activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_activities_company_id  ON activities(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_project_id  ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_company_reps_company   ON company_reps(company_id);
CREATE INDEX IF NOT EXISTS idx_company_reps_rep       ON company_reps(rep_id);
CREATE INDEX IF NOT EXISTS idx_project_reps_project   ON project_reps(project_id);
CREATE INDEX IF NOT EXISTS idx_project_reps_rep       ON project_reps(rep_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company       ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company       ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_stage         ON projects(stage);
CREATE INDEX IF NOT EXISTS idx_quotations_project     ON quotations(project_id);
CREATE INDEX IF NOT EXISTS idx_quotations_company     ON quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_rep         ON quotations(rep_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status      ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_reps_auth_user         ON reps(auth_user_id);

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW rep_monthly_sqm AS
SELECT
  r.id AS rep_id, r.name AS rep_name,
  r.monthly_target_sqm AS target_sqm,
  date_trunc('month', a.activity_date)::date AS month_start,
  to_char(a.activity_date, 'Month YYYY') AS month_label,
  COALESCE(SUM(a.sqm_done), 0) AS achieved_sqm,
  COALESCE(SUM(a.sqm_expected), 0) AS pipeline_sqm,
  COUNT(a.id) AS activity_count
FROM reps r
LEFT JOIN activities a ON a.rep_id = r.id
WHERE r.status = 'active'
GROUP BY r.id, r.name, r.monthly_target_sqm,
         date_trunc('month', a.activity_date),
         to_char(a.activity_date, 'Month YYYY');

CREATE OR REPLACE VIEW pipeline_summary AS
SELECT
  stage,
  COUNT(*) AS project_count,
  COALESCE(SUM(quoted_sqm), 0) AS total_sqm
FROM projects
GROUP BY stage
ORDER BY CASE stage
  WHEN 'New Lead'       THEN 1
  WHEN 'Catalog Sent'   THEN 2
  WHEN 'Quotation Sent' THEN 3
  WHEN 'Under Review'   THEN 4
  WHEN 'Won'            THEN 5
  WHEN 'In Production'  THEN 6
  WHEN 'Delivered'      THEN 7
  WHEN 'Lost'           THEN 8
  ELSE 9
END;

CREATE OR REPLACE VIEW stale_projects AS
SELECT
  p.id, p.project_code, p.project_name, p.stage,
  p.customer_id, c.company_name, p.next_follow_up,
  p.stage_changed_at,
  (now() - p.stage_changed_at) AS time_in_stage,
  r.name AS assigned_rep_name
FROM projects p
LEFT JOIN companies c ON c.id = p.customer_id
LEFT JOIN reps r ON r.id = p.assigned_rep_id
WHERE p.stage NOT IN ('Won','Delivered','Lost')
AND (p.stage_changed_at < now() - interval '14 days' OR p.stage_changed_at IS NULL)
ORDER BY p.stage_changed_at NULLS FIRST;

-- ============================================================
-- SEED DATA
-- Update emails to match actual company email addresses
-- ============================================================

INSERT INTO reps (name, email, role, status, monthly_target_sqm) VALUES
  ('Ahmed Alzaben',     'a.alzaben@technopanel.com.sa',     'rep',     'active', 0),
  ('Jerom Youssef',     'jerom@technopanel.com.sa',         'manager', 'active', 0),
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- Done! FACET CRM — Production Schema
-- ============================================================
