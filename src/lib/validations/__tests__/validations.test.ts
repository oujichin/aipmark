import { describe, it, expect } from "vitest";
import { parseBody } from "../index";
import { createVendorSchema, updateVendorSchema } from "../vendors";
import { createIncidentSchema, assessIncidentSchema, updateIncidentActionSchema } from "../incidents";
import { createRiskItemSchema } from "../risk";
import { createDocumentSchema } from "../documents";

describe("parseBody", () => {
  it("有効なデータでsuccessを返す", () => {
    const result = parseBody(createVendorSchema, { name: "テスト委託先" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("テスト委託先");
    }
  });

  it("無効なデータでerrorを返す", () => {
    const result = parseBody(createVendorSchema, { name: "" });
    expect(result.success).toBe(false);
  });

  it("余分なフィールドを除外する", () => {
    const result = parseBody(createVendorSchema, { name: "テスト", extraField: "不正" });
    expect(result.success).toBe(true);
  });
});

describe("createVendorSchema", () => {
  it("nameが空の場合エラー", () => {
    const result = createVendorSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("nameが500文字超の場合エラー", () => {
    const result = createVendorSchema.safeParse({ name: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("statusにenum外の値でエラー", () => {
    const result = createVendorSchema.safeParse({ name: "テスト", status: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("statusにACTIVEで成功", () => {
    const result = createVendorSchema.safeParse({ name: "テスト", status: "ACTIVE" });
    expect(result.success).toBe(true);
  });
});

describe("updateVendorSchema", () => {
  it("空オブジェクトで成功（全フィールドoptional）", () => {
    const result = updateVendorSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("statusにenum外の値でエラー", () => {
    const result = updateVendorSchema.safeParse({ status: "DELETED" });
    expect(result.success).toBe(false);
  });
});

describe("createIncidentSchema", () => {
  it("必須フィールドなしでエラー", () => {
    const result = createIncidentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("categoryにenum外の値でエラー", () => {
    const result = createIncidentSchema.safeParse({
      title: "テスト",
      description: "説明",
      category: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("categoryにLEAKAGEで成功", () => {
    const result = createIncidentSchema.safeParse({
      title: "テスト",
      description: "説明",
      category: "LEAKAGE",
    });
    expect(result.success).toBe(true);
  });
});

describe("assessIncidentSchema", () => {
  it("severityにenum外の値でエラー", () => {
    const result = assessIncidentSchema.safeParse({ severity: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("severityにCRITICALで成功", () => {
    const result = assessIncidentSchema.safeParse({ severity: "CRITICAL" });
    expect(result.success).toBe(true);
  });
});

describe("updateIncidentActionSchema", () => {
  it("statusにenum外の値でエラー", () => {
    const result = updateIncidentActionSchema.safeParse({ status: "DELETED" });
    expect(result.success).toBe(false);
  });

  it("statusにCOMPLETEDで成功", () => {
    const result = updateIncidentActionSchema.safeParse({ status: "COMPLETED" });
    expect(result.success).toBe(true);
  });
});

describe("createRiskItemSchema", () => {
  it("必須フィールド不足でエラー", () => {
    const result = createRiskItemSchema.safeParse({ lifecycleStage: "COLLECT" });
    expect(result.success).toBe(false);
  });
});

describe("createDocumentSchema", () => {
  it("titleとtypeが必須", () => {
    const result = createDocumentSchema.safeParse({ title: "テスト" });
    expect(result.success).toBe(false);
  });

  it("titleとtypeがあれば成功", () => {
    const result = createDocumentSchema.safeParse({ title: "テスト", type: "POLICY" });
    expect(result.success).toBe(true);
  });
});
