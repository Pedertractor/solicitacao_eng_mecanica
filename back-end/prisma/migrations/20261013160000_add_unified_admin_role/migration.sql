-- Add unified ADMIN role (must commit before remapping users).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
