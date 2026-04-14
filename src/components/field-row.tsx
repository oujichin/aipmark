"use client";

import { useState } from "react";
import { StatusBadge } from "./status-badge";

interface Evidence {
  id: string;
  targetField: string;
  sourceType: string;
  sourceRef: string;
  detail: string | null;
}

interface FieldData {
  id: string;
  personalInfoItem: { canonicalName: string; isSensitive: boolean };
  dataSubject: { name: string } | null;
  purpose: string | null;
  purposeStatus: string;
  acquisitionMethod: string | null;
  acquisitionMethodStatus: string;
  retentionPeriod: string | null;
  retentionPeriodStatus: string;
  disposalMethod: string | null;
  disposalMethodStatus: string;
  storageLocation: { name: string } | null;
  storageStatus: string;
  thirdParties: { thirdParty: { name: string } }[];
  thirdPartyStatus: string;
  evidences: Evidence[];
}

interface Props {
  field: FieldData;
  onUpdated: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: "確定",
  estimated: "AI推定",
  unconfirmed: "未確認",
  insufficient_evidence: "根拠不足",
};

interface FieldEntry {
  label: string;
  value: string | null;
  status: string;
  fieldName: string;
}

export function FieldRow({ field, onUpdated }: Props) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const entries: FieldEntry[] = [
    { label: "データ", value: field.personalInfoItem.canonicalName, status: "confirmed", fieldName: "data_category" },
    { label: "データ主体", value: field.dataSubject?.name ?? null, status: "confirmed", fieldName: "data_subjects" },
    { label: "利用目的", value: field.purpose, status: field.purposeStatus, fieldName: "purpose" },
    { label: "取得方法", value: field.acquisitionMethod, status: field.acquisitionMethodStatus, fieldName: "acquisitionMethod" },
    { label: "保管場所", value: field.storageLocation?.name ?? null, status: field.storageStatus, fieldName: "storage" },
    { label: "保管期間", value: field.retentionPeriod, status: field.retentionPeriodStatus, fieldName: "retentionPeriod" },
    { label: "廃棄方法", value: field.disposalMethod, status: field.disposalMethodStatus, fieldName: "disposalMethod" },
    { label: "第三者提供", value: field.thirdParties.map(t => t.thirdParty.name).join(", ") || "なし", status: field.thirdPartyStatus, fieldName: "thirdParty" },
  ];

  async function handleConfirm(fieldName: string) {
    await fetch(`/api/fields/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldName, status: "confirmed", changedBy: "human" }),
    });
    onUpdated();
  }

  async function handleEdit(fieldName: string) {
    if (!editValue) return;
    await fetch(`/api/fields/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldName, value: editValue, status: "confirmed", changedBy: "human" }),
    });
    setEditingField(null);
    setEditValue("");
    onUpdated();
  }

  const relatedEvidences = (fieldName: string) =>
    field.evidences.filter(e => e.targetField === fieldName);

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      {field.personalInfoItem.isSensitive && (
        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">要配慮個人情報</span>
      )}
      {entries.map(entry => (
        <div key={entry.fieldName} className="flex items-start gap-2 text-sm">
          <span className="text-gray-500 w-20 flex-shrink-0">{entry.label}:</span>
          <span className="text-gray-900 flex-1">
            {editingField === entry.fieldName ? (
              <span className="flex gap-1">
                <input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="flex-1 px-2 py-0.5 border border-gray-300 rounded text-sm"
                  autoFocus
                />
                <button onClick={() => handleEdit(entry.fieldName)} className="text-blue-600 text-xs">保存</button>
                <button onClick={() => setEditingField(null)} className="text-gray-400 text-xs">取消</button>
              </span>
            ) : (
              entry.value ?? <span className="text-gray-300">-</span>
            )}
          </span>
          <StatusBadge status={entry.status} label={STATUS_LABELS[entry.status]} />

          {entry.status === "estimated" && (
            <div className="flex gap-1">
              <button
                onClick={() => handleConfirm(entry.fieldName)}
                className="text-xs text-green-600 hover:underline"
              >
                確定
              </button>
              <button
                onClick={() => { setEditingField(entry.fieldName); setEditValue(entry.value ?? ""); }}
                className="text-xs text-blue-600 hover:underline"
              >
                修正
              </button>
            </div>
          )}

          {entry.status === "unconfirmed" && (
            <button
              onClick={() => { setEditingField(entry.fieldName); setEditValue(""); }}
              className="text-xs text-blue-600 hover:underline"
            >
              入力
            </button>
          )}
        </div>
      ))}

      {/* 根拠表示 */}
      {field.evidences.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-1">根拠:</p>
          {field.evidences.map(ev => (
            <p key={ev.id} className="text-xs text-gray-600">
              [{ev.sourceType}] {ev.sourceRef}
              {ev.detail && ` — ${ev.detail}`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
