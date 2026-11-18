# ============================================================
# Infra de produção do portal do mentor (Terraform em iac/).
#
# Caminho da primeira vez:
#   make bootstrap        # uma vez por conta: bucket do estado remoto
#   make prod             # init + plan + confirmação + apply + variáveis do GitHub
#
# Depois, para cada mudança em iac/:
#   make plan             # revise o que vai mudar
#   make apply            # aplica EXATAMENTE o plano revisado
#
# Opções (na linha de comando):
#   AWS_PROFILE=meu-perfil  perfil do ~/.aws a usar (padrão: o do ambiente)
#   OIDC=true               cria o provedor OIDC do GitHub (só se a conta ainda não tiver)
#   AUTO_APPROVE=true       pula a confirmação do `make prod` (não recomendado)
#
# O deploy do SITE (build + S3 + CloudFront) é do GitHub Actions
# (.github/workflows/deploy.yml). Este Makefile cuida só da infraestrutura.
# ============================================================

SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help
.ONESHELL:

TF            ?= terraform
TF_DIR        := iac
BOOTSTRAP_DIR := iac/bootstrap
BACKEND_HCL   := $(TF_DIR)/backend.hcl
PLANO         := portal.tfplan
CONTA_ESPERADA ?=

ifdef AWS_PROFILE
export AWS_PROFILE
endif

TF_VARS :=
ifeq ($(OIDC),true)
TF_VARS += -var create_github_oidc_provider=true
endif

.PHONY: help ferramentas quem-sou backend-config bootstrap init fmt validate plan apply prod outputs github-vars confirmar-destroy destroy limpar

help: ## Lista os alvos
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

ferramentas: ## Confere terraform e aws instalados
	@command -v $(TF) >/dev/null || { echo "Falta o terraform (>= 1.10)."; exit 1; }
	@command -v aws >/dev/null || { echo "Falta o AWS CLI v2."; exit 1; }
	@$(TF) version | head -1

quem-sou: ferramentas ## Mostra em qual conta AWS os comandos vão rodar
	@conta=$$(aws sts get-caller-identity --query Account --output text) || { echo "Sem credenciais AWS válidas (aws sso login / aws configure)."; exit 1; }
	@arn=$$(aws sts get-caller-identity --query Arn --output text)
	@echo "Conta AWS: $$conta"
	@echo "Identidade: $$arn"
	@if [ -n "$(CONTA_ESPERADA)" ] && [ "$$conta" != "$(CONTA_ESPERADA)" ]; then echo "Conta errada: esperava $(CONTA_ESPERADA)."; exit 1; fi

backend-config: $(BACKEND_HCL) ## Cria iac/backend.hcl a partir do exemplo (se não existir)

$(BACKEND_HCL):
	@cp $(TF_DIR)/backend.hcl.example $(BACKEND_HCL)
	@echo "Criei $(BACKEND_HCL) a partir do exemplo. Confira o bucket antes de seguir:"
	@cat $(BACKEND_HCL)

bootstrap: quem-sou ## (uma vez por conta) Cria o bucket do estado remoto
	$(TF) -chdir=$(BOOTSTRAP_DIR) init -input=false
	$(TF) -chdir=$(BOOTSTRAP_DIR) apply

init: ferramentas $(BACKEND_HCL) ## terraform init com o estado remoto
	$(TF) -chdir=$(TF_DIR) init -input=false -backend-config=backend.hcl

fmt: ## Formata os .tf
	$(TF) -chdir=$(TF_DIR) fmt -recursive

validate: ferramentas ## fmt -check e validate, sem backend nem credenciais (o mesmo do CI)
	$(TF) -chdir=$(TF_DIR) fmt -recursive -check -diff
	$(TF) -chdir=$(TF_DIR) init -backend=false -input=false >/dev/null
	$(TF) -chdir=$(TF_DIR) validate
	$(TF) -chdir=$(BOOTSTRAP_DIR) init -backend=false -input=false >/dev/null
	$(TF) -chdir=$(BOOTSTRAP_DIR) validate

plan: quem-sou init ## Gera o plano (iac/portal.tfplan) para revisar
	$(TF) -chdir=$(TF_DIR) plan -input=false $(TF_VARS) -out=$(PLANO)
	@echo
	@echo "Plano salvo em $(TF_DIR)/$(PLANO). Revise acima e rode: make apply"

apply: quem-sou ## Aplica o plano salvo pelo `make plan` (e só ele)
	@[ -f "$(TF_DIR)/$(PLANO)" ] || { echo "Sem plano salvo. Rode antes: make plan"; exit 1; }
	$(TF) -chdir=$(TF_DIR) apply -input=false $(PLANO)
	@rm -f "$(TF_DIR)/$(PLANO)"
	@$(MAKE) --no-print-directory github-vars

prod: quem-sou init ## Sobe a produção: plan, confirmação, apply e variáveis do GitHub
	$(TF) -chdir=$(TF_DIR) plan -input=false $(TF_VARS) -out=$(PLANO)
	@echo
	@if [ "$(AUTO_APPROVE)" != "true" ]; then
	  read -r -p "Aplicar este plano em PRODUÇÃO? Digite 'sim' para continuar: " resposta
	  [ "$$resposta" = "sim" ] || { echo "Cancelado. Nada foi aplicado."; rm -f "$(TF_DIR)/$(PLANO)"; exit 1; }
	fi
	$(TF) -chdir=$(TF_DIR) apply -input=false $(PLANO)
	@rm -f "$(TF_DIR)/$(PLANO)"
	@$(MAKE) --no-print-directory github-vars

outputs: ## Mostra as saídas do terraform
	$(TF) -chdir=$(TF_DIR) output

github-vars: ## Imprime as variáveis do environment `production` do GitHub
	@bucket=$$($(TF) -chdir=$(TF_DIR) output -raw s3_bucket)
	@dist=$$($(TF) -chdir=$(TF_DIR) output -raw cloudfront_distribution_id)
	@papel=$$($(TF) -chdir=$(TF_DIR) output -raw deploy_role_arn)
	@url=$$($(TF) -chdir=$(TF_DIR) output -raw site_url)
	@echo
	@echo "GitHub > Settings > Environments > production > Variables:"
	@echo "  AWS_DEPLOY_ROLE_ARN              $$papel"
	@echo "  S3_BUCKET                        $$bucket"
	@echo "  CLOUDFRONT_DISTRIBUTION_ID       $$dist"
	@echo "  VITE_API_BASE_URL                https://api.residente-elite.com/api/v1"
	@echo "  VITE_FEATURE_METRICAS_DO_MENTOR  false   (true depois do back-end com feat/mentor-le-revisao-do-aluno)"
	@echo
	@echo "Antes do primeiro acesso: incluir $$url no CORS_ALLOWED_ORIGINS da API."
	@if command -v gh >/dev/null; then
	  echo
	  echo "Com o gh instalado, dá para gravar direto:"
	  echo "  gh variable set AWS_DEPLOY_ROLE_ARN --env production --body $$papel"
	  echo "  gh variable set S3_BUCKET --env production --body $$bucket"
	  echo "  gh variable set CLOUDFRONT_DISTRIBUTION_ID --env production --body $$dist"
	fi

# A confirmação vem antes de qualquer outro pré-requisito: sem ela, nada roda.
confirmar-destroy:
	@[ "$(CONFIRMAR)" = "derrubar-portal-mentor" ] || { echo "Para derrubar, rode: make destroy CONFIRMAR=derrubar-portal-mentor"; exit 1; }

destroy: confirmar-destroy quem-sou init ## Derruba a infra do portal. Exige CONFIRMAR=derrubar-portal-mentor
	@echo "O bucket precisa estar vazio (inclusive versões antigas) para ser apagado."
	$(TF) -chdir=$(TF_DIR) destroy $(TF_VARS)

limpar: ## Apaga plano salvo e caches locais do terraform
	rm -rf $(TF_DIR)/.terraform $(BOOTSTRAP_DIR)/.terraform $(TF_DIR)/$(PLANO)
