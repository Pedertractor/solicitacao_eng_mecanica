import { useMemo } from 'react';
import type { PillarCode } from '@/config/pillars';
import {
  canAccessP5Area,
  canEditPillar,
  canManageCycles,
  canManageP5Configuration,
  canSimulateAccidents,
  canViewPillar,
  type P5UserContext,
} from '@/config/permissions';
import { useAuth } from '@/contexts/useAuth';

export function useP5Permissions() {
  const { user } = useAuth();

  return useMemo(() => {
    const context: P5UserContext | null = user
      ? {
          role: user.role,
          assignedPillarCodes: user.assignedPillarCodes,
        }
      : null;

    const scopeKey = user
      ? `${user.id}:${user.role}:${[...(user.assignedPillarCodes ?? [])].sort().join(',')}`
      : 'anonymous';

    return {
      user: context,
      scopeKey,
      canAccessP5: context ? canAccessP5Area(context) : false,
      canManageCycles: user ? canManageCycles(user.role) : false,
      canManageConfiguration: user ? canManageP5Configuration(user.role) : false,
      canSimulateAccidents: user ? canSimulateAccidents(user.role) : false,
      canViewSafety: context ? canViewPillar(context, 'SAFETY') : false,
      canViewAbsenteeism: context
        ? canViewPillar(context, 'ABSENTEEISM')
        : false,
      canViewPillar: (pillarCode: PillarCode) =>
        context ? canViewPillar(context, pillarCode) : false,
      canEditPillar: (pillarCode: PillarCode) =>
        context ? canEditPillar(context, pillarCode) : false,
    };
  }, [user]);
}
