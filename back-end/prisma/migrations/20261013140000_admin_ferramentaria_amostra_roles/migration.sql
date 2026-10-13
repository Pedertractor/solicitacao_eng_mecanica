-- Add admin role values only (must be committed before any UPDATE using them).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN_FERRAMENTARIA';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN_AMOSTRA';
