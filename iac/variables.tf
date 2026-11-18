variable "aws_region" {
  description = "Região da AWS. Mantenha us-east-1 (ACM do CloudFront exige)."
  type        = string
  default     = "us-east-1"

  validation {
    condition     = var.aws_region == "us-east-1"
    error_message = "O certificado de um CloudFront tem de ficar em us-east-1."
  }
}

variable "hosted_zone_name" {
  description = "Zona do Route 53 que já existe (a mesma do admin-hub)."
  type        = string
  default     = "residente-elite.com"
}

variable "domain_name" {
  description = "Endereço público do portal."
  type        = string
  default     = "mentor.residente-elite.com"
}

variable "bucket_name" {
  description = "Bucket privado com os arquivos do build. Só o CloudFront lê (OAC)."
  type        = string
  default     = "residente-elite-portal-mentor"
}

variable "api_origin" {
  description = "Origem da API Django, liberada no connect-src da CSP."
  type        = string
  default     = "https://api.residente-elite.com"
}

variable "price_class" {
  description = "Classe de preço do CloudFront. Os pontos de presença da América do Sul (Brasil) só entram em PriceClass_All."
  type        = string
  default     = "PriceClass_All"

  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.price_class)
    error_message = "Use PriceClass_100, PriceClass_200 ou PriceClass_All."
  }
}

variable "github_repository" {
  description = "Repositório que pode publicar o site, no formato dono/nome."
  type        = string
  default     = "itallominatti/residente-elite-portal-mentor"
}

variable "github_environment" {
  description = "Environment do GitHub Actions autorizado a assumir o papel de deploy."
  type        = string
  default     = "production"
}

variable "create_github_oidc_provider" {
  description = "Crie o provedor OIDC do GitHub só se a conta ainda não tiver um (é um por conta)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags extras."
  type        = map(string)
  default     = {}
}
