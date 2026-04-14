import { prisma } from "./prisma";
import type { ReportFindingsInput, ReportRiskAssessmentInput } from "@/types/agent";

// ════════════════════════════════════════════════════════════════════
// Normalizer: エージェントのフラット出力 → 正規化エンティティ変換
// ════════════════════════════════════════════════════════════════════

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

/**
 * report_findings のフラット出力を正規化してDBに格納する
 */
export async function normalizeFindings(
  companyId: string,
  sessionId: string,
  input: ReportFindingsInput
) {
  const { business_process, personal_info_items } = input;

  // [1] BusinessProcess upsert
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

  const createdBpPiis: string[] = [];

  for (const item of personal_info_items) {
    // [2] PersonalInfoItem 名寄せ
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

    // DataSubject 名寄せ
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

    // StorageLocation 名寄せ
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

    // [3] BusinessProcessPII 作成
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
        // ステータスマッピング
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

    // ThirdParty 処理
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

    // [4] Evidence 作成
    if (item.evidence) {
      await prisma.evidence.create({
        data: {
          bpPiiId: bpPii.id,
          targetField: "purpose", // primary field
          sourceType: item.evidence.source_type,
          sourceRef: item.evidence.source_ref,
          detail: item.evidence.detail,
          capturedAt: item.evidence.captured_at ? new Date(item.evidence.captured_at) : new Date(),
          createdBy: "agent",
        },
      });
    }

    // [5] FieldChangeLog 初回登録
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

/**
 * report_risk_assessment を正規化してDBに格納する
 */
export async function normalizeRiskAssessment(
  companyId: string,
  input: ReportRiskAssessmentInput
) {
  const bp = await prisma.businessProcess.findFirst({
    where: { companyId, name: input.business_process_name },
  });
  if (!bp) {
    throw new Error(`BusinessProcess not found: ${input.business_process_name}`);
  }

  const bpPiis = await prisma.businessProcessPII.findMany({
    where: { businessProcessId: bp.id },
  });

  const createdRisks: string[] = [];

  for (const risk of input.risks) {
    // リスクは最初のbpPiiに紐づける（改善の余地あり）
    const targetBpPii = bpPiis[0];
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
