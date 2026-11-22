# Convite do Google Meet nos contatos agendados

Ao agendar um contato (na Agenda ou ao registrar um contato com "próximo contato"), o mentor pode marcar **"Enviar convite do Google Meet para o aluno"**. O Google cria o evento **na agenda do próprio mentor**, com o link do Meet, e manda o e-mail de convite ao aluno. Remarcar ou apagar o contato atualiza ou cancela o evento, e o aluno recebe o aviso do Google.

Está **pronto e desligado**: sem as configurações abaixo, o portal nem mostra o cartão "Convite do Google Meet".

## Como funciona (e o que vai ao Google)

- Cada mentor conecta a **própria** conta Google (OAuth), uma vez, na página Agenda. Não há conta compartilhada.
- Escopos pedidos: `openid`, `email` (para mostrar qual conta está conectada) e `calendar.events` (criar, remarcar e cancelar eventos). O portal **não lê** o resto da agenda.
- O servidor guarda só o *refresh token*, **cifrado** (Fernet). O mentor desconecta quando quiser: isso revoga o token no Google e apaga a linha.
- Cada convite é uma **ação explícita**, contato a contato. O servidor nunca envia convite por conta própria.
- Ao Google vão: título genérico ("Mentoria Residente de Elite"), descrição genérica, horário e duração, o **e-mail do aluno** e o e-mail do mentor (a conta dele). **Não vão**: nome do aluno, resumo do contato, pauta, anotações, nem dado de estudo.
- Se o Google falhar na hora de agendar, o contato **fica salvo** e o portal mostra o motivo; o convite pode ser enviado depois pela Agenda. Se falhar ao remarcar ou apagar um contato que tem convite, **nada muda** no portal (para o aluno não ficar com um convite que o portal esqueceu).

## Decisão de privacidade (do dono)

Enviar o e-mail do aluno ao Google para ele receber o convite é tratamento de dado pessoal por um terceiro (o Google, já usado pelos mentores). Antes de ligar: informar isso na política de privacidade e na mentoria, e decidir se o aluno precisa aceitar receber convites. O convite sai só quando o mentor marca a caixa.

## O que você precisa fazer para ligar

### 1. Google Cloud
1. Crie (ou use) um projeto em console.cloud.google.com e ative a **Google Calendar API**.
2. Em *APIs e serviços → Tela de consentimento OAuth*: nome do app "Residente de Elite — Mentoria", e-mail de suporte, domínio `residente-elite.com`, política de privacidade.
3. Em *Escopos*, adicione `…/auth/calendar.events`.
4. **Tipo de usuário:**
   - Se os mentores usam contas **Google Workspace do mesmo domínio**, escolha **Interno**: não precisa de verificação do Google.
   - Se usam contas **@gmail.com**, o tipo é **Externo**, e o escopo `calendar.events` é "sensível": para uso geral o app precisa passar pela **verificação do Google** (leva dias ou semanas). Enquanto está em "Teste" funciona só para até 100 usuários de teste cadastrados e **o refresh token expira em 7 dias** (o mentor teria que reconectar toda semana). Para produção, publique e verifique o app.
5. Em *Credenciais → Criar ID do cliente OAuth → Aplicativo da Web*:
   - **URI de redirecionamento autorizado:** `https://api.residente-elite.com/api/v1/mentoring/google/callback/` (a URL pública da API; tem de ser idêntica a `GOOGLE_OAUTH_REDIRECT_URI`).
   - Anote o **ID do cliente** e o **segredo**.

### 2. Serviço Django (AWS)
Variáveis do serviço (o **segredo** e a **chave de cifra** devem vir do Secrets Manager/SSM, não ficar em texto na definição da task):

| Variável | Valor |
|---|---|
| `GOOGLE_MEET_ENABLED` | `True` |
| `GOOGLE_OAUTH_CLIENT_ID` | ID do cliente |
| `GOOGLE_OAUTH_CLIENT_SECRET` | segredo (secret) |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://api.residente-elite.com/api/v1/mentoring/google/callback/` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | chave Fernet (secret) |
| `MENTOR_PORTAL_URL` | `https://mentor.residente-elite.com` (padrão) |

Gerar a chave de cifra (guarde-a: se ela mudar, os mentores precisam reconectar):

```powershell
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Sem **qualquer uma** das cinco primeiras, a integração fica desligada (meia configuração vale como desligado).

### 3. Portal
Nada a configurar: a Agenda pergunta ao servidor (`GET /mentoring/google/`) e só mostra o convite quando `enabled` é verdadeiro.

## Testar depois de ligar
1. Na Agenda, "Conectar conta Google" e autorizar com uma conta de teste.
2. Agendar um contato com um aluno de teste (com o seu e-mail) marcando o convite: o e-mail chega e o evento aparece na sua agenda com o link do Meet.
3. Remarcar e apagar o contato: o Google avisa o aluno de teste.
4. "Desconectar": o acesso some em myaccount.google.com/permissions.

## Códigos de erro (o portal mostra a frase)
`google_nao_conectado` (409: conectar, ou reconectar se expirou), `google_indisponivel` (502: o Google recusou ou não respondeu; tente de novo). Os detalhes do erro do Google ficam só no log do servidor, nunca na resposta.
