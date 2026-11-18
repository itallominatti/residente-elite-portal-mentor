# O que o portal precisa do elite-med-back-end

Resposta curta: **o portal já funciona com o que existe**, desde que a API aceite a origem nova no CORS. Para entregar tudo o que o protótipo de design propõe, o back-end precisa de ajustes, em três níveis.

Levantamento feito lendo o código em 18/11/2026 (nenhum arquivo do back-end foi alterado).

## O que o portal usa hoje, sem mudar nada no servidor

| Tela | Endpoint | Regra de acesso no servidor |
|---|---|---|
| Entrar | `POST /auth/login/`, `POST /auth/token/refresh/` | aceita admin, mentor e submentor (o portal recusa aluno) |
| Carteira | `GET /mentoring/students/` | `alunos_de(ator)`: mentor os seus, submentor os do mentor pai, admin todos |
| Situação e motivos | `GET /mentoring/radar/` | mesma regra; 5 motivos determinísticos |
| Conversas | `GET/POST /mentoring/chat/threads/…`, `threads/open/`, `messages/`, `read/` | `pode_participar` / `pode_escrever` derivados da árvore; `can_write` por conversa |
| Ramo | `GET /mentoring/tree/` | admin vê todos; mentor/submentor o próprio ramo |
| Meta semanal (ler e editar) | `GET/PUT/DELETE /mentoring/students/<id>/goal/` | só quem atende o aluno |
| Atividade de 30 dias | `GET /revision/calendar-items/?user_id=` | `pode_acompanhar_aluno` (403 fora da carteira) |
| Recomeços da revisão | `GET /revision/students/<id>/resets/` | idem |
| Métricas completas (só admin hoje) | `GET /revision/evolution/`, `priority-themes/`, `schedules/` com `?user_id=` | `usuario_alvo`: só admin lê outro aluno |
| Admin "ver como" | os mesmos acima, recortados por mentor no navegador | o admin já lê toda a base no hub; nada é ampliado |

## P0: obrigatório para ir ao ar

**1. CORS.** Incluir `https://mentor.residente-elite.com` em `CORS_ALLOWED_ORIGINS` do serviço Django em produção (variável de ambiente lida em `internal/infrastructure/config/settings.py`). Conferir também se a borda da API (`deploy/terraform/api-edge`) repassa o cabeçalho `Origin` para essa origem. Sem isso, o navegador bloqueia toda chamada do portal. É configuração, não código.

## P1: para o mentor ver todas as métricas do mentorando (feito, falta publicar)

Feito no `elite-med-back-end` e já na `main` (commit `226cc1e`). Falta commitar a regravação da fotografia de contrato `test_g4_revisao::test_hub_acompanha_a_agenda_do_aluno`, que ainda registra o comportamento antigo.

**2. Leitura da revisão do aluno pelo mentor.** Antes, `usuario_alvo` (`internal/domain/revision/services.py`) só honrava `?user_id=` para admin: o mentor que pedia a evolução de um aluno recebia **a própria**, com 200 e sem erro. Agora:

| Quem pede `?user_id=` de outro aluno | Resposta |
|---|---|
| admin ou superusuário | os dados do aluno (como antes) |
| mentor ou submentor que **atende** o aluno | os dados do aluno |
| mentor ou submentor que **não atende** (ou id malformado) | 403 `{"error": "Você não atende este aluno."}` |
| aluno | os próprios dados, ignorando o pedido (como antes, de propósito: um 403 diria que o id existe) |

"Atende" é a mesma pergunta de `calendar-items` e da meta semanal (`get_pode_acompanhar_aluno`). Vale para `revision/evolution`, `revision/priority-themes`, `revision/schedules`, `themes/?user=` e `isolated-simulados/evolution` e `categories`.

A permissão nova `LeRevisaoDeQuemAcompanha` deixa o mentor **ler** a revisão do aluno sem ter o produto de revisão (a revisão é do aluno). Só em GET: em escrita, e na própria revisão sem `?user_id=`, a checagem de produto continua.

Testes: domínio (`tests/revision/domain/test_evolucao.py`) e integração (`tests/revision/integration/test_isolamento_entre_alunos.py`): mentor lê (até sem produto), submentor lê pelo mentor pai, outro ramo leva 403 sem nada do aluno, id malformado leva a mesma recusa, aluno continua ignorado, POST não pula a checagem de produto.

**Para ligar no portal:** depois do deploy do back-end, `VITE_FEATURE_METRICAS_DO_MENTOR=true` no environment `production` do GitHub e um novo deploy. O portal já tem a tela (desempenho na revisão e temas críticos).

**3. Ainda não feito: simulados (prova), caderno de erros, flashcards e foco.** Não têm leitura por aluno nem para admin fora das telas próprias do hub (`exams/views/admin.py` exige `IsAdmin`). Pedem endpoints de leitura novos com a mesma regra; o portal ainda não mostra esses blocos.

**4. (desempenho, opcional, não feito) Carteira com indicadores.** O portal monta a carteira juntando 3 listas (alunos, radar e conversas). Serve bem para centenas de alunos. Para mostrar na lista o acerto de 14 dias, a meta da semana e as revisões atrasadas de cada aluno (como no protótipo), o caminho é um `GET /mentoring/carteira/` que devolva esses números em lote, reaproveitando `radar_query.py`, que já calcula tudo por escopo com número fixo de consultas.

## P2: funções novas do protótipo

**5. Contatos, anotações privadas, pendências e plano.** Não existe nada disso no servidor: o contexto de mentoria só tem vínculo, chat e meta semanal. Precisa de modelos novos e de decisões de privacidade: anotação privada é de quem escreveu (submentor lê?), pode ter dado sensível, tem prazo de guarda e precisa responder ao direito do titular.

**6. "Ver como" com auditoria por recurso.** O portal já faz o "ver como" somente leitura no navegador (o admin já tem leitura total). O que falta é a trilha "quem viu o quê": hoje `ImpersonationSessionModel` guarda só a sessão de personificação de aluno (quem, alvo, IP, navegador, início e fim). Proposta: sessão de visualização própria (`POST /mentoring/view-as/` com motivo), um cabeçalho `X-Ver-Como: <sessão>` que o servidor exige em modo somente GET e um evento por recurso aberto (conversa, perfil, nota), com leitura em `GET /mentoring/view-as/audit/`.

**7. Elitinho do mentor.** O serviço `elitinho` dá a mentor e submentor a mesma persona e as mesmas ferramentas do aluno, filtradas pelo próprio usuário do token, e recusa durante a personificação. Um Elitinho de apoio ao mentor precisa de persona, ferramentas filtradas por `alunos_de(ator)` e, antes de tudo, **decisão de privacidade**: mandar o desempenho do aluno a um modelo de terceiro é tratamento novo. O próprio radar foi feito sem IA por isso.

**8. Agregados para o admin.** Tempo médio de resposta por mentor. Hoje o portal calcula só "aguardando resposta" e "em risco" por mentor, no navegador.

## Achado de passagem

O retorno silencioso de `usuario_alvo` (item 2) valia também fora do portal: qualquer tela que abrisse o Acompanhamento do hub para mentor mostraria dados errados sem erro nenhum. O ajuste do P1 resolve isso para todos os clientes.
