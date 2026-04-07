-- RLS ant notification_events: tik skaitymas autentifikuotiems; įrašai tik per service_role (API).
-- Staff/admin — workspace scope (effective_workspace_owner_id); client — savo client_id.

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_events_staff_org_select ON public.notification_events;
DROP POLICY IF EXISTS notification_events_client_select ON public.notification_events;

CREATE POLICY notification_events_staff_org_select ON public.notification_events
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_staff_or_admin())
    AND owner_id IS NOT NULL
    AND owner_id = (SELECT public.effective_workspace_owner_id())::text
  );

CREATE POLICY notification_events_client_select ON public.notification_events
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_role()) = 'client'
    AND client_id IS NOT NULL
    AND client_id = (SELECT public.current_client_id())
  );

GRANT SELECT ON public.notification_events TO authenticated;
