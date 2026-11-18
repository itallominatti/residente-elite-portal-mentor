# Como subir na AWS e ligar o CI/CD

Tudo em `us-east-1`, na mesma conta e na mesma zona do Route 53 do admin-hub (`residente-elite.com`). O site fica em `https://mentor.residente-elite.com`.

## Atalho: `make`

O `Makefile` da raiz faz os passos 1 e 2 com as travas de segurança. Rode no Git Bash ou WSL:

```bash
make help                      # lista os alvos
make quem-sou                  # em qual conta AWS os comandos vão rodar
make bootstrap                 # (uma vez por conta) bucket do estado remoto
make prod                      # init + plan + pede "sim" + apply + imprime as variáveis do GitHub
make prod OIDC=true            # idem, criando o provedor OIDC do GitHub (conta que ainda não tem)
make plan && make apply        # mudanças seguintes: revisa o plano e aplica exatamente ele
make github-vars               # reimprime as variáveis do environment production
make validate                  # o mesmo fmt/validate do CI, sem credenciais
```

`AWS_PROFILE=perfil` escolhe o perfil da AWS e `CONTA_ESPERADA=123456789012` recusa rodar em outra conta. `make destroy` só roda com `CONFIRMAR=derrubar-portal-mentor`.

Os passos abaixo são o que o `make` faz por baixo.

## 1. Estado remoto (uma vez por conta)

Se a conta ainda não tem bucket de estado do Terraform:

```bash
cd iac/bootstrap
terraform init
terraform apply          # cria residente-elite-terraform-state (versionado, criptografado, só TLS)
```

Se já existe um, pule e use o nome dele no passo seguinte.

## 2. Infraestrutura do portal

```bash
cd iac
cp backend.hcl.example backend.hcl          # ajuste o bucket se for outro
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

Cria: bucket privado (versionado), CloudFront com OAC, função de rotas da SPA, cabeçalhos de segurança (CSP, HSTS, `frame-ancestors 'none'`), certificado ACM validado por DNS, registros A/AAAA e o papel IAM de deploy por OIDC.

**Provedor OIDC do GitHub:** é um por conta. Se a conta ainda não tiver (nenhum outro repositório usa OIDC), rode com `-var create_github_oidc_provider=true`. Caso contrário, o padrão (`false`) lê o que já existe.

Anote as saídas:

```bash
terraform output
```

## 3. Repositório no GitHub

1. Crie o repositório `itallominatti/residente-elite-portal-mentor` (privado) e envie a branch.
2. **Settings → Environments → New environment → `production`.** Recomendo: "Required reviewers" (você) e "Deployment branches: main".
3. Em **Environment variables** de `production`:

| Variável | Valor |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | saída `deploy_role_arn` |
| `S3_BUCKET` | saída `s3_bucket` |
| `CLOUDFRONT_DISTRIBUTION_ID` | saída `cloudfront_distribution_id` |
| `VITE_API_BASE_URL` | `https://api.residente-elite.com/api/v1` |
| `VITE_FEATURE_METRICAS_DO_MENTOR` | `false` (vira `true` depois do ajuste P1 no back-end) |

Não há secret: o deploy usa OIDC, sem chave de acesso guardada.

## 4. Antes do primeiro acesso

Incluir `https://mentor.residente-elite.com` no `CORS_ALLOWED_ORIGINS` da API (docs/BACKEND.md, P0). Sem isso, o login falha no navegador.

## Workflows

- **`ci.yml`**: em todo PR e push fora da main. Lint, tipos, testes, build, `terraform fmt -check` e `terraform validate`.
- **`deploy.yml`**: push na main ou disparo manual. Roda o CI inteiro, depois build com as variáveis do environment, envia ao S3 (arquivos com hash com cache de 1 ano, `index.html` sem cache e por último), invalida o CloudFront, espera terminar e confere que `/mentorandos` responde 200.

O Terraform não roda no GitHub: `apply` cria papel IAM e certificado, e é mais seguro rodar à mão, com revisão do `plan`.

## Voltar uma versão

O bucket é versionado (versões antigas ficam 30 dias). O jeito mais simples é reverter o commit na main e deixar o deploy rodar de novo.
