
DROP POLICY IF EXISTS "System inserts earnings" ON public.agent_earnings;
CREATE POLICY "Farmer creates own signup commission" ON public.agent_earnings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = farmer_id OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "User or admin inserts notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)
  );
