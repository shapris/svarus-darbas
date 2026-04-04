-- Supabase performance advisor: auth_rls_initplan
-- Pakeisti auth.uid() į (SELECT auth.uid()) RLS išraiškose (viena karta per užklausą, ne per eilutę).

-- quotes, retention_events, channel_deliveries (owner_id text)
DROP POLICY IF EXISTS crm_quotes_rw ON public.quotes;
CREATE POLICY crm_quotes_rw ON public.quotes FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid())::text)
  WITH CHECK (owner_id = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS crm_retention_events_rw ON public.retention_events;
CREATE POLICY crm_retention_events_rw ON public.retention_events FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid())::text)
  WITH CHECK (owner_id = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS crm_channel_deliveries_rw ON public.channel_deliveries;
CREATE POLICY crm_channel_deliveries_rw ON public.channel_deliveries FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid())::text)
  WITH CHECK (owner_id = (SELECT auth.uid())::text);

-- workspaces
DROP POLICY IF EXISTS workspace_members_select ON public.workspaces;
CREATE POLICY workspace_members_select ON public.workspaces FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = workspaces.id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
    )
  );

DROP POLICY IF EXISTS workspace_owner_admin_update ON public.workspaces;
CREATE POLICY workspace_owner_admin_update ON public.workspaces FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = workspaces.id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
        AND membership.role = ANY (ARRAY['owner'::text, 'admin'::text])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = workspaces.id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
        AND membership.role = ANY (ARRAY['owner'::text, 'admin'::text])
    )
  );

DROP POLICY IF EXISTS workspace_owner_insert ON public.workspaces;
CREATE POLICY workspace_owner_insert ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = (SELECT auth.uid())::text);

-- workspace_memberships
DROP POLICY IF EXISTS membership_workspace_select ON public.workspace_memberships;
CREATE POLICY membership_workspace_select ON public.workspace_memberships FOR SELECT TO authenticated
  USING (
    (user_id = (SELECT auth.uid())::text)
    OR EXISTS (
      SELECT 1 FROM public.workspace_memberships viewer
      WHERE viewer.workspace_id = workspace_memberships.workspace_id
        AND viewer.user_id = (SELECT auth.uid())::text
        AND viewer.status = 'active'
        AND viewer.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])
    )
  );

DROP POLICY IF EXISTS membership_owner_admin_insert ON public.workspace_memberships;
CREATE POLICY membership_owner_admin_insert ON public.workspace_memberships FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships viewer
      WHERE viewer.workspace_id = workspace_memberships.workspace_id
        AND viewer.user_id = (SELECT auth.uid())::text
        AND viewer.status = 'active'
        AND viewer.role = ANY (ARRAY['owner'::text, 'admin'::text])
    )
    OR (user_id = (SELECT auth.uid())::text)
  );

DROP POLICY IF EXISTS membership_owner_admin_update ON public.workspace_memberships;
CREATE POLICY membership_owner_admin_update ON public.workspace_memberships FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships viewer
      WHERE viewer.workspace_id = workspace_memberships.workspace_id
        AND viewer.user_id = (SELECT auth.uid())::text
        AND viewer.status = 'active'
        AND viewer.role = ANY (ARRAY['owner'::text, 'admin'::text])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships viewer
      WHERE viewer.workspace_id = workspace_memberships.workspace_id
        AND viewer.user_id = (SELECT auth.uid())::text
        AND viewer.status = 'active'
        AND viewer.role = ANY (ARRAY['owner'::text, 'admin'::text])
    )
  );

-- workspace_settings
DROP POLICY IF EXISTS workspace_settings_member_select ON public.workspace_settings;
CREATE POLICY workspace_settings_member_select ON public.workspace_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = workspace_settings.workspace_id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
    )
  );

DROP POLICY IF EXISTS workspace_settings_owner_admin_write ON public.workspace_settings;
CREATE POLICY workspace_settings_owner_admin_write ON public.workspace_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = workspace_settings.workspace_id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
        AND membership.role = ANY (ARRAY['owner'::text, 'admin'::text])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = workspace_settings.workspace_id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
        AND membership.role = ANY (ARRAY['owner'::text, 'admin'::text])
    )
  );

-- invoices, payment_intents, transactions (workspace + client read)
DROP POLICY IF EXISTS invoices_workspace_access ON public.invoices;
CREATE POLICY invoices_workspace_access ON public.invoices FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = invoices.owner_id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles profile
      WHERE profile.uid::text = (SELECT auth.uid())::text
        AND profile.role = 'client'
        AND profile.client_id::text = invoices.client_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = invoices.owner_id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
        AND membership.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])
    )
  );

DROP POLICY IF EXISTS payment_intents_workspace_access ON public.payment_intents;
CREATE POLICY payment_intents_workspace_access ON public.payment_intents FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = payment_intents.owner_id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = payment_intents.owner_id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
        AND membership.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])
    )
  );

DROP POLICY IF EXISTS transactions_workspace_access ON public.transactions;
CREATE POLICY transactions_workspace_access ON public.transactions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = transactions.owner_id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships membership
      WHERE membership.workspace_id = transactions.owner_id
        AND membership.user_id = (SELECT auth.uid())::text
        AND membership.status = 'active'
        AND membership.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])
    )
  );
