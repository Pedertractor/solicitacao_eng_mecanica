# Integração CIPA → P5 — API de ocorrências

Documentação das rotas disponíveis para o sistema CIPA enviar, atualizar e cancelar acidentes no P5.

Base path: `/api/p5`

| Método | Rota | Uso |
|--------|------|-----|
| `PUT` | `/integrations/cipa/accidents/:externalId` | **Recomendada.** Criar, editar, reclassificar ou restaurar |
| `DELETE` | `/integrations/cipa/accidents/:externalId` | Cancelar logicamente |
| `POST` | `/integrations/cipa/accidents` | Legada (push simples); preferir o `PUT` |

---

## Autenticação

Todas as rotas exigem a API key configurada no P5 (`CIPA_API_KEY`).

Envie em **um** dos formatos:

```http
X-CIPA-API-KEY: <sua-chave>
```

ou

```http
Authorization: Bearer <sua-chave>
```

| Situação | HTTP |
|----------|------|
| Chave ausente ou inválida | `401` |
| `CIPA_API_KEY` não configurada no P5 | `503` |

Não use JWT de usuário do P5 nestas rotas.

---

## Conceitos importantes

### `externalId`

Identificador estável do acidente **no CIPA**. É a chave de idempotência no P5.

- Mesmo `externalId` = mesmo acidente.
- Use sempre o mesmo valor para criar, atualizar, reclassificar e cancelar.

### Natureza: `ACT` vs `CONDITION`

O P5 **só pontua atos** (`ACT` com `WITH_LEAVE` ou `WITHOUT_LEAVE`).

| Natureza | Comportamento no P5 |
|----------|---------------------|
| `ACT` | Cria/atualiza ocorrência pontuável |
| `CONDITION` | Condição comum **não é registrada**. Só importa quando reclassifica um ato já existente (remove do score) |

### `previousNature`

Indica o estado **anterior** no CIPA, para o P5 classificar a operação corretamente:

| `nature` | `previousNature` | Resultado típico |
|----------|------------------|------------------|
| `ACT` | `null` | Criação |
| `ACT` | `CONDITION` | Reclassificação condição → ato |
| `ACT` | `ACT` | Atualização (se dados mudaram) |
| `CONDITION` | `null` ou `CONDITION` | **Ignorado** (`IGNORED_CONDITION`) |
| `CONDITION` | `ACT` | Reclassificação ato → condição (cancela no P5) |

### `sourceChangedAt` (ordenação)

Timestamp ISO 8601 do momento em que o estado mudou **no CIPA**.

O P5 compara com o último valor armazenado:

| Incoming vs armazenado | Resultado |
|------------------------|-----------|
| Mais novo | Aplica a mudança |
| Igual e sem mudança de dados | `UNCHANGED` (idempotente) |
| Igual mas com dados diferentes | `409` conflito |
| Mais antigo | `409` evento stale |

**Sempre envie um `sourceChangedAt` monotônico** (nunca reutilize um valor antigo após um mais novo).

### Ciclo mensal

O acidente é associado ao ciclo `cycleYear`/`cycleMonth`.

- Se omitidos, o P5 deriva de `occurredAt` (ano/mês UTC).
- Se informados, **os dois devem vir juntos**.
- O ciclo precisa existir no P5 e **não** pode estar `HOMOLOGATED` nem `LOCKED` (`409`).

### Colaborador e setor

Para atos (`ACT`), o P5 resolve:

- **Setor** pelo `costCenter` (código do setor no P5).
- **Colaborador** por `unit` + `cardNumber` (número do cartão).

Ambos precisam existir e estar sincronizados no P5.

### Pontuação (calculada pelo P5)

Não envie tipo “reincidência”. O P5 calcula sozinho:

| Tipo enviado | Impacto no colaborador |
|--------------|------------------------|
| `WITH_LEAVE` | −50 |
| `WITHOUT_LEAVE` | −30 |
| 2+ acidentes no mesmo ciclo | −20 adicional (reincidência) |

Piso da pontuação: **0**.

---

## 1. PUT — Criar / editar / reclassificar / restaurar

```http
PUT /api/p5/integrations/cipa/accidents/{externalId}
Content-Type: application/json
X-CIPA-API-KEY: <chave>
```

### 1.1 Body — Ato (`nature: "ACT"`)

Use para criar ou atualizar um acidente pontuável.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `nature` | `"ACT"` | sim | Discriminador |
| `previousNature` | `"ACT"` \| `"CONDITION"` \| `null` | sim | Estado anterior no CIPA |
| `costCenter` | string | sim | Código do setor no P5 |
| `unit` | `"PEDERTRACTOR"` \| `"TRACTOR"` | sim | Unidade do colaborador |
| `cardNumber` | string | sim | Número do cartão |
| `accidentType` | `"WITH_LEAVE"` \| `"WITHOUT_LEAVE"` | sim | Com ou sem afastamento |
| `occurredAt` | string ISO 8601 | sim | Data/hora da ocorrência |
| `sourceChangedAt` | string ISO 8601 | sim | Timestamp da mudança no CIPA |
| `actor` | objeto | sim | Quem alterou no CIPA |
| `daysAway` | number \| `null` | não | Dias de afastamento |
| `description` | string \| `null` | não | Descrição |
| `cycleYear` | number | não* | Ano do ciclo (*com `cycleMonth`) |
| `cycleMonth` | number 1–12 | não* | Mês do ciclo (*com `cycleYear`) |

#### `actor`

```json
{
  "externalId": "user-cipa-123",
  "name": "João Silva",
  "identifier": "joao.silva"
}
```

#### Exemplo — criar ato com afastamento

```http
PUT /api/p5/integrations/cipa/accidents/CIPA-2026-00042
```

```json
{
  "nature": "ACT",
  "previousNature": null,
  "costCenter": "4501",
  "unit": "PEDERTRACTOR",
  "cardNumber": "5487",
  "accidentType": "WITH_LEAVE",
  "occurredAt": "2026-08-05T13:30:00.000Z",
  "daysAway": 3,
  "description": "Queda no setor de montagem",
  "sourceChangedAt": "2026-08-05T14:00:00.000Z",
  "actor": {
    "externalId": "cipa-user-9",
    "name": "Maria CIPA",
    "identifier": "maria.cipa"
  }
}
```

#### Exemplo — editar tipo / dados

Mesmo `externalId`, `previousNature: "ACT"`, `sourceChangedAt` **mais novo**:

```json
{
  "nature": "ACT",
  "previousNature": "ACT",
  "costCenter": "4501",
  "unit": "PEDERTRACTOR",
  "cardNumber": "5487",
  "accidentType": "WITHOUT_LEAVE",
  "occurredAt": "2026-08-05T13:30:00.000Z",
  "daysAway": null,
  "description": "Reclassificado sem afastamento",
  "sourceChangedAt": "2026-08-05T16:00:00.000Z",
  "actor": {
    "externalId": "cipa-user-9",
    "name": "Maria CIPA",
    "identifier": "maria.cipa"
  }
}
```

#### Exemplo — condição → ato

```json
{
  "nature": "ACT",
  "previousNature": "CONDITION",
  "costCenter": "4501",
  "unit": "PEDERTRACTOR",
  "cardNumber": "5487",
  "accidentType": "WITHOUT_LEAVE",
  "occurredAt": "2026-08-05T13:30:00.000Z",
  "sourceChangedAt": "2026-08-06T10:00:00.000Z",
  "actor": {
    "externalId": "cipa-user-9",
    "name": "Maria CIPA",
    "identifier": "maria.cipa"
  }
}
```

### 1.2 Body — Condição (`nature: "CONDITION"`)

Use **somente** para informar que um ato passou a ser condição (sai do score).

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `nature` | `"CONDITION"` | sim | Discriminador |
| `previousNature` | `"ACT"` \| `"CONDITION"` \| `null` | sim | Deve ser `"ACT"` para surtir efeito |
| `occurredAt` | string ISO 8601 | sim | Data de referência |
| `sourceChangedAt` | string ISO 8601 | sim | Timestamp da mudança |
| `actor` | objeto | sim | Quem alterou |
| `reason` | string \| `null` | não | Motivo da reclassificação |
| `cycleYear` / `cycleMonth` | number | não* | Opcional, juntos |

#### Exemplo — ato → condição

```http
PUT /api/p5/integrations/cipa/accidents/CIPA-2026-00042
```

```json
{
  "nature": "CONDITION",
  "previousNature": "ACT",
  "occurredAt": "2026-08-05T13:30:00.000Z",
  "sourceChangedAt": "2026-08-07T09:00:00.000Z",
  "reason": "Reavaliado como condição insegura, sem acidente",
  "actor": {
    "externalId": "cipa-user-9",
    "name": "Maria CIPA",
    "identifier": "maria.cipa"
  }
}
```

Se `previousNature` for `null` ou `CONDITION`, o P5 responde com `operation: "IGNORED_CONDITION"` e **não grava** ocorrência.

### 1.3 Resposta do PUT

| HTTP | Quando |
|------|--------|
| `201` | Criação ou reclassificação para ato (`CREATED` / `RECLASSIFIED_TO_ACT`) |
| `200` | Demais operações aplicadas ou idempotentes |

```json
{
  "operation": "CREATED",
  "changed": true,
  "visibleInP5": true,
  "created": true,
  "accident": {
    "id": "uuid-interno-p5",
    "externalId": "CIPA-2026-00042",
    "nature": "ACT",
    "accidentType": "WITH_LEAVE",
    "status": "VALIDATED",
    "occurredAt": "2026-08-05T13:30:00.000Z"
  },
  "matched": {
    "employeeId": "...",
    "employeeName": "...",
    "sectorId": "...",
    "sectorName": "...",
    "cycleId": "...",
    "cycleMonth": 8,
    "cycleYear": 2026
  },
  "recalculated": true,
  "recalculatedCycleIds": ["..."],
  "historyId": "...",
  "impact": { }
}
```

#### Valores de `operation`

| Valor | Significado |
|-------|-------------|
| `CREATED` | Novo ato |
| `UPDATED` | Ato existente alterado |
| `RECLASSIFIED_TO_ACT` | Condição virou ato |
| `RECLASSIFIED_TO_CONDITION` | Ato virou condição (cancelado no P5) |
| `RESTORED` | Ato cancelado foi restaurado |
| `IGNORED_CONDITION` | Condição sem efeito no P5 |
| `UNCHANGED` | Mesmo estado (idempotente) |
| `CANCELLED` | (apenas no DELETE) |

---

## 2. DELETE — Cancelar logicamente

```http
DELETE /api/p5/integrations/cipa/accidents/{externalId}
Content-Type: application/json
X-CIPA-API-KEY: <chave>
```

O body é **obrigatório** (mesmo em DELETE):

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `sourceChangedAt` | string ISO 8601 | sim | Timestamp da exclusão no CIPA |
| `actor` | objeto | sim | Quem cancelou |
| `reason` | string \| `null` | não | Motivo |

```json
{
  "sourceChangedAt": "2026-08-08T11:00:00.000Z",
  "reason": "Registro duplicado",
  "actor": {
    "externalId": "cipa-user-9",
    "name": "Maria CIPA",
    "identifier": "maria.cipa"
  }
}
```

- Cancelamento é **lógico** (`status: CANCELLED`); a ocorrência deixa de pontuar e de aparecer como ativa.
- Se já estiver cancelado e o timestamp for o mesmo → `UNCHANGED`.
- Evento mais antigo que o último estado → `409`.
- `externalId` inexistente → `404`.

Resposta `200` com `operation: "CANCELLED"` (ou `UNCHANGED`).

---

## 3. POST — Rota legada (push simples)

```http
POST /api/p5/integrations/cipa/accidents
Content-Type: application/json
X-CIPA-API-KEY: <chave>
```

Compatibilidade com integrações antigas. Internamente vira um `PUT` com `nature: "ACT"`.

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `externalId` | sim | ID no CIPA |
| `costCenter` | sim | Código do setor |
| `unit` | sim | `PEDERTRACTOR` ou `TRACTOR` |
| `cardNumber` | sim | Cartão |
| `accidentType` | sim | `WITH_LEAVE` ou `WITHOUT_LEAVE` |
| `occurredAt` | sim | ISO 8601 |
| `daysAway` | não | Dias afastados |
| `description` | não | Texto |
| `cycleYear` / `cycleMonth` | não | Juntos, se informados |

**Limitações:** sem `previousNature`, sem `sourceChangedAt` explícito (P5 usa `now`), sem suporte a condição. **Prefira o PUT** para sincronização completa.

```json
{
  "externalId": "CIPA-2026-00042",
  "costCenter": "4501",
  "unit": "PEDERTRACTOR",
  "cardNumber": "5487",
  "accidentType": "WITH_LEAVE",
  "occurredAt": "2026-08-05T13:30:00.000Z",
  "daysAway": 3,
  "description": "Queda no setor de montagem"
}
```

---

## Fluxo recomendado (CIPA)

```
1. Criar acidente (ato)
   PUT .../accidents/{id}  nature=ACT, previousNature=null

2. Corrigir dados / tipo
   PUT .../accidents/{id}  nature=ACT, previousNature=ACT, sourceChangedAt ↑

3a. Cancelar de vez
   DELETE .../accidents/{id}

3b. Reclassificar como condição
   PUT .../accidents/{id}  nature=CONDITION, previousNature=ACT

4. (Opcional) Voltar a ser ato
   PUT .../accidents/{id}  nature=ACT, previousNature=CONDITION
```

Regras práticas:

1. Sempre use o mesmo `externalId`.
2. Sempre avance `sourceChangedAt`.
3. Não envie condições novas/sem vínculo com ato.
4. Não envie reincidência — o P5 calcula.
5. Garanta que colaborador (`unit` + `cardNumber`) e setor (`costCenter`) existam no P5.
6. Só envie se o ciclo mensal correspondente estiver aberto/editável.

---

## Códigos de erro comuns

| HTTP | Mensagem / causa típica |
|------|-------------------------|
| `400` | Payload inválido (`occurredAt`, `sourceChangedAt`, `cycleYear`/`cycleMonth` incompletos, etc.) |
| `401` | API key inválida ou ausente |
| `404` | Ciclo, setor, colaborador ou ocorrência não encontrados |
| `409` | Ciclo homologado/bloqueado; evento stale; conflito de timestamp |
| `503` | Integração CIPA não configurada no P5 |

Formato de erro:

```json
{
  "error": "mensagem em português"
}
```

---

## Checklist de integração

- [ ] `CIPA_API_KEY` alinhada entre CIPA e P5
- [ ] Header `X-CIPA-API-KEY` ou `Authorization: Bearer`
- [ ] `externalId` estável por acidente
- [ ] `sourceChangedAt` monotônico em toda mutação
- [ ] `actor` sempre preenchido (`externalId`, `name`, `identifier`)
- [ ] Apenas `WITH_LEAVE` / `WITHOUT_LEAVE` em atos
- [ ] Condições só enviadas com `previousNature: "ACT"` quando for reclassificação
- [ ] Colaboradores e centros de custo já sincronizados no P5
- [ ] Ciclo mensal existente e editável no P5
