# ============================================================
# Roda UMA vez, com estado local: cria o bucket do estado remoto.
# Depois disso, `iac/` usa esse bucket (backend.hcl).
# Se a conta já tiver um bucket de estado, pule este módulo e só
# aponte backend.hcl para ele.
# ============================================================
terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

variable "state_bucket_name" {
  type    = string
  default = "residente-elite-terraform-state"
}

provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = { Project = "terraform-state", ManagedBy = "terraform" }
  }
}

resource "aws_s3_bucket" "estado" {
  bucket = var.state_bucket_name
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "estado" {
  bucket = aws_s3_bucket.estado.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "estado" {
  bucket = aws_s3_bucket.estado.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "estado" {
  bucket                  = aws_s3_bucket.estado.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "so_tls" {
  bucket = aws_s3_bucket.estado.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "NegarSemTLS"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.estado.arn, "${aws_s3_bucket.estado.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.estado]
}

output "state_bucket" {
  value = aws_s3_bucket.estado.id
}
