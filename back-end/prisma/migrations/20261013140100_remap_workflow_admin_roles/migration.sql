-- Remap legacy FERRAMENTARIA / AMOSTRA user roles if those enum labels exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'FERRAMENTARIA'
  ) THEN
    UPDATE "User"
    SET role = 'ADMIN_FERRAMENTARIA'
    WHERE role::text = 'FERRAMENTARIA';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'AMOSTRA'
  ) THEN
    UPDATE "User"
    SET role = 'ADMIN_AMOSTRA'
    WHERE role::text = 'AMOSTRA';
  END IF;
END $$;
