# ============================================================
# Deploy pelo GitHub Actions sem chave de acesso guardada.
# O workflow troca o token OIDC do GitHub por credenciais temporárias
# deste papel, que só sabe gravar NESTE bucket e invalidar NESTA
# distribuição. (O admin-hub usa AWS_ACCESS_KEY_ID/SECRET em secrets;
# aqui não há chave longa para vazar.)
# ============================================================

locals {
  oidc_url = "token.actions.githubusercontent.com"
}

# Um provedor OIDC por conta e por URL. Se a conta já tem (outro repo criou),
# deixe create_github_oidc_provider = false e ele é lido.
resource "aws_iam_openid_connect_provider" "github" {
  count          = var.create_github_oidc_provider ? 1 : 0
  url            = "https://${local.oidc_url}"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc_provider ? 0 : 1
  url   = "https://${local.oidc_url}"
}

locals {
  oidc_provider_arn = var.create_github_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn
}

data "aws_iam_policy_document" "confianca_deploy" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_url}:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Só jobs do environment de produção deste repositório. O environment
    # pode exigir aprovação e ficar restrito à branch main no GitHub.
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_url}:sub"
      values   = ["repo:${var.github_repository}:environment:${var.github_environment}"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name                 = "${var.bucket_name}-github-deploy"
  description          = "GitHub Actions publica o portal do mentor"
  assume_role_policy   = data.aws_iam_policy_document.confianca_deploy.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "ListarBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }
  statement {
    sid       = "GravarArquivos"
    actions   = ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }
  statement {
    sid       = "InvalidarCache"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "publicar-portal"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
