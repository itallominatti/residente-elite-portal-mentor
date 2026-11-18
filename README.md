# Portal do mentor · Residente de Elite

O portal exclusivo do mentor: quem precisa de atenção hoje, a carteira com a situação de cada mentorando, o perfil do aluno, as conversas e o radar. Administradores entram no mesmo portal, veem a lista de mentores e podem **ver como um mentor**, em somente leitura e com faixa de aviso fixa.

Desenho de referência: `../elite-med-portal-mentor-design` (protótipo HTML). Este repositório é o app de verdade, ligado à API do `elite-med-back-end`.

## Rodar

```bash
npm ci
npm run dev:mock      # http://localhost:5196 com API de mentira (dados fictícios)
npm run dev           # contra a API real (precisa do CORS liberado; veja docs/BACKEND.md)
```

Na API de mentira, qualquer senha entra: e-mail começando com `admin` entra como administrador; com `vazio`, como mentora sem mentorandos; qualquer outro, como a Dra. Ana. Ela só existe em desenvolvimento e não vai para o build.

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## O que funciona hoje

- **Entrar** com a conta do admin-hub (mentor, submentor ou admin; aluno é recusado). Mesma regra de sessão do hub: "manter conectado", renovação de token, saída após 1 h sem uso.
- **Início**: quem precisa de você hoje (radar + espera de resposta), quem está esperando e os números da carteira.
- **Meus mentorandos**: busca, filtros por situação e ordenação. Situação calculada das 5 regras do radar.
- **Perfil, em quatro abas** (`/mentorandos/:id`, `/desempenho`, `/estudo`, `/plano`):
  - **Visão geral:** por que está no radar, resumo "antes da conversa", números das últimas 12 semanas, atividade recente, meta semanal e recomeços.
  - **Desempenho:** acerto por semana, por grande área, temas prioritários e simulados registrados.
  - **Estudo:** constância das 12 semanas, questões por semana, revisões atrasadas por etapa.
  - **Plano e metas:** a meta semanal, editável.
  - Os números são "na revisão" (revisão espaçada, revisões isoladas e simulados registrados); o que o aluno responde só no banco de questões não passa por essas rotas, e as telas dizem isso. Acerto, temas e revisões atrasadas aparecem para admin e, para o mentor, quando `VITE_FEATURE_METRICAS_DO_MENTOR` estiver ligada.
- **Conversas**: fila por espera, envio, leitura, rascunho do radar no campo (o mentor revisa e envia; nada sai sozinho), contexto do aluno ao lado.
- **Radar**: em risco, filtros por motivo, motivos mais frequentes e o ramo (o que o mentor usava na Árvore).
- **Admin**: lista de mentores com em risco e aguardando por mentor; "ver como" com motivo obrigatório, somente leitura (a trava fica no cliente HTTP: nenhuma escrita sai), expira em 30 min sem uso.
- **Estados**: carteira vazia explicada, aluno fora da carteira (403), erro com "tentar de novo", celular e computador.

O que depende do servidor está em [docs/BACKEND.md](docs/BACKEND.md). Como publicar: [docs/DEPLOY.md](docs/DEPLOY.md).

## Estrutura

```
src/
  config.ts             URL da API e chaves de função
  lib/session.ts        tokens e renovação (mesma regra do admin-hub)
  lib/http.ts           transporte, erros e a trava de somente leitura
  lib/api/              clientes por contexto (auth, mentoring, chat, revision)
  lib/carteira.ts       junta carteira, radar e conversas e decide a situação (testado)
  contexts/             sessão e escopo ("ver como" / segundo chapéu do admin)
  components/           casca, peças de interface, peças da carteira
  pages/                telas
  mocks/api.ts          API de mentira, só em desenvolvimento
  styles/               tokens e componentes vindos do protótipo de design
iac/                    Terraform: S3 + CloudFront + ACM + Route 53 + papel OIDC de deploy
.github/workflows/      CI (PR) e deploy (main)
```
