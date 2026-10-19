import { $Enums, type Prisma } from '../generated/prisma/client.js';

export type AccessActor = {
  id: string;
  role: $Enums.UserRole;
  department: $Enums.UserDepartment;
  cardNumber: string;
  unit: $Enums.Unit;
};

/** Roles allowed through Fastify roleMiddleware for solicitation admin routes. */
export const AREA_ADMIN_ROLES: $Enums.UserRole[] = [
  $Enums.UserRole.SUPER_ADMIN,
  $Enums.UserRole.ADMIN,
];

const PROCESSOS_ORG_DEPARTMENTS: $Enums.UserDepartment[] = [
  $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS,
  $Enums.UserDepartment.FERRAMENTARIA,
  $Enums.UserDepartment.AMOSTRA,
];

export function isSuperAdmin(role: $Enums.UserRole): boolean {
  return role === $Enums.UserRole.SUPER_ADMIN;
}

export function isAreaAdmin(role: $Enums.UserRole): boolean {
  return role === $Enums.UserRole.ADMIN;
}

export function isAdminOf(
  actor: Pick<AccessActor, 'role' | 'department'>,
  department: $Enums.UserDepartment,
): boolean {
  return isAreaAdmin(actor.role) && actor.department === department;
}

/** Admins who manage solicitations for their department (Eng / Processos). */
export function isSolicitationAreaAdmin(
  actor: Pick<AccessActor, 'role' | 'department'>,
): boolean {
  return (
    isAdminOf(actor, $Enums.UserDepartment.ENG_MECANICA) ||
    isAdminOf(actor, $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS)
  );
}

/** Platform admins who manage users / approvals for an area. */
export function isPlatformAdmin(
  actor: Pick<AccessActor, 'role' | 'department'>,
): boolean {
  return isSuperAdmin(actor.role) || isSolicitationAreaAdmin(actor);
}

export function canManageSolicitations(
  actor: Pick<AccessActor, 'role' | 'department'>,
): boolean {
  return isSuperAdmin(actor.role) || isSolicitationAreaAdmin(actor);
}

export function canManageToolingStage(
  actor: Pick<AccessActor, 'role' | 'department'>,
): boolean {
  return (
    isSuperAdmin(actor.role) ||
    isAdminOf(actor, $Enums.UserDepartment.FERRAMENTARIA)
  );
}

export function canManageSampleStage(
  actor: Pick<AccessActor, 'role' | 'department'>,
): boolean {
  return (
    isSuperAdmin(actor.role) ||
    isAdminOf(actor, $Enums.UserDepartment.AMOSTRA)
  );
}

/** Líder de Desenvolvimento de Processos: acompanha só a etapa de Engenharia. */
export function isProcessEngineeringLead(
  actor: Pick<AccessActor, 'role' | 'department'>,
): boolean {
  return isAdminOf(actor, $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS);
}

export function visibleWorkflowStages(
  actor: Pick<AccessActor, 'role' | 'department'>,
): $Enums.WorkflowStage[] {
  if (isProcessEngineeringLead(actor)) {
    return [$Enums.WorkflowStage.ENGENHARIA];
  }
  return [
    $Enums.WorkflowStage.ENGENHARIA,
    $Enums.WorkflowStage.FERRAMENTARIA,
    $Enums.WorkflowStage.AMOSTRA,
  ];
}

/** Indicadores de pedidos. Só o admin de Desenvolvimento de Processos. */
export function canAccessProcessCharts(
  actor: Pick<AccessActor, 'role' | 'department'>,
): boolean {
  return isAdminOf(actor, $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS);
}

export function canAccessWorkflow(
  actor: Pick<AccessActor, 'role' | 'department'>,
): boolean {
  return (
    isSuperAdmin(actor.role) ||
    actor.role === $Enums.UserRole.COMERCIAL ||
    isAdminOf(actor, $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS) ||
    isAdminOf(actor, $Enums.UserDepartment.FERRAMENTARIA) ||
    isAdminOf(actor, $Enums.UserDepartment.AMOSTRA)
  );
}

export function isWorkflowOperator(
  actor: Pick<AccessActor, 'role' | 'department'>,
): boolean {
  return (
    actor.role === $Enums.UserRole.COMERCIAL ||
    isAdminOf(actor, $Enums.UserDepartment.FERRAMENTARIA) ||
    isAdminOf(actor, $Enums.UserDepartment.AMOSTRA)
  );
}

export function canManageUser(
  actor: Pick<AccessActor, 'role' | 'department'>,
  target: { role: $Enums.UserRole; department: $Enums.UserDepartment },
): boolean {
  if (isSuperAdmin(actor.role)) return true;
  if (target.role === $Enums.UserRole.SUPER_ADMIN) return false;

  if (isAdminOf(actor, $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS)) {
    if (isAdminOf(target, $Enums.UserDepartment.ENG_MECANICA)) return false;
    return PROCESSOS_ORG_DEPARTMENTS.includes(target.department);
  }

  if (isAdminOf(actor, $Enums.UserDepartment.ENG_MECANICA)) {
    return target.department === $Enums.UserDepartment.ENG_MECANICA;
  }

  return false;
}

export function canAssignRole(
  actor: Pick<AccessActor, 'role' | 'department'>,
  nextRole: $Enums.UserRole,
): boolean {
  if (isSuperAdmin(actor.role)) return true;

  if (isAdminOf(actor, $Enums.UserDepartment.ENG_MECANICA)) {
    return (
      nextRole === $Enums.UserRole.USER || nextRole === $Enums.UserRole.ADMIN
    );
  }

  if (isAdminOf(actor, $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS)) {
    return (
      nextRole === $Enums.UserRole.USER ||
      nextRole === $Enums.UserRole.ADMIN ||
      nextRole === $Enums.UserRole.COMERCIAL
    );
  }

  return false;
}

export function canAssignDepartment(
  actor: Pick<AccessActor, 'role' | 'department'>,
  role: $Enums.UserRole,
  department: $Enums.UserDepartment,
): boolean {
  if (isSuperAdmin(actor.role)) return true;

  if (isAdminOf(actor, $Enums.UserDepartment.ENG_MECANICA)) {
    return department === $Enums.UserDepartment.ENG_MECANICA;
  }

  if (isAdminOf(actor, $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS)) {
    if (role === $Enums.UserRole.COMERCIAL) {
      return department === $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS;
    }
    return PROCESSOS_ORG_DEPARTMENTS.includes(department);
  }

  return false;
}

export function departmentForAssignedRole(
  role: $Enums.UserRole,
  current: $Enums.UserDepartment,
  explicit?: $Enums.UserDepartment,
): $Enums.UserDepartment {
  if (role === $Enums.UserRole.COMERCIAL) {
    return $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS;
  }
  if (role === $Enums.UserRole.ADMIN && explicit) {
    return explicit;
  }
  return explicit ?? current;
}

function comercialWorkflowScope(
  actor: Pick<AccessActor, 'role' | 'department'>,
): Prisma.SolicitationWhereInput {
  const base: Prisma.SolicitationWhereInput = {
    department: $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS,
    processInstructionRequester: 'Comercial',
    workflowStages: { some: {} },
  };

  if (isAdminOf(actor, $Enums.UserDepartment.FERRAMENTARIA)) {
    return {
      ...base,
      workflowStages: {
        some: { stage: $Enums.WorkflowStage.FERRAMENTARIA },
      },
    };
  }

  if (isAdminOf(actor, $Enums.UserDepartment.AMOSTRA)) {
    return {
      ...base,
      workflowStages: {
        some: { stage: $Enums.WorkflowStage.AMOSTRA },
      },
    };
  }

  return base;
}

export function solicitationScope(
  actor: Pick<AccessActor, 'role' | 'department' | 'cardNumber' | 'unit'>,
): Prisma.SolicitationWhereInput {
  if (isSuperAdmin(actor.role)) return {};

  if (isSolicitationAreaAdmin(actor)) {
    return { department: actor.department };
  }

  if (isWorkflowOperator(actor)) {
    return comercialWorkflowScope(actor);
  }

  return {
    department: actor.department,
    cardNumber: actor.cardNumber,
    unit: actor.unit,
  };
}

export function canAccessSolicitation(
  actor: Pick<AccessActor, 'role' | 'department' | 'cardNumber' | 'unit'>,
  solicitation: {
    department: $Enums.UserDepartment;
    cardNumber: string;
    unit: $Enums.Unit;
    processInstructionRequester?: string | null;
    workflowStages?: Array<{ stage: $Enums.WorkflowStage }>;
  },
): boolean {
  if (isSuperAdmin(actor.role)) return true;

  if (isWorkflowOperator(actor)) {
    const hasWorkflow = (solicitation.workflowStages?.length ?? 0) > 0;
    if (!hasWorkflow) return false;
    if (
      solicitation.department !==
        $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS ||
      solicitation.processInstructionRequester !== 'Comercial'
    ) {
      return false;
    }
    if (isAdminOf(actor, $Enums.UserDepartment.FERRAMENTARIA)) {
      return solicitation.workflowStages!.some(
        (stage) => stage.stage === $Enums.WorkflowStage.FERRAMENTARIA,
      );
    }
    if (isAdminOf(actor, $Enums.UserDepartment.AMOSTRA)) {
      return solicitation.workflowStages!.some(
        (stage) => stage.stage === $Enums.WorkflowStage.AMOSTRA,
      );
    }
    return true;
  }

  if (solicitation.department !== actor.department) return false;
  if (isSolicitationAreaAdmin(actor)) return true;
  return (
    solicitation.cardNumber === actor.cardNumber &&
    solicitation.unit === actor.unit
  );
}

export function actorFromSession(user: {
  sub: string;
  role: $Enums.UserRole;
  department: $Enums.UserDepartment;
  cardNumber: string;
  unit: $Enums.Unit;
}): AccessActor {
  return {
    id: user.sub,
    role: user.role,
    department: user.department,
    cardNumber: user.cardNumber,
    unit: user.unit,
  };
}
