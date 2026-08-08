pragma foreign_keys = on;

create table if not exists students (
  id text primary key,
  nim text not null unique,
  full_name text not null,
  name_norm text not null,
  program_study text,
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
  period text not null,
  bill_type text not null,
  status text not null default 'unpaid',
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
  sheet_name text not null,
  row_number integer not null,
  nim text,
  full_name text,
  briva text,
  amount text,
  note text not null,
  source_file text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists import_previews (
  token text primary key,
  admin_id text not null references admin_users(id) on delete cascade,
  file_name text not null,
  stored_path text not null,
  expires_at text not null,
  created_at text not null default (datetime('now'))
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

create index if not exists idx_students_nim on students(nim);
create index if not exists idx_students_name_norm on students(name_norm);
create index if not exists idx_bills_student_id on bills(student_id);
create index if not exists idx_lookup_logs_created_at on lookup_logs(created_at);
create index if not exists idx_import_previews_admin_id on import_previews(admin_id);
create index if not exists idx_import_previews_expires_at on import_previews(expires_at);
create index if not exists idx_admin_sessions_token_hash on admin_sessions(token_hash);
create index if not exists idx_admin_sessions_expires_at on admin_sessions(expires_at);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);
