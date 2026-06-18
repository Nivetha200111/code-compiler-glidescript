create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  name text,
  created_at text not null default (datetime('now'))
);

create index if not exists idx_users_email on users (email);

create table if not exists playground_snapshots (
  id text primary key,
  user_email text not null,
  name text not null,
  data text not null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create index if not exists idx_playground_snapshots_user_updated
  on playground_snapshots (user_email, updated_at desc);
