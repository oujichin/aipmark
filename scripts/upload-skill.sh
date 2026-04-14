#!/bin/bash
# Custom Skill アップロード
# Usage: source .env && bash scripts/upload-skill.sh

set -e

SKILL_DIR="pmark-knowledge-skill"

curl -X POST "https://api.anthropic.com/v1/skills" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02" \
  -F "display_title=P-Mark Knowledge" \
  -F "files[]=@${SKILL_DIR}/SKILL.md;filename=${SKILL_DIR}/SKILL.md" \
  -F "files[]=@${SKILL_DIR}/REQUIREMENTS.md;filename=${SKILL_DIR}/REQUIREMENTS.md" \
  -F "files[]=@${SKILL_DIR}/AUDIT_CHECKLIST.md;filename=${SKILL_DIR}/AUDIT_CHECKLIST.md" \
  -F "files[]=@${SKILL_DIR}/TEMPLATES/registry_template.md;filename=${SKILL_DIR}/TEMPLATES/registry_template.md" \
  -F "files[]=@${SKILL_DIR}/TEMPLATES/risk_template.md;filename=${SKILL_DIR}/TEMPLATES/risk_template.md" \
  -F "files[]=@${SKILL_DIR}/scripts/validate_registry.py;filename=${SKILL_DIR}/scripts/validate_registry.py"
