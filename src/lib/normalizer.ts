import { prisma } from "./prisma";
import type {
  ReportFindingsInput,
  ReportRiskAssessmentInput,
  ReportCompanyProfileInput,
  ReportDetailedFindingsInput,
  ExportRegistryInput,
} from "@/types/agent";

// ════════════════════════════════════════════════════════════════════
// Normalizer: エージェントのフラット出力 → 正規化エンティティ変換 (v1.2)
// ════════════════════════════════════════════════════════════════════

/**
 * エージェントがフィールドをJSON文字列として送ってくる場合があるため、
 * オブジェクト/配列が期待されるフィールドを再帰的にパースする
 */
function deepParseStringifiedJson<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        return deepParseStringifiedJson(JSON.parse(trimmed));
      } catch {
        return input;
      }
    }
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(deepParseStringifiedJson) as T;
  }
  if (typeof input === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      result[key] = deepParseStringifiedJson(value);
    }
    return result as T;
  }
  return input;
}

// 名寄せ用マップ (canonical → aliases)
const PII_ALIASES: Record<string, string[]> = {
  "メールアドレス": ["Eメール", "email", "メアド", "e-mail", "Email"],
  "氏名": ["名前", "フルネーム", "full name", "名称"],
  "電話番号": ["TEL", "tel", "Phone", "携帯番号"],
  "住所": ["所在地", "address", "居所"],
  "生年月日": ["誕生日", "DOB", "birthday"],
};

function findCanonicalName(rawName: string): string {
  const normalized = rawName.trim();
  for (const [canonical, aliases] of Object.entries(PII_ALIASES)) {
    if (canonical === normalized || aliases.some(a => a.toLowerCase() === normalized.toLowerCase())) {
      return canonical;
    }
  }
  return normalized;
}

const RISK_SCORE_MAP: Record<string, number> = {
  "high_high": 9, "high_medium": 6, "high_low": 3,
  "medium_high": 6, "medium_medium": 4, "medium_low": 2,
  "low_high": 3, "low_medium": 2, "low_low": 1,
};

function computeRiskScore(likelihood: string, impact: string): number {
  return RISK_SCORE_MAP[`${likelihood}_${impact}`] ?? 1;
}

// ════════════════════════════════════════════════════════════════════
// Phase 0: report_company_profile
// ════════════════════════════════════════════════════════════════════

export async function normalizeCompanyProfile(
  companyId: string,
  rawInput: ReportCompanyProfileInput
) {
  const input = deepParseStringifiedJson(rawInput);
  const hasEvidence = Boolean(input.evidence);
  const companyData: Record<string, unknown> = {};
  if (input.company_name) companyData.name = input.company_name;
  if (input.employees?.total != null) companyData.employeeCount = input.employees.total.toString();
  if (Object.keys(companyData).length > 0) {
    await prisma.company.update({
      where: { id: companyId },
      data: companyData,
    });
  }

  const profileData = buildCompanyProfileData(input, hasEvidence);

  const profile = await prisma.companyProfile.upsert({
    where: { companyId },
    create: {
      companyId,
      ...profileData,
    },
    update: profileData,
  });

  return { profileId: profile.id };
}

function buildCompanyProfileData(input: ReportCompanyProfileInput, hasEvidence: boolean) {
  const data: Record<string, unknown> = {};
  const status = hasEvidence ? "confirmed" : "estimated";

  if (input.representative) {
    data.representative = input.representative;
    data.representativeStatus = status;
  }
  if (input.address) {
    data.address = input.address;
    data.addressStatus = status;
  }
  if (input.established) {
    data.established = input.established;
    data.establishedStatus = status;
  }
  if (input.business_description) {
    data.businessDescription = input.business_description;
    data.businessDescriptionStatus = status;
  }
  if (input.employees?.total != null) {
    data.employeesTotal = input.employees.total;
    data.employeesStatus = status;
  }
  if (input.employees?.full_time != null) data.employeesFullTime = input.employees.full_time;
  if (input.employees?.contract != null) data.employeesContract = input.employees.contract;
  if (input.employees?.part_time != null) data.employeesPartTime = input.employees.part_time;
  if (input.employees?.temporary != null) data.employeesTemporary = input.employees.temporary;
  if (input.locations) {
    data.locations = JSON.stringify(input.locations);
    data.locationsStatus = input.locations.length > 0 ? status : "unconfirmed";
  }
  if (input.group_companies) data.groupCompanies = JSON.stringify(input.group_companies);
  if (input.main_services) data.mainServices = JSON.stringify(input.main_services);
  return data;
}

async function syncCompanyProfileFromBasicInfoProcess(
  companyId: string,
  businessProcess: ReportFindingsInput["business_process"]
) {
  const source = `${businessProcess.name}\n${businessProcess.description ?? ""}`;
  if (!/会社基本情報|様式1|社名[:：]|代表者[:：]|所在地[:：]/.test(source)) return;

  const representative = extractLineValue(source, "代表者");
  const address = extractLineValue(source, "所在地");
  const established = extractLineValue(source, "設立") ?? extractLineValue(source, "創業");
  const businessDescription = extractLineValue(source, "事業内容");
  const mainServices = businessDescription
    ? businessDescription.split(/・|、|,/).map(v => v.trim()).filter(Boolean).slice(0, 20)
    : undefined;

  const data: Record<string, unknown> = {};
  if (representative) {
    data.representative = representative;
    data.representativeStatus = "confirmed";
  }
  if (address) {
    data.address = address;
    data.addressStatus = "confirmed";
    data.locations = JSON.stringify([{ name: "本社", address }]);
    data.locationsStatus = "estimated";
  }
  if (established) {
    data.established = established;
    data.establishedStatus = "confirmed";
  }
  if (businessDescription) {
    data.businessDescription = businessDescription;
    data.businessDescriptionStatus = "confirmed";
  }
  if (mainServices) data.mainServices = JSON.stringify(mainServices);
  if (Object.keys(data).length === 0) return;

  await prisma.companyProfile.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });
}

function extractLineValue(source: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(?:^|\\n)${escaped}\\s*[:：]\\s*([^\\n]+)`));
  return match?.[1]?.trim() || undefined;
}

// ════════════════════════════════════════════════════════════════════
// Phase 1: report_findings (v1.2: 1業務ずつ即時報告)
// ════════════════════════════════════════════════════════════════════

export async function normalizeFindings(
  companyId: string,
  sessionId: string,
  rawInput: ReportFindingsInput
) {
  const input = deepParseStringifiedJson(rawInput);
  const { business_process } = input;
  const personal_info_items = input.personal_info_items ?? [];

  if (!business_process?.name) {
    throw new Error(
      `business_process.name is required but got: ${JSON.stringify(business_process).slice(0, 200)}. ` +
      `Please send business_process as an object with name, department, description fields.`
    );
  }

  const bp = await prisma.businessProcess.upsert({
    where: {
      companyId_name: { companyId, name: business_process.name },
    },
    create: {
      companyId,
      name: business_process.name,
      department: business_process.department,
      description: business_process.description,
      createdBySession: sessionId,
    },
    update: {
      department: business_process.department,
      description: business_process.description,
    },
  });

  await syncCompanyProfileFromBasicInfoProcess(companyId, business_process);

  const createdBpPiis: string[] = [];

  for (const item of personal_info_items) {
    const canonicalName = findCanonicalName(item.data_category);
    const pii = await prisma.personalInfoItem.upsert({
      where: {
        companyId_canonicalName: { companyId, canonicalName },
      },
      create: {
        companyId,
        canonicalName,
        isSensitive: isSensitiveData(canonicalName),
      },
      update: {},
    });

    let dataSubjectId: string | undefined;
    if (item.data_subjects) {
      const ds = await prisma.dataSubject.upsert({
        where: {
          companyId_name: { companyId, name: item.data_subjects },
        },
        create: { companyId, name: item.data_subjects },
        update: {},
      });
      dataSubjectId = ds.id;
    }

    let storageLocationId: string | undefined;
    if (item.storage_location) {
      const sl = await prisma.storageLocation.upsert({
        where: {
          companyId_name: { companyId, name: item.storage_location },
        },
        create: { companyId, name: item.storage_location },
        update: {},
      });
      storageLocationId = sl.id;
    }

    const bpPii = await prisma.businessProcessPII.create({
      data: {
        businessProcessId: bp.id,
        personalInfoItemId: pii.id,
        dataSubjectId,
        storageLocationId,
        purpose: item.purpose,
        acquisitionMethod: item.acquisition_method,
        accessSubjects: item.access_subjects ? JSON.stringify([item.access_subjects]) : undefined,
        retentionPeriod: item.retention_period,
        disposalMethod: item.disposal_method,
        volumeEstimate: item.volume_estimate,
        purposeStatus: item.confidence,
        acquisitionMethodStatus: item.acquisition_method ? item.confidence : "unconfirmed",
        storageStatus: item.storage_location ? item.confidence : "unconfirmed",
        retentionPeriodStatus: item.retention_period ? item.confidence : "unconfirmed",
        disposalMethodStatus: item.disposal_method ? item.confidence : "unconfirmed",
        volumeEstimateStatus: item.volume_estimate ? item.confidence : "unconfirmed",
        thirdPartyStatus: item.third_party_sharing ? item.confidence : "unconfirmed",
        accessSubjectsStatus: item.access_subjects ? item.confidence : "unconfirmed",
      },
    });

    if (item.third_party_sharing && item.third_party_sharing !== "なし") {
      const tp = await prisma.thirdParty.upsert({
        where: {
          companyId_name: { companyId, name: item.third_party_sharing },
        },
        create: { companyId, name: item.third_party_sharing },
        update: {},
      });
      await prisma.bpPiiThirdParty.create({
        data: { bpPiiId: bpPii.id, thirdPartyId: tp.id },
      });
    }

    if (item.evidence) {
      await prisma.evidence.create({
        data: {
          bpPiiId: bpPii.id,
          targetField: "purpose",
          sourceType: item.evidence.source_type,
          sourceRef: item.evidence.source_ref,
          detail: item.evidence.detail,
          capturedAt: item.evidence.captured_at ? new Date(item.evidence.captured_at) : new Date(),
          createdBy: "agent",
        },
      });
    }

    await prisma.fieldChangeLog.create({
      data: {
        bpPiiId: bpPii.id,
        fieldName: "initial_discovery",
        newValue: JSON.stringify({
          purpose: item.purpose,
          data_category: item.data_category,
          data_subjects: item.data_subjects,
        }),
        newStatus: item.confidence,
        changedBy: "agent",
        trigger: "discovery",
      },
    });

    createdBpPiis.push(bpPii.id);
  }

  return { businessProcessId: bp.id, bpPiiIds: createdBpPiis };
}

// ════════════════════════════════════════════════════════════════════
// Phase 2: report_detailed_findings (v1.2 新規)
// ════════════════════════════════════════════════════════════════════

export async function normalizeDetailedFindings(
  companyId: string,
  rawInput: ReportDetailedFindingsInput
) {
  const input = deepParseStringifiedJson(rawInput);
  const bp = await prisma.businessProcess.findFirst({
    where: { companyId, name: input.business_process_name },
  });
  if (!bp) {
    throw new Error(`BusinessProcess not found: ${input.business_process_name}`);
  }

  const updatedBpPiis: string[] = [];

  for (const detail of input.personal_info_details) {
    // info_name で既存のBpPIIを探す、なければ新規作成
    const canonicalName = findCanonicalName(detail.info_name);
    const pii = await prisma.personalInfoItem.upsert({
      where: {
        companyId_canonicalName: { companyId, canonicalName },
      },
      create: {
        companyId,
        canonicalName,
        isSensitive: isSensitiveData(canonicalName),
      },
      update: {},
    });

    // 既存のBpPIIを探す
    let bpPii = await prisma.businessProcessPII.findFirst({
      where: {
        businessProcessId: bp.id,
        personalInfoItemId: pii.id,
      },
    });

    let storageLocationId: string | undefined;
    if (detail.storage_location) {
      const sl = await prisma.storageLocation.upsert({
        where: {
          companyId_name: { companyId, name: detail.storage_location },
        },
        create: { companyId, name: detail.storage_location },
        update: {},
      });
      storageLocationId = sl.id;
    }

    const detailData = {
      category: detail.category,
      infoName: detail.info_name,
      classification: detail.classification,
      mediaType: detail.media_type,
      storageMethod: detail.storage_method,
      usagePeriod: detail.usage_period,
      disclosureTarget: detail.disclosure_target,
      manager: detail.manager,
      accessiblePersons: detail.accessible_persons,
      remarks: detail.remarks,
      purpose: detail.purpose,
      acquisitionMethod: detail.acquisition_method,
      retentionPeriod: detail.retention_period,
      disposalMethod: detail.disposal_method,
      volumeEstimate: detail.volume,
      storageLocationId,
      // ステータス更新
      categoryStatus: detail.category ? detail.confidence : "unconfirmed",
      infoNameStatus: detail.info_name ? detail.confidence : "unconfirmed",
      classificationStatus: detail.classification ? detail.confidence : "unconfirmed",
      mediaTypeStatus: detail.media_type ? detail.confidence : "unconfirmed",
      storageMethodStatus: detail.storage_method ? detail.confidence : "unconfirmed",
      usagePeriodStatus: detail.usage_period ? detail.confidence : "unconfirmed",
      disclosureTargetStatus: detail.disclosure_target !== undefined ? detail.confidence : "unconfirmed",
      managerStatus: detail.manager ? detail.confidence : "unconfirmed",
      accessiblePersonsStatus: detail.accessible_persons ? detail.confidence : "unconfirmed",
      purposeStatus: detail.purpose ? detail.confidence : "unconfirmed",
      acquisitionMethodStatus: detail.acquisition_method ? detail.confidence : "unconfirmed",
      retentionPeriodStatus: detail.retention_period ? detail.confidence : "unconfirmed",
      disposalMethodStatus: detail.disposal_method ? detail.confidence : "unconfirmed",
      storageStatus: detail.storage_location ? detail.confidence : "unconfirmed",
    };

    if (bpPii) {
      await prisma.businessProcessPII.update({
        where: { id: bpPii.id },
        data: detailData,
      });
    } else {
      bpPii = await prisma.businessProcessPII.create({
        data: {
          businessProcessId: bp.id,
          personalInfoItemId: pii.id,
          ...detailData,
        },
      });
    }

    // 委託先・第三者提供
    if (detail.outsourcing && detail.outsourcing !== "なし") {
      const tp = await prisma.thirdParty.upsert({
        where: { companyId_name: { companyId, name: detail.outsourcing } },
        create: { companyId, name: detail.outsourcing, role: "subcontractor" },
        update: { role: "subcontractor" },
      });
      await prisma.bpPiiThirdParty.upsert({
        where: { bpPiiId_thirdPartyId: { bpPiiId: bpPii.id, thirdPartyId: tp.id } },
        create: { bpPiiId: bpPii.id, thirdPartyId: tp.id },
        update: {},
      });
    }

    if (detail.third_party_provision && detail.third_party_provision !== "なし") {
      const tp = await prisma.thirdParty.upsert({
        where: { companyId_name: { companyId, name: detail.third_party_provision } },
        create: { companyId, name: detail.third_party_provision, role: "third_party" },
        update: { role: "third_party" },
      });
      await prisma.bpPiiThirdParty.upsert({
        where: { bpPiiId_thirdPartyId: { bpPiiId: bpPii.id, thirdPartyId: tp.id } },
        create: { bpPiiId: bpPii.id, thirdPartyId: tp.id },
        update: {},
      });
    }

    // Evidence
    if (detail.evidence) {
      await prisma.evidence.create({
        data: {
          bpPiiId: bpPii.id,
          targetField: "detailed_findings",
          sourceType: detail.evidence.source_type,
          sourceRef: detail.evidence.source_ref,
          detail: detail.evidence.detail,
          capturedAt: detail.evidence.captured_at ? new Date(detail.evidence.captured_at) : new Date(),
          createdBy: "agent",
        },
      });
    }

    // 変更ログ
    await prisma.fieldChangeLog.create({
      data: {
        bpPiiId: bpPii.id,
        fieldName: "detailed_findings",
        newValue: JSON.stringify(detail),
        newStatus: detail.confidence,
        changedBy: "agent",
        trigger: "discovery",
      },
    });

    updatedBpPiis.push(bpPii.id);
  }

  return { businessProcessId: bp.id, bpPiiIds: updatedBpPiis };
}

// ════════════════════════════════════════════════════════════════════
// Phase 4: export_registry (v1.2 新規 — generate_document_draft を置換)
// ════════════════════════════════════════════════════════════════════

export async function saveExportRegistry(
  companyId: string,
  input: ExportRegistryInput
) {
  const doc = await prisma.document.create({
    data: {
      companyId,
      type: input.document_type,
      filePath: input.file_path,
      fileFormat: "xlsx",
    },
  });
  return { documentId: doc.id };
}

// ════════════════════════════════════════════════════════════════════
// report_risk_assessment (変更なし)
// ════════════════════════════════════════════════════════════════════

export async function normalizeRiskAssessment(
  companyId: string,
  rawInput: ReportRiskAssessmentInput
) {
  const input = deepParseStringifiedJson(rawInput);
  const bp = await prisma.businessProcess.findFirst({
    where: { companyId, name: input.business_process_name },
  });
  if (!bp) {
    throw new Error(`BusinessProcess not found: ${input.business_process_name}`);
  }

  const bpPiis = await prisma.businessProcessPII.findMany({
    where: { businessProcessId: bp.id },
    include: { personalInfoItem: true },
  });

  const createdRisks: string[] = [];

  for (const risk of input.risks) {
    const targetName = risk.target_info_name?.trim();
    const targetBpPii = targetName
      ? bpPiis.find(p =>
          p.infoName === targetName ||
          p.personalInfoItem.canonicalName === targetName ||
          p.infoName?.includes(targetName) ||
          targetName.includes(p.personalInfoItem.canonicalName)
        ) ?? bpPiis[0]
      : bpPiis[0];
    if (!targetBpPii) continue;

    const ra = await prisma.riskAssessment.create({
      data: {
        bpPiiId: targetBpPii.id,
        threat: risk.threat,
        vulnerability: risk.vulnerability,
        likelihood: risk.likelihood,
        impact: risk.impact,
        riskScore: computeRiskScore(risk.likelihood, risk.impact),
        currentMeasures: risk.current_measures,
        recommendedMeasures: risk.recommended_measures,
        confidence: risk.confidence,
      },
    });

    if (risk.evidence) {
      await prisma.evidence.create({
        data: {
          riskId: ra.id,
          targetField: "risk",
          sourceType: risk.evidence.source_type,
          sourceRef: risk.evidence.source_ref,
          detail: risk.evidence.detail,
          createdBy: "agent",
        },
      });
    }

    createdRisks.push(ra.id);
  }

  return { businessProcessId: bp.id, riskIds: createdRisks };
}

// 要配慮個人情報の判定
function isSensitiveData(name: string): boolean {
  const sensitiveKeywords = [
    "病歴", "健康診断", "障害", "犯罪", "前科", "信条", "宗教",
    "人種", "民族", "社会的身分", "本籍", "労働組合", "性生活",
    "マイナンバー", "個人番号",
  ];
  return sensitiveKeywords.some(k => name.includes(k));
}
