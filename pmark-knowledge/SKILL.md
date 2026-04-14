---
name: pmark-knowledge
description: Provides JIS Q 15001 compliance requirements, audit checklists, and document templates for drafting personal information registries and risk analysis sheets. Use when working on Privacy Mark acquisition, personal data audits, or PMS document generation.
---

# P-Mark Knowledge

## Quick start

Read REQUIREMENTS.md for JIS Q 15001 mandatory items before starting any analysis.

## Reference files

**Requirements**: See [REQUIREMENTS.md](REQUIREMENTS.md) for JIS Q 15001 requirements and mandatory confirmation items
**Audit checklist**: See [AUDIT_CHECKLIST.md](AUDIT_CHECKLIST.md) for common audit findings
**Registry template**: See [TEMPLATES/registry_template.md](TEMPLATES/registry_template.md) for column definitions and formatting
**Risk template**: See [TEMPLATES/risk_template.md](TEMPLATES/risk_template.md) for risk analysis column definitions

## Validation

After drafting, run consistency check:

```bash
python scripts/validate_registry.py registry.xlsx risk_analysis.xlsx
```

Returns JSON with errors and warnings.
