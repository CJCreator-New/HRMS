SET check_function_bodies = off;

-- Add insert policy for inbox_notifications if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inbox_notifications' AND policyname = 'notifications_insert'
  ) THEN
    CREATE POLICY notifications_insert ON inbox_notifications FOR INSERT
      WITH CHECK (recipient_id = auth_employee_id() OR has_permission('settings.manage'));
  END IF;
END $$;
