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

## P2: funções novas do protótipo (feitas no back-end, falta publicar)

Tudo abaixo está na branch `feat/api-do-portal-do-mentor` do `elite-med-back-end` (migrações 0151 e 0152, só tabelas novas) e no portal atrás de `VITE_FEATURE_ACOMPANHAMENTO`. Nada foi enviado para a `main` do back-end (um push lá dispara o deploy de produção).

**3. Estudo do aluno (feito).** `GET /mentoring/students/<id>/estudo/`: simulados feitos na plataforma (finalizados e parados), desempenho por área e tema (a mesma consulta da tela do aluno), caderno de erros **só por contagem** (motivo e área; a anotação e o enunciado ficam de fora), flashcards e rotinas de foco. O servidor não registra sessões de foco, só as rotinas: horas de foco não existem. Regra: quem atende o aluno ou admin; fora disso, 403 "Você não atende este aluno.".

`GET /mentoring/students/<id>/respostas/` lista as **questões que o aluno respondeu** (30 por página, da mais recente): enunciado resumido (sem HTML, até 240 caracteres), área, tema, simulado, se acertou e se a tentativa terminou. Filtros `acerto=true|false` e `tentativa_id` (o botão "Ver questões" de cada simulado). **Nunca** traz gabarito, alternativas nem comentário. Mesma regra de acesso do estudo.

**4. Carteira com indicadores (feito).** `GET /mentoring/carteira/` (paginada, `busca`, e `mentor_id` só para admin): acerto das duas janelas de 14 dias com a variação, esforço da semana contra a meta, revisões atrasadas e de hoje, dias sem questão, motivos do radar e simulado parado. Mesmas regras e mesma leitura em lote do radar, sem IA.

**5. Contatos, anotações privadas, agenda e plano (feito).** Quatro tabelas novas e as rotas `mentoring/students/<id>/{contatos,notas,plano}/`, `mentoring/{contatos,notas,plano}/<id>/` e `mentoring/pendencias/`. Quem pode o quê, decidido no servidor:

| Recurso | Lê | Escreve |
|---|---|---|
| Contato com o aluno | quem atende o aluno e o admin | quem atende; só o autor altera ou apaga |
| Plano do aluno | quem atende o aluno e o admin | quem atende; só o autor apaga |
| Anotação privada | **só o autor** (nem o admin: 403 explícito) | só o autor |
| Pendência e agenda | o dono; o admin só **lê**, e só dentro de uma sessão de "ver como" aberta sobre aquele mentor (`GET /mentoring/pendencias/?mentor_id=`, que entra na trilha) | só o dono |

Registrar um contato cria os próximos passos e o próximo contato (pendências) na mesma transação. Id de outra pessoa responde "não encontrado". **Decisões de privacidade que ficaram em aberto para o dono:** prazo de guarda das anotações e dos contatos, e o procedimento para atender direito do titular (o admin não abre anotação pela API; abrir é um procedimento fora dela).

**6. "Ver como" com auditoria (feito).** `POST /mentoring/ver-como/` (`{mentor_id, motivo, detalhe}`: motivos `suporte`, `qualidade`, `denuncia`, `lgpd`, `outro`; "outro" exige detalhe) abre uma sessão. Dali em diante o portal manda `X-Ver-Como: <sessão>` em toda requisição e **o servidor é a trava**: só leitura (403 `ver_como_somente_leitura`), só os alunos e a carteira do mentor visto (403 `ver_como_fora_do_escopo`), 30 minutos sem uso e 8 horas no máximo (403 `ver_como_encerrado`), sessão de outro admin responde como encerrada. Cada acesso é gravado **antes** de a view rodar (rota e aluno, nunca o conteúdo). Consulta só para admin: `GET /mentoring/ver-como/auditoria/` e `/<sessão>/auditoria/`; encerrar em `POST /mentoring/ver-como/<sessão>/encerrar/`. Submentor não é alvo (não tem carteira própria; vê-se a do pai). A classe de autenticação `VerComoAwareJWTAuthentication` substituiu a de personificação no DRF e a estende (tokens normais não pagam nada); o cabeçalho `X-Ver-Como` entrou no `CORS_ALLOW_HEADERS`.

**7. Elitinho do mentor (feito, DESLIGADO).** Perfil de conversa para mentor e submentor no serviço `elitinho`, só leitura: ele chama o Django com o token do próprio mentor (o Django continua decidindo o escopo) e recebe só campos da lista branca e o primeiro nome do aluno. Nunca vê anotações privadas, nem conversas do aluno com o Elitinho, nem texto do caderno de erros. A chave `MENTOR_ASSISTANT_ENABLED` nasce `false` em todo ambiente, terraform incluso (`apoio_ao_mentor_ligado`). **Não ligar sem a decisão de LGPD** (base legal, aviso na política de privacidade, contrato com o provedor, retenção das conversas): o checklist está no README do serviço, em "Antes de ligar em produção". No portal, `VITE_FEATURE_ELITINHO_DO_MENTOR` + `VITE_ELITINHO_API_URL`.

**7b. Convite do Google Meet (feito, DESLIGADO até configurar).** Cada mentor conecta a própria conta Google e pode enviar convite do Meet ao agendar um contato; o evento nasce na agenda dele e o Google avisa o aluno. Migração 0153 (só tabela e colunas novas). Tudo o que é preciso configurar (Google Cloud, variáveis do serviço, decisão de privacidade) está em `docs/GOOGLE-MEET.md`.

**7c. Calendário de revisões e cor das pendências (feito).** Migração 0154 (uma coluna e uma tabela de trilha).

- `GET /mentoring/revisoes/?de=&ate=` lista as revisões agendadas dos alunos da carteira no período (até 100 dias; `aluno_id`, `concluidas=true`, e `mentor_id` só para admin). Mentor lê os seus alunos, submentor os do pai, admin todos. Em "ver como" vale só a carteira do mentor visto, mesmo sem o parâmetro.
- `PATCH /mentoring/revisoes/<id>/` `{para_quando}` remarca para o dia **e a hora** exatos. Quem pode: quem atende o aluno ou o admin (o admin já podia reagendar pela rota do aluno). Em "ver como" o servidor recusa. Regras: só revisão pendente; data futura e até 365 dias à frente; **sem** o teto de 30 dias nem o ajuste de "quatro por dia" que valem para o aluno (quem remarca decidiu; o servidor só devolve `no_mesmo_dia`, quantas outras revisões do aluno caem nesse dia, e a tela avisa). Não conta como adiamento do aluno (`rescheduled_count` não muda), reabre o lembrete (`reminder_sent_at` volta a nulo) e grava a trilha em `mentor_revision_moves` (quem, de, para, quando).
- A pendência ganha `color` (`azul`, `verde`, `amarelo`, `laranja`, `vermelho`, `roxo`, `rosa`, `cinza`; vazio = padrão do tipo) em `POST` e `PATCH`.
- No portal: a Agenda tem o calendário por horário (dia e semana, hora de São Paulo, encaixe de 15 min), com pendências, contatos e revisões; clicar num horário cria, arrastar remarca, clicar num item abre o detalhe (pintar, concluir, apagar, Meet). A revisão arrastada pede confirmação e avisa se o dia do aluno fica cheio. O admin tem a página "Revisões" (`/admin/revisoes`) com filtro por mentor. Arrastar não funciona no toque (briga com a rolagem): pelo detalhe dá para remarcar digitando.

**7d. A prova do aluno na ordem do simulado (feito).** `GET /mentoring/students/<id>/provas/<tentativa>/` devolve a prova como o modal de respostas do admin-hub a mostra: cada questão **na ordem do simulado** (Q1, Q2...), com enunciado (texto rico), categoria e tema, o resultado (acertou, errou, em branco), as alternativas (qual o aluno marcou e qual é a certa, com a explicação da alternativa quando houver) e o comentário da questão. Questão anulada vem marcada. Mesma regra de acesso do estudo; tentativa de outro aluno responde "Prova não encontrada". No portal, a aba Estudo abre a prova com "Ver prova" em cada simulado; o histórico corrido de questões ficou recolhido, e cada linha leva à prova. O texto rico passa pelo mesmo filtro do back-end e do admin-hub (`src/lib/richText.ts`).

**8. Agregados para o admin (não feito).** Tempo médio de resposta por mentor. Hoje o portal calcula só "aguardando resposta" e "em risco" por mentor, no navegador.

## Ordem para publicar

1. Revisar e mesclar `feat/api-do-portal-do-mentor` na `main` do back-end (o deploy roda as migrações 0151 e 0152, só criam tabelas) e conferir o pipeline.
2. No GitHub do portal, environment `production`: `VITE_FEATURE_METRICAS_DO_MENTOR=true` (se ainda não) e `VITE_FEATURE_ACOMPANHAMENTO=true`, e rodar o deploy do portal.
3. Elitinho do mentor: só depois da decisão de LGPD.

## Achado de passagem

O retorno silencioso de `usuario_alvo` (item 2) valia também fora do portal: qualquer tela que abrisse o Acompanhamento do hub para mentor mostraria dados errados sem erro nenhum. O ajuste do P1 resolve isso para todos os clientes.
