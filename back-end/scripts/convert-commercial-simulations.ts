import { prisma } from '../src/lib/prisma.js';
import { simulationConversionEligibility } from '../src/lib/simulation-conversion.js';
import { WorkflowStagePrismaRepository } from '../src/repositories/prisma/workflow-stage-repository.js';

// From back-end/: npm run db:convert-simulations (preview)
// Apply with: npm run db:convert-simulations -- --apply
const apply = process.argv.includes('--apply');
try {
  const rows = await prisma.solicitation.findMany({ where: {
    department: 'DESENVOLVIMENTO_PROCESSOS', processInstructionRequester: 'Comercial',
    processInstructionType: 'Simulação Comercial',
  }, include: { workflowStages: true }, orderBy: { createdAt: 'asc' } });
  const repo = new WorkflowStagePrismaRepository(prisma);
  console.log(apply ? 'Aplicação da conversão' : 'Prévia da conversão (sem alterações)');
  let converted = 0;
  for (const row of rows) {
    const result = apply ? await repo.convertCommercialSimulation(row.id) : simulationConversionEligibility(row);
    if (result.eligible) converted++;
    console.log(JSON.stringify({ id: row.id, trackingCode: row.trackingCode,
      action: result.eligible ? (apply ? 'converted' : 'eligible') : 'preserved', reason: result.reason }));
  }
  console.log(JSON.stringify({ total: rows.length, [apply ? 'converted' : 'eligible']: converted, preserved: rows.length - converted }));
} finally {
  await prisma.$disconnect();
}
