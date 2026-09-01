pragma foreign_keys = on;

create table if not exists study_programs (
  id text primary key,
  code text not null unique,
  name text not null,
  degree text not null default 'S1',
  faculty text,
  is_active integer not null default 1,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists academic_periods (
  id text primary key,
  code text not null unique,
  name text not null,
  semester_type text not null,
  is_active integer not null default 0,
  default_due_date text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists bill_types (
  id text primary key,
  code text not null unique,
  name text not null,
  default_amount integer not null default 0,
  is_active integer not null default 1,
  created_at text not null default (datetime('now'))
);

create table if not exists students (
  id text primary key,
  nim text not null unique,
  full_name text not null,
  name_norm text not null,
  no_ktp text,
  tempat_lahir text,
  tanggal_lahir text,
  nama_ibu_kandung text,
  program_study text,
  study_program_id text references study_programs(id) on delete set null,
  academic_status text not null default 'aktif',
  entry_year integer,
  entry_semester text,
  entry_period text,
  email text,
  address text,
  initial_registration text,
  phone_number text,
  deleted_at text,
  deleted_by text,
  delete_reason text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists bills (
  id text primary key,
  student_id text not null references students(id) on delete cascade,
  briva text not null,
  amount integer not null,
  paid_amount integer not null default 0,
  period text not null,
  bill_type text not null,
  status text not null default 'unpaid',
  is_active integer not null default 1 check (is_active in (0, 1)),
  deactivated_at text,
  deactivated_by text,
  deactivation_reason text,
  payment_method text not null default 'BRIVA',
  instructions text not null,
  due_date text,
  source_file text not null,
  source_row_number integer,
  deleted_at text,
  deleted_by text,
  delete_reason text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists lookup_logs (
  id text primary key,
  nim_hash text not null,
  name_hash text not null,
  result_type text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists import_issues (
  id text primary key,
  batch_id text,
  sheet_name text not null,
  row_number integer not null,
  severity text not null default 'warning' check (severity in ('warning', 'critical')),
  issue_code text not null default 'LEGACY_IMPORT_ISSUE',
  nim text,
  full_name text,
  briva text,
  amount text,
  note text not null,
  source_file text not null,
  period_code text,
  resolution_status text not null default 'open' check (resolution_status in ('open', 'resolved', 'ignored')),
  resolved_at text,
  resolved_by text,
  resolution_note text,
  created_at text not null default (datetime('now'))
);

create table if not exists import_previews (
  token text primary key,
  admin_id text not null references admin_users(id) on delete cascade,
  file_name text not null,
  stored_path text not null,
  expires_at text not null,
  file_sha256 text,
  period_code text,
  period_label text,
  billing_year integer,
  semester_type text,
  claim_id text,
  claimed_at text,
  created_at text not null default (datetime('now'))
);

create table if not exists import_preview_issues (
  id text primary key,
  token text not null references import_previews(token) on delete cascade,
  sheet_name text not null,
  row_number integer not null,
  severity text not null check (severity in ('warning', 'critical')),
  issue_code text not null,
  nim text,
  full_name text,
  briva text,
  amount text,
  note text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists import_batches (
  id text primary key,
  import_token text unique,
  admin_id text references admin_users(id) on delete set null,
  source_file text not null,
  file_sha256 text not null,
  period_code text not null,
  period_label text not null,
  billing_year integer,
  semester_type text,
  status text not null check (status in ('completed', 'completed_with_issues', 'issues_only')),
  created_count integer not null default 0,
  updated_count integer not null default 0,
  unchanged_count integer not null default 0,
  quarantined_count integer not null default 0,
  warning_count integer not null default 0,
  critical_count integer not null default 0,
  created_at text not null default (datetime('now')),
  committed_at text not null default (datetime('now'))
);

create table if not exists admin_users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  full_name text,
  role text not null default 'admin',
  is_active integer not null default 1,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists admin_sessions (
  id text primary key,
  admin_id text not null references admin_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists audit_logs (
  id text primary key,
  actor_id text references admin_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata text,
  created_at text not null default (datetime('now'))
);

create table if not exists schema_migrations (
  version integer primary key,
  applied_at text not null default (datetime('now'))
);

create table if not exists due_date_backfill_runs (
  id text primary key,
  status text not null check (status in ('applied', 'rolled_back')),
  backup_archive text not null,
  rollback_backup_archive text,
  candidate_count integer not null,
  normalized_count integer not null,
  unresolved_count integer not null,
  created_at text not null default (datetime('now')),
  rolled_back_at text
);

create table if not exists due_date_backfill_changes (
  run_id text not null references due_date_backfill_runs(id) on delete restrict,
  bill_id text not null references bills(id) on delete restrict,
  old_due_date text not null,
  new_due_date text not null,
  old_updated_at text not null,
  new_updated_at text not null,
  applied_at text not null default (datetime('now')),
  primary key (run_id, bill_id)
);

create table if not exists payment_transactions (
  id text primary key,
  bill_id text not null references bills(id) on delete cascade,
  student_id text not null references students(id) on delete cascade,
  transaction_type text not null default 'payment',
  amount integer not null,
  running_paid_total integer not null,
  previous_status text not null,
  new_status text not null,
  payment_date text not null,
  payment_method text,
  reference_number text,
  notes text,
  recorded_by text references admin_users(id) on delete set null,
  source text not null default 'manual',
  created_at text not null default (datetime('now'))
);

create index if not exists idx_students_nim on students(nim);
create index if not exists idx_students_name_norm on students(name_norm);
create index if not exists idx_bills_student_id on bills(student_id);
create index if not exists idx_bills_activation_period on bills(is_active, period);
create index if not exists idx_lookup_logs_created_at on lookup_logs(created_at);
create index if not exists idx_import_previews_admin_id on import_previews(admin_id);
create index if not exists idx_import_previews_expires_at on import_previews(expires_at);
create index if not exists idx_due_date_backfill_changes_bill_id on due_date_backfill_changes(bill_id);
create index if not exists idx_admin_sessions_token_hash on admin_sessions(token_hash);
create index if not exists idx_admin_sessions_expires_at on admin_sessions(expires_at);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);
create index if not exists idx_pt_bill_id on payment_transactions(bill_id);
create index if not exists idx_pt_student_id on payment_transactions(student_id);
create index if not exists idx_pt_payment_date on payment_transactions(payment_date);
create index if not exists idx_pt_created_at on payment_transactions(created_at);
