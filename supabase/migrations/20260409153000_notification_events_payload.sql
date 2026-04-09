-- Add structured payload for portal/service request details.
ALTER TABLE public.notification_events
ADD COLUMN IF NOT EXISTS payload jsonb;

-- Helps filtering UI lists by request type and newest first.
CREATE INDEX IF NOT EXISTS idx_notification_events_type_created_at
  ON public.notification_events(type, created_at DESC);
