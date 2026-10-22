-- Remap workflow admins to their own departments (values must already exist).
UPDATE "User"
SET department = 'FERRAMENTARIA'
WHERE role = 'ADMIN_FERRAMENTARIA'
  AND department <> 'FERRAMENTARIA';

UPDATE "User"
SET department = 'AMOSTRA'
WHERE role = 'ADMIN_AMOSTRA'
  AND department <> 'AMOSTRA';
