# Responsáveis por pilar

## Modelo

- Tabela `UserPillarAssignment` liga `User` a `PillarCode` (N:N).
- Um responsável pode ter vários pilares; um pilar pode ter vários responsáveis.
- Associações são globais por código de pilar, válidas entre anos de programa.

## Papéis

| Papel | P5 | Pilares | Segurança | Ciclo / config |
| --- | --- | --- | --- | --- |
| ADMIN | Total | Todos | Leitura e edição | Total |
| RESPONSIBLE | Sim, se tiver pilares | Somente atribuídos | Somente leitura | Sem acesso |
| USER / LEADER | Não | — | — | — |

## API

- `POST /users/register` e `PATCH /users/:id` aceitam `pillarCodes`.
- `GET /users/me`, listagem e detalhe expõem `assignedPillarCodes`.
- Rotas P5 de leitura usam `p5Reader`; rotas de Segurança (GET) usam `safetyReader`.
- Mutações de ciclo, CIPA manual, simulação e configuração permanecem `ADMIN`.

## Frontend

- Cadastro/edição de usuário: multi-select de pilares quando role = `RESPONSIBLE`.
- Permissões centralizadas em `front-end/src/config/permissions.ts`.
- Hook `useP5Permissions` para páginas P5.
- Segurança exibe badge “Somente visualização” para responsáveis.

## Pilares ainda não operacionais

Produtividade, Qualidade 5S e Faturamento já podem ser atribuídos, mas a edição operacional será habilitada quando seus módulos forem implementados.

Absenteísmo já pontua a parcela **individual** (40/100 internos) via procedure Firebird no mês anterior. Ver [absenteismo-pilar.md](./absenteismo-pilar.md). A parcela setorial (60) ainda é placeholder.
