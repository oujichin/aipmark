#!/usr/bin/env python3
"""
個人情報管理台帳とリスク分析シートの整合性チェックスクリプト。
Managed Agent のサンドボックス内で実行される。

Usage:
    python validate_registry.py <台帳ファイルパス> <リスク分析ファイルパス>

出力: JSON形式の検証結果
"""

import json
import sys
import csv
from pathlib import Path


def read_xlsx_as_dicts(filepath: str) -> list[dict]:
    """xlsxファイルをdict配列として読む（openpyxlが使えない場合はcsv fallback）"""
    path = Path(filepath)

    if path.suffix == '.csv':
        with open(filepath, encoding='utf-8-sig') as f:
            return list(csv.DictReader(f))

    try:
        import openpyxl
        wb = openpyxl.load_workbook(filepath, read_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(h or '').strip() for h in rows[0]]
        return [dict(zip(headers, row)) for row in rows[1:]]
    except ImportError:
        print("Warning: openpyxl not available, trying csv fallback", file=sys.stderr)
        csv_path = path.with_suffix('.csv')
        if csv_path.exists():
            return read_xlsx_as_dicts(str(csv_path))
        return []


def validate(registry_path: str, risk_path: str) -> dict:
    """整合性チェックを実行"""
    errors = []
    warnings = []

    registry = read_xlsx_as_dicts(registry_path)
    risks = read_xlsx_as_dicts(risk_path)

    if not registry:
        errors.append({"type": "empty_registry", "message": "台帳が空です"})
        return {"valid": False, "errors": errors, "warnings": warnings}

    if not risks:
        errors.append({"type": "empty_risk", "message": "リスク分析シートが空です"})

    # 台帳の業務プロセス一覧
    registry_processes = set()
    for i, row in enumerate(registry, start=2):
        bp = str(row.get('業務プロセス', '') or '').strip()
        if bp:
            registry_processes.add(bp)

        # 利用目的が空白チェック
        purpose = str(row.get('利用目的', '') or '').strip()
        if not purpose:
            errors.append({
                "type": "missing_purpose",
                "row": i,
                "business_process": bp,
                "message": f"行{i}: 利用目的が空白です"
            })

        # 確信度チェック
        confidence = str(row.get('確信度', '') or '').strip()
        if confidence in ('unconfirmed', 'insufficient_evidence'):
            warnings.append({
                "type": "unconfirmed_field",
                "row": i,
                "business_process": bp,
                "confidence": confidence,
                "message": f"行{i} ({bp}): 確信度が {confidence} です"
            })

    # リスク分析の業務プロセス一覧
    risk_processes = set()
    for row in risks:
        bp = str(row.get('業務プロセス', '') or '').strip()
        if bp:
            risk_processes.add(bp)

    # 台帳にあるがリスク分析にない業務プロセス
    missing_in_risk = registry_processes - risk_processes
    for bp in sorted(missing_in_risk):
        errors.append({
            "type": "missing_risk_analysis",
            "business_process": bp,
            "message": f"業務プロセス「{bp}」のリスク分析がありません"
        })

    # リスク分析にあるが台帳にない業務プロセス
    extra_in_risk = risk_processes - registry_processes
    for bp in sorted(extra_in_risk):
        warnings.append({
            "type": "extra_risk_analysis",
            "business_process": bp,
            "message": f"業務プロセス「{bp}」はリスク分析にあるが台帳にありません"
        })

    return {
        "valid": len(errors) == 0,
        "registry_row_count": len(registry),
        "risk_row_count": len(risks),
        "registry_process_count": len(registry_processes),
        "risk_process_count": len(risk_processes),
        "errors": errors,
        "warnings": warnings,
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python validate_registry.py <registry.xlsx> <risk.xlsx>", file=sys.stderr)
        sys.exit(1)

    result = validate(sys.argv[1], sys.argv[2])
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result["valid"] else 1)
