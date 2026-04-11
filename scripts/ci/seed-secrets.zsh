#!/usr/bin/env zsh
  set -euo pipefail

  echo "Seeding GitHub secrets for MLX-local agent workflows..."
  : "${MLX_GATEWAY_URL:?Set MLX_GATEWAY_URL in your shell}"
  : "${MLX_MODEL:=/Users/davidcaballero/core-x-kbllr_0/model-zoo/models/text/gpt-oss-20b-mxfp4-q8}"

  gh secret set MLX_GATEWAY_URL --body "$MLX_GATEWAY_URL"
  gh secret set MLX_MODEL --body "$MLX_MODEL"

  echo "Secrets staged."
