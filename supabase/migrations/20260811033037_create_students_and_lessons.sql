/*
# Create students and lessons tables (single-tenant, no auth)

This is a scheduling app for a single online-course teacher. No sign-in screen,
so data is intentionally shared/public and accessed via the anon key.

1. New Tables
- `students`
  - `id` (uuid, primary key)
  - `name` (text, not null) — student display name
  - `hourly_rate` (numeric, not null, default 0) — per-hour lesson fee
  - `color` (text, not null, default '#3b82f6') — hex color for calendar display
  - `created_at` (timestamptz, default now())
- `lessons`
  - `id` (uuid, primary key)
  - `student_id` (uuid, not null, references students(id) on delete cascade)
  - `start_at` (timestamptz, not null) — lesson start time
  - `duration_minutes` (integer, not null, default 60) — lesson length in minutes
  - `settled` (boolean, not null, default false) — whether the fee has been paid
  - `note` (text, default '') — free-form remark
  - `created_at` (timestamptz, default now())

2. Indexes
- `lessons_student_id_idx` on lessons(student_id) for per-student stats queries
- `lessons_start_at_idx` on lessons(start_at) for date-range filtering

3. Security
- Enable RLS on both tables.
- Allow anon + authenticated full CRUD because the data is intentionally
  shared/public (single-tenant app with no sign-in).
*/

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hourly_rate numeric(10, 2) NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  settled boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lessons_student_id_idx ON lessons(student_id);
CREATE INDEX IF NOT EXISTS lessons_start_at_idx ON lessons(start_at);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_students" ON students;
CREATE POLICY "anon_select_students" ON students FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_students" ON students;
CREATE POLICY "anon_insert_students" ON students FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_students" ON students;
CREATE POLICY "anon_update_students" ON students FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_students" ON students;
CREATE POLICY "anon_delete_students" ON students FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_lessons" ON lessons;
CREATE POLICY "anon_select_lessons" ON lessons FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_lessons" ON lessons;
CREATE POLICY "anon_insert_lessons" ON lessons FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_lessons" ON lessons;
CREATE POLICY "anon_update_lessons" ON lessons FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_lessons" ON lessons;
CREATE POLICY "anon_delete_lessons" ON lessons FOR DELETE
  TO anon, authenticated USING (true);
