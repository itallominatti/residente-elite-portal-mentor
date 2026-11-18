output "site_url" {
  description = "Endereço do portal."
  value       = "https://${var.domain_name}"
}

output "s3_bucket" {
  description = "Vai na variável S3_BUCKET do repositório no GitHub."
  value       = aws_s3_bucket.site.id
}

output "cloudfront_distribution_id" {
  description = "Vai na variável CLOUDFRONT_DISTRIBUTION_ID do repositório no GitHub."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.site.domain_name
}

output "deploy_role_arn" {
  description = "Vai na variável AWS_DEPLOY_ROLE_ARN do repositório no GitHub."
  value       = aws_iam_role.deploy.arn
}
