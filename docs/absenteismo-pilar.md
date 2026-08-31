# Pilar Absenteísmo

Documentação da regra de pontuação e do job que aplica os dados da procedure Firebird no ciclo do mês anterior.

## Papel no P5

O pilar Absenteísmo vale **10 pontos P5** (10% dos 100 pontos mensais). A pontuação segue o mesmo modelo da Segurança (v2): saldo coletivo de fábrica menos a perda individual de quem ficou abaixo do índice.

Valores padrão no painel de pontuação (configuráveis):

| Perda | P5 | Quem sofre |
| --- | --- | --- |
| Coletiva (fábrica) | 1 | Todos os participantes, **por** colaborador com índice `< 100` |
| Individual | 10 | Só quem ficou com índice `< 100` |

Depois aplica o limiar do painel (padrão 70% de 10 → piso 7 P5). Abaixo do piso o pilar zera (`factory_threshold` para todos, ou `individual_threshold` só para a pessoa).

Exemplo com 1 pessoa `< 100`: fábrica 9; demais 9; essa pessoa 0. Com 4 pessoas `< 100`: saldo 6 `<` 7 → todos zerados.

Os 100 pontos internos continuam sendo a escala persistida (`interno = P5 × 10`).

## Fonte dos dados

Procedure Firebird `SP_PRJ_ABSENTEISMO(mês, ano)`:

- Mês com dois dígitos (`07`) e ano (`2026`)
- Colunas: `EMPRESA`, `CRACHA`, `NOME`, `SITUACAO`, `DT_REF`, `ABSENTEISMO`
- Consulta de leitura: `GET /api/p5/absenteeism?month=7&year=2026`
- Autorização: `ADMIN` ou responsável pelo pilar `ABSENTEEISM`

O índice só fica confiável **depois que o mês fecha**. Por isso o job usa o **mês anterior**.

## Quando o job roda

1. **Imediatamente** ao abrir um ciclo (`POST /cycles/:id/open`). Abrir agosto consulta julho e grava no ciclo de julho.
2. **Cron diário** às 00:30 (`America/Sao_Paulo`) para retentar se o Firebird falhou na abertura, e para atualizar o ciclo OPEN do mês em andamento (resultado parcial).

Falha no Firebird **não desfaz** a abertura do ciclo.

Janeiro usa dezembro do ano anterior (outro `ProgramYear`, se existir).

## Ciclo alvo

| Situação do ciclo anterior | Ação |
| --- | --- |
| `OPEN`, `CALCULATED`, `UNDER_REVIEW` | Aplica (o esperado na abertura do próximo mês é `UNDER_REVIEW`) |
| `DRAFT` | Ignora |
| `HOMOLOGATED` / `LOCKED` | Ignora (não destrava) |
| Ciclo anterior inexistente | Ignora |

## Regra

Cruzamento: `EMPRESA` → unidade (`PEDERTRACTOR` / `TRACTOR`) e `CRACHA` → cartão do colaborador (últimos 4 dígitos, sem zeros à esquerda).

Pontua **todos os participantes ativos** do ciclo. Cada índice `< 100` é uma ocorrência de fábrica.

| `ABSENTEISMO` | Ocorrência de fábrica | Individual |
| --- | --- | --- |
| `< 100` | Sim (−1 P5 a todos, empilha) | Sim (−10 P5 nessa pessoa) |
| `>= 100` | Não | Não |
| Ausente na procedure | Não | Não (recebe só a perda coletiva, se houver) |

Linhas da procedure sem colaborador no ciclo entram só na auditoria (`unmatchedProcedureRows`); o job não falha.

A simulação de um colaborador **recalcula o pilar de todos** os participantes do ciclo (o −1 dos outros depende da contagem).

## Persistência

- Indicador `ABSENTEEISM_INDIVIDUAL` (`THRESHOLD`, fonte `PEDERTRACTOR`)
- `IndicatorResult` (escopo individual)
- `EmployeePillarScore` do pilar `ABSENTEEISM`
- `EmployeeMonthlyScore` recalculado pela **soma dos pilares já gravados** (Segurança + Absenteísmo, etc.)
- Auditoria `ABSENTEEISM_CALCULATE` com `pillarCode: ABSENTEEISM` (visível a admin e ao responsável do pilar)

`calculationDetails` guarda `scoringRuleVersion: 2`, `absenteeism`, `factoryOccurrenceCount`, `factoryDeductionP5`, `factoryBalanceP5`, `individualDeductionP5`, `zeroedBy`, `configSnapshot.absenteeism`.

Ciclos antigos com a regra 40/60 continuam legíveis na UI até um recálculo.

## Fluxo

```
Abrir ciclo de agosto
  → sincroniza participantes de agosto
  → consulta SP_PRJ_ABSENTEISMO(07, ano)
  → grava pontuação de Absenteísmo no ciclo de julho
  → recalcula o total mensal de cada participante de julho
```

## Simulação (desenvolvimento)

Admin, em **Simulação**:

- Escolhe um colaborador e um índice `ABSENTEISMO`
- `POST /api/p5/dev/simulate-absenteeism`
- Aplica a **mesma regra** no ciclo editável mais recente (`OPEN`, `CALCULATED` ou `UNDER_REVIEW`), **sem** chamar o Firebird, recalculando todos os participantes
- Auditoria: `ABSENTEEISM_SIMULATE`

Use valor `< 100` para ver a perda individual + coletiva; `>= 100` para não gerar ocorrência.

## Painel de pontuação

`GET/PUT /program-years/:id/scoring-rules` inclui `absenteeism.individualPenaltyP5` e `absenteeism.factoryDeductionP5`. Responsável sem o pilar `ABSENTEEISM` recebe esses valores zerados.
