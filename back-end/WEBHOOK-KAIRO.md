# Atualização por webhook do Kairo

O Kairo notifica `POST /api/webhooks/kairo` após alterações de atividades e projetos
com `integrationSource=solicitacao-eng-mecanica`, incluindo início/pausa por timer,
conclusão e exclusão. O nome da chave pessoal, como `pederflow`, não interfere.

## Configuração

Gere um segredo aleatório de pelo menos 32 caracteres e configure o mesmo valor:

- Solicitação (`back-end/.env`): `KAIRO_WEBHOOK_SECRET`.
- Kairo (`backend/.env`): `SOLICITATION_WEBHOOK_SECRET`.
- Kairo: `SOLICITATION_WEBHOOK_URL` com a URL completa do endpoint receptor.

Com os dois backends executando diretamente no host, o endereço padrão é
`http://localhost:3142/api/webhooks/kairo`. No Docker Desktop, com os Compose
atuais em redes distintas, use `http://host.docker.internal:5025/api/webhooks/kairo`.
Em servidores distintos use o endereço HTTPS do backend Solicitação acessível pelo Kairo.
Nunca use `localhost` para apontar a outro container. Reinicie/recrie os backends
após configurar as variáveis; publique também o frontend atualizado.

Sem configuração o comportamento anterior continua funcionando: o Kairo não envia
eventos e o receptor retorna 503. Não use a chave pessoal como segredo do webhook.

## Funcionamento e recuperação

O aviso leva `eventId`, `type=card.updated`, `teamId` e `cardId`. O Kairo assina
`timestamp + '.' + JSON.stringify(payload)` com HMAC-SHA256 e envia os headers
`X-Kairo-Timestamp` (segundos Unix) e `X-Kairo-Signature` (hexadecimal).
Assinaturas inválidas e timestamps com diferença superior a 5 minutos são rejeitados.
Mantenha os relógios dos servidores sincronizados.

O receptor identifica os cards vinculados e consulta os dados atuais no Kairo usando
a chave pessoal de quem enviou cada etapa. Aplica as regras existentes de Engenharia,
Ferramentaria e Amostra; não aceita um status informado pelo evento. Eventos repetidos
consultam novamente o estado atual, portanto um aviso atrasado não impõe status antigo.
Cards não vinculados são ignorados. Uma conclusão continua dependendo de todos os
cards exigidos pela etapa, quando houver vários.

O envio ocorre após a gravação, sem bloquear o usuário do Kairo. Há até 3 tentativas,
timeout de 10 segundos por tentativa e esperas de 1 e 2 segundos. Erros 4xx, exceto 429,
encerram as tentativas. Falhas ficam nos logs sem expor o segredo. A fila é em memória;
o job existente de 60 segundos continua recuperando eventos perdidos ou reinícios.
A chave pessoal precisa permanecer válida e com acesso ao time.

O webhook atualiza o backend imediatamente após o recebimento e consulta ao Kairo.
As telas de listagem, detalhes e fluxo consultam o Solicitação a cada 5 segundos
enquanto estão visíveis. Isso é leitura do banco local, sem sincronização de todos
os cards a cada consulta. A interface não utiliza WebSocket/SSE.

## Validação

Os testes cobrem assinatura, adulteração, validade temporal, erros recuperáveis,
seleção exata de IDs (inclusive múltiplos cards), roteamento por etapa e disparo
após gravações e transações. Para validar em ambiente integrado, envie uma etapa
ao Kairo com uma chave pessoal válida, conclua seus cards e observe a etapa no
Solicitação. Essa verificação exige os dois backends e os bancos disponíveis.
