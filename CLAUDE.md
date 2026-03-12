# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AIPmark5** is a Privacy Mark (P-Mark) Management System for Japanese organizations. The project is currently in the **requirements definition phase** — all existing files are Japanese-language Markdown documentation. No source code or build infrastructure exists yet.

The system's core design principle: *not a document generation tool, but an operational PMS platform that produces application documents, evidence trails, and change explanations as byproducts of operating the PMS itself.*

## Current Repository Contents

- `システム計画書.md` — System planning document (architecture, scope, design decisions)
- `データモデル.md` — Full data model (60+ entities across 4 layers)
- `機能要件.md` — Functional requirements (35 atomic functions, 10 workflows, 10 business modules)

## Architecture

### Data Model (4 Layers)

1. **Governance & Master Layer** — Organization, Site, Department, User, Role, PMSDocument, LegalRequirement, DataCategory, StorageResource, Vendor, CollectionChannel
2. **Business & Operation Layer** — BusinessProcess, PersonalDataRegister, RiskAssessment, ControlMeasure, ChangeRequest, IncidentCase, AuditPlan, TrainingPlan, ManagementReview
3. **Evidence & Record Layer** — EvidenceRecord (base), all specific evidence types (consent, training, audit, destruction, etc.), CollectionFormTemplate
4. **Report & Output Layer** — GovernanceDiagram, RegisterExportPackage, RiskReportPackage, AuditReport, ApplicationSubmissionPackage, EvidenceBundle

### Functional Architecture (3 Levels)

- **Level 1 — Atomic Functions (AF-001 to AF-072):** CRUD, AI assistance, approval workflows, traceability, notifications, document management, output generation, RBAC/audit logging
- **Level 2 — Business Workflows (WF-01 to WF-10):** Register, risk, change request, training, vendor evaluation, audit, corrective action, incident, management review, renewal application
- **Level 3 — Business Modules (M-01 to M-10):** Governance, Register, Risk, Document/Evidence, Training, Vendor, Audit/CA, Incident, Application/Renewal, AI Support Foundation

### User Roles & Segregation of Duties

Key constraint: the **audit responsibility officer and privacy officer must be different people**. Auditors cannot audit their own department. Top management approval is required for key decisions.

Roles: Global Admin, Privacy Officer, Audit Responsibility Officer, Auditors, Department Heads, On-site Data Entry Staff, Application Coordinator, Read-only Viewers, Vendor/Contractor Respondents.

## Development Notes

- The system requires multi-tenant support, RBAC, full audit logging, and Excel/Word/PDF output generation.
- AI integration is planned for candidate generation, summarization, and dialogue (Module M-10).
- Tech stack has not yet been decided — refer to `システム計画書.md` for constraints and considerations before proposing implementation.
