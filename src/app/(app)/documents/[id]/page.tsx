"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FieldRow } from "@/components/field-row";

interface DocumentData {
  document: {
    id: string;
    type: string;
    version: number;
    summary: string | null;
    confirmedCount: number;
    estimatedCount: number;
    unconfirmedCount: number;
    totalFields: number;
    approvedBy: string | null;
    company: { name: string };
  };
  fields: BpPiiField[];
}

interface BpPiiField {
  id: string;
  businessProcess: { name: string; department: string | null };
  personalInfoItem: { canonicalName: string; isSensitive: boolean };
  dataSubject: { name: string } | null;
  storageLocation: { name: string } | null;
  purpose: string | null;
  purposeStatus: string;
  acquisitionMethod: string | null;
  acquisitionMethodStatus: string;
  retentionPeriod: string | null;
  retentionPeriodStatus: string;
  disposalMethod: string | null;
  disposalMethodStatus: string;
  volumeEstimate: string | null;
  volumeEstimateStatus: string;
  storageStatus: string;
  thirdPartyStatus: string;
  accessSubjects: string | null;
  accessSubjectsStatus: string;
  thirdParties: { thirdParty: { name: string; role: string | null } }[];
  evidences: { id: string; targetField: string; sourceType: string; sourceRef: string; detail: string | null }[];
  riskAssessments: { id: string; threat: string; riskScore: number | null }[];
}

const DOC_TYPE_LABELS: Record<string, string> = {
  personal_info_registry: "個人情報管理台帳",
  risk_analysis: "リスク分析シート",
  business_process_list: "業務プロセス一覧",
};

export default function DocumentDetailPage() {
  const params = useParams();
  const docId = params.id as string;
  const [data, setData] = useState<DocumentData | null>(null);
  const [filter, setFilter] = useState<"all" | "unconfirmed" | "high_risk">("all");

  useEffect(() => {
    fetch(`/api/documents/${docId}`).then(r => r.json()).then(setData);
  }, [docId]);

  if (!data) {
    return (
      <div className="flex items-center justify-center mt-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const { document: doc, fields } = data;
  const total = doc.totalFields || fields.length;
  const completionRate = total > 0 ? Math.round(((doc.confirmedCount + doc.estimatedCount) / total) * 100) : 0;

  let filteredFields = fields;
  if (filter === "unconfirmed") {
    filteredFields = fields.filter(f =>
      f.purposeStatus === "unconfirmed" || f.purposeStatus === "insufficient_evidence" ||
      f.acquisitionMethodStatus === "unconfirmed" || f.retentionPeriodStatus === "unconfirmed"
    );
  } else if (filter === "high_risk") {
    filteredFields = fields.filter(f =>
      f.riskAssessments.some(r => (r.riskScore ?? 0) >= 6)
    );
  }

  // 業務プロセスごとにグループ化
  const grouped = new Map<string, BpPiiField[]>();
  for (const f of filteredFields) {
    const key = f.businessProcess.name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(f);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {DOC_TYPE_LABELS[doc.type] ?? doc.type} v{doc.version}
          {doc.approvedBy ? "" : "（ドラフト）"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          整備率: {completionRate}% | 確定: {doc.confirmedCount} | AI推定: {doc.estimatedCount} | 未確認: {doc.unconfirmedCount}
        </p>
      </div>

      {/* フィルタ */}
      <div className="flex gap-2">
        {(["all", "unconfirmed", "high_risk"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition ${
              filter === f
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {f === "all" ? "すべて" : f === "unconfirmed" ? "未確定のみ" : "高リスクのみ"}
          </button>
        ))}
      </div>

      {/* 業務プロセスごとのフィールド */}
      {Array.from(grouped.entries()).map(([bpName, bpFields]) => (
        <section key={bpName} className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">{bpName}</h2>
          <div className="space-y-3">
            {bpFields.map(field => (
              <FieldRow key={field.id} field={field} onUpdated={() => {
                fetch(`/api/documents/${docId}`).then(r => r.json()).then(setData);
              }} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
