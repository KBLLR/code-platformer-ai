#!/usr/bin/env zsh
set -euo pipefail

echo "Seeding GitHub secrets for agent workflows..."
: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY in your shell}" 
: "${GEMINI_API_KEY:?Set GEMINI_API_KEY in your shell}" 
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY in your shell}" 

gh secret set ANTHROPIC_API_KEY --body "$ANTHROPIC_API_KEY"
gh secret set GEMINI_API_KEY --body "$GEMINI_API_KEY"
gh secret set OPENAI_API_KEY --body "$OPENAI_API_KEY"

echo "Secrets staged."
