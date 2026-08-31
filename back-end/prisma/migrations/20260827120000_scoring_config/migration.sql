-- Snapshot de regras de pontuação por ano (template) e por ciclo (congelado).

ALTER TABLE "ProgramYear" ADD COLUMN IF NOT EXISTS "scoringConfig" JSONB;
ALTER TABLE "MonthlyCycle" ADD COLUMN IF NOT EXISTS "scoringConfig" JSONB;

-- Template v2 padrão em todos os programas.
UPDATE "ProgramYear"
SET "scoringConfig" = '{
  "version": 2,
  "globalZeroBelowPercent": 70,
  "pillars": {
    "SAFETY": { "zeroBelowPercent": null },
    "PRODUCTIVITY": { "zeroBelowPercent": null },
    "QUALITY_5S": { "zeroBelowPercent": null },
    "ABSENTEEISM": { "zeroBelowPercent": null },
    "REVENUE": { "zeroBelowPercent": null }
  },
  "safety": {
    "withLeave": { "individualPenaltyP5": 20, "factoryDeductionP5": 2.06 },
    "withoutLeave": { "individualPenaltyP5": 20, "factoryDeductionP5": 2.06 }
  }
}'::jsonb
WHERE "scoringConfig" IS NULL;

-- Ciclos graváveis → v2 (recalc no painel / próxima execução de Segurança).
UPDATE "MonthlyCycle"
SET "scoringConfig" = '{
  "version": 2,
  "globalZeroBelowPercent": 70,
  "pillars": {
    "SAFETY": { "zeroBelowPercent": null },
    "PRODUCTIVITY": { "zeroBelowPercent": null },
    "QUALITY_5S": { "zeroBelowPercent": null },
    "ABSENTEEISM": { "zeroBelowPercent": null },
    "REVENUE": { "zeroBelowPercent": null }
  },
  "safety": {
    "withLeave": { "individualPenaltyP5": 20, "factoryDeductionP5": 2.06 },
    "withoutLeave": { "individualPenaltyP5": 20, "factoryDeductionP5": 2.06 }
  }
}'::jsonb
WHERE "scoringConfig" IS NULL
  AND "status" IN ('DRAFT', 'OPEN', 'CALCULATED', 'UNDER_REVIEW');

-- Ciclos fechados → snapshot legado v1 (somente leitura / auditoria).
UPDATE "MonthlyCycle"
SET "scoringConfig" = '{
  "version": 1,
  "legacy": true,
  "rule": "INDIVIDUAL_PER_OCCURRENCE_PLUS_AUTO_RECIDIVISM",
  "safety": {
    "withLeaveInternalPenalty": 50,
    "withoutLeaveInternalPenalty": 30,
    "frequencyInternalPenalty": 20,
    "note": "Regra legada: descontos internos 50/30/20 no colaborador; sem perda coletiva de fábrica nem limiar de 70%."
  }
}'::jsonb
WHERE "scoringConfig" IS NULL
  AND "status" IN ('HOMOLOGATED', 'LOCKED');
