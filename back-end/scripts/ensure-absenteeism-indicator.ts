import { ensureAbsenteeismIndividualIndicatorForAllPrograms } from '../src/services/absenteeism-indicator-config.js';
import { prisma } from '../src/lib/prisma.js';

const result = await ensureAbsenteeismIndividualIndicatorForAllPrograms();
console.log(
  `Indicador ABSENTEEISM_INDIVIDUAL garantido em ${result.pillars} pilar(es).`,
);
await prisma.$disconnect();
