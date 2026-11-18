terraform {
  # 1.10+ por causa do lock nativo do backend S3 (`use_lockfile`), sem DynamoDB.
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.73"
    }
  }

  # Configuração parcial: bucket e chave vêm de `backend.hcl` (veja backend.hcl.example),
  # criado uma vez pelo módulo `bootstrap/`. Estado fora do repositório, versionado e travado.
  backend "s3" {}
}
