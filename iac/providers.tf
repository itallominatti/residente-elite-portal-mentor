# Tudo em us-east-1: o certificado de um CloudFront precisa estar nessa região,
# e é a mesma região do admin-hub.
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge({
      Project   = "residente-elite-portal-mentor"
      ManagedBy = "terraform"
    }, var.tags)
  }
}
