-- Remap legacy area-admin roles into ADMIN + department.
UPDATE "User"
SET role = 'ADMIN',
    department = 'ENG_MECANICA'
WHERE role::text = 'ADMIN_ENG';

UPDATE "User"
SET role = 'ADMIN',
    department = 'DESENVOLVIMENTO_PROCESSOS'
WHERE role::text = 'ADMIN_PROCESSOS';

UPDATE "User"
SET role = 'ADMIN',
    department = 'FERRAMENTARIA'
WHERE role::text = 'ADMIN_FERRAMENTARIA';

UPDATE "User"
SET role = 'ADMIN',
    department = 'AMOSTRA'
WHERE role::text = 'ADMIN_AMOSTRA';
