-- Notification audit log for client emails (status updates + reminders).
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  order_id text,
  client_id text,
  owner_id text,
  type text not null,
  channel text not null default 'email',
  recipient text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_events_order_id
  on public.notification_events(order_id);

create index if not exists idx_notification_events_owner_id
  on public.notification_events(owner_id);

create index if not exists idx_notification_events_created_at
  on public.notification_events(created_at desc);

create unique index if not exists ux_notification_events_dedupe
  on public.notification_events(order_id, type, channel, recipient, scheduled_for);
