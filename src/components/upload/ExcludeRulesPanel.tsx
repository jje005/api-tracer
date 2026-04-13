// 제외 규칙 관리 패널 — 업로드 페이지 사이드바에 표시
// 클래스 전체 제외 / 특정 메서드 제외 (파라미터 매칭 옵션)
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, RefreshCw, Shield, Code2, Info, Download, Upload as UploadIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { useExcludeRulesStore } from "@/lib/stores/excludeRulesStore";

// ─── 타입 ──────────────────────────────────────────────────────
interface ExcludeRule {
  id: string;
  type: "CLASS" | "METHOD";
  className: string;
  methodName: string | null;
  matchParams: boolean;
  params: string[];
  note: string | null;
}

interface ExcludeRulesPanelProps {
  projectId: string;
}

// ─── 규칙 추가 폼 상태 ────────────────────────────────────────
interface AddFormState {
  type: "CLASS" | "METHOD";
  className: string;
  methodName: string;
  matchParams: boolean;
  paramsRaw: string;  // 쉼표 구분 입력 → string[] 변환
  note: string;
}

const INITIAL_FORM: AddFormState = {
  type: "CLASS",
  className: "",
  methodName: "",
  matchParams: false,
  paramsRaw: "",
  note: "",
};

export function ExcludeRulesPanel({ projectId }: ExcludeRulesPanelProps) {
  const [rules, setRules] = useState<ExcludeRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<AddFormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // 외부에서 규칙이 추가/삭제될 때 자동 동기화 (ApiExplorer의 ExcludePopup 등)
  // Zustand 스토어의 version이 변경되면 이 컴포넌트가 re-fetch 수행
  const rulesVersion = useExcludeRulesStore((s) => s.getVersion(projectId));
  const notifyChanged = useExcludeRulesStore((s) => s.notifyChanged);

  // 규칙 목록 로드
  const loadRules = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/exclude-rules`);
      const data = await res.json();
      setRules(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[ExcludeRulesPanel] 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // projectId 또는 외부 변경(rulesVersion) 시 재요청
  // rulesVersion: ApiExplorer에서 규칙 추가/삭제 → 스토어 카운터 증가 → 여기서 재요청
  useEffect(() => { loadRules(); }, [loadRules, rulesVersion]);

  // 규칙 추가
  const handleAdd = async () => {
    if (!form.className.trim()) return;
    if (form.type === "METHOD" && !form.methodName.trim()) return;

    setSaving(true);
    try {
      // 쉼표로 구분된 파라미터 파싱 — trim 후 빈 항목 제거
      const params = form.matchParams
        ? form.paramsRaw.split(",").map((p) => p.trim()).filter(Boolean)
        : [];

      const res = await fetch(`/api/projects/${projectId}/exclude-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          className: form.className.trim(),
          methodName: form.type === "METHOD" ? form.methodName.trim() : undefined,
          matchParams: form.matchParams,
          params,
          note: form.note.trim() || undefined,
        }),
      });

      if (res.ok) {
        setForm(INITIAL_FORM);
        setShowAddForm(false);
        notifyChanged(projectId);
        await loadRules();
      }
    } catch (e) {
      console.error("[ExcludeRulesPanel] 추가 실패:", e);
    } finally {
      setSaving(false);
    }
  };

  // 규칙 삭제
  const handleDelete = async (ruleId: string) => {
    setDeletingId(ruleId);
    try {
      await fetch(`/api/projects/${projectId}/exclude-rules/${ruleId}`, {
        method: "DELETE",
      });
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      // 다른 컴포넌트(ApiExplorer 등)에도 변경 알림
      notifyChanged(projectId);
    } catch (e) {
      console.error("[ExcludeRulesPanel] 삭제 실패:", e);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Excel Export ──────────────────────────────────────────────
  // 현재 규칙 목록을 xlsx 파일로 다운로드
  // XLSX.utils.json_to_sheet: Java의 POI WorkbookFactory와 유사한 역할
  const handleExport = () => {
    if (rules.length === 0) return;

    const rows = rules.map((r) => ({
      타입: r.type,
      클래스명: r.className,
      메서드명: r.methodName ?? "",
      파라미터매칭: r.matchParams ? "Y" : "N",
      파라미터: r.params.join(", "),
      메모: r.note ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    // 컬럼 너비 설정
    ws["!cols"] = [{ wch: 8 }, { wch: 45 }, { wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 20 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "제외규칙");
    XLSX.writeFile(wb, `exclude-rules-${projectId.slice(-6)}.xlsx`);
    console.log(`[ExcludeRulesPanel] Excel 내보내기 완료: ${rules.length}개 규칙`);
  };

  // ── Excel Import ──────────────────────────────────────────────
  // xlsx 파일에서 규칙을 읽어 일괄 추가
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // 같은 파일 재선택 허용

    setImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      // 헤더 행을 키로 사용하여 JSON 변환
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      let added = 0;
      for (const row of rows) {
        const type = (row["타입"] ?? row["type"] ?? "CLASS").toUpperCase() as "CLASS" | "METHOD";
        const className = (row["클래스명"] ?? row["className"] ?? "").trim();
        const methodName = (row["메서드명"] ?? row["methodName"] ?? "").trim() || undefined;
        const matchParams = (row["파라미터매칭"] ?? row["matchParams"] ?? "N").toUpperCase() === "Y";
        const paramsRaw = row["파라미터"] ?? row["params"] ?? "";
        const params = matchParams ? paramsRaw.split(",").map((p: string) => p.trim()).filter(Boolean) : [];
        const note = (row["메모"] ?? row["note"] ?? "").trim() || undefined;

        if (!className) continue;

        const res = await fetch(`/api/projects/${projectId}/exclude-rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, className, methodName, matchParams, params, note }),
        });
        if (res.ok) added++;
      }

      console.log(`[ExcludeRulesPanel] Excel 가져오기: ${added}/${rows.length}개 추가`);
      await loadRules();
    } catch (err) {
      console.error("[ExcludeRulesPanel] Excel 가져오기 실패:", err);
      alert("Excel 파일을 읽는 중 오류가 발생했습니다");
    } finally {
      setImporting(false);
    }
  };

  // 규칙 표시 레이블 생성
  const getRuleLabel = (rule: ExcludeRule): string => {
    // 와일드카드 패턴 표시
    const cls = rule.className;
    if (rule.type === "CLASS") return cls;
    if (rule.methodName) {
      let label = `${cls}.${rule.methodName}()`;
      if (rule.matchParams && rule.params.length > 0) {
        label = `${cls}.${rule.methodName}(${rule.params.join(", ")})`;
      }
      return label;
    }
    return cls;
  };

  const classRules = rules.filter((r) => r.type === "CLASS");
  const methodRules = rules.filter((r) => r.type === "METHOD");

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield size={13} className="text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">제외 규칙</span>
          {rules.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {rules.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Excel Import */}
          <input ref={importInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Excel에서 가져오기"
          >
            {importing ? <RefreshCw size={11} className="animate-spin" /> : <UploadIcon size={11} />}
          </button>
          {/* Excel Export */}
          <button
            onClick={handleExport}
            disabled={rules.length === 0}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            title="Excel로 내보내기"
          >
            <Download size={11} />
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus size={11} />
            추가
          </button>
        </div>
      </div>

      {/* 규칙 추가 폼 */}
      {showAddForm && (
        <div className="rounded-md border p-3 space-y-2.5 bg-muted/30">
          {/* 타입 선택 */}
          <div className="flex gap-2">
            {(["CLASS", "METHOD"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm((f) => ({ ...f, type: t, methodName: "", matchParams: false, paramsRaw: "" }))}
                className={[
                  "flex-1 py-1 rounded text-xs font-medium border transition-colors",
                  form.type === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-accent",
                ].join(" ")}
              >
                {t === "CLASS" ? "클래스 제외" : "메서드 제외"}
              </button>
            ))}
          </div>

          {/* 클래스명 */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">
              클래스명 (와일드카드: <code className="font-mono">hmg.car.internal.*</code>)
            </label>
            <input
              type="text"
              value={form.className}
              onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))}
              placeholder="ex) hmg.car.HmgActivityManager"
              className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* 메서드명 (METHOD 타입일 때만) */}
          {form.type === "METHOD" && (
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">메서드명</label>
              <input
                type="text"
                value={form.methodName}
                onChange={(e) => setForm((f) => ({ ...f, methodName: e.target.value }))}
                placeholder="ex) getTopActivityWidth"
                className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          {/* 파라미터 매칭 옵션 (METHOD 타입일 때만) */}
          {form.type === "METHOD" && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.matchParams}
                  onChange={(e) => setForm((f) => ({ ...f, matchParams: e.target.checked }))}
                  className="accent-primary"
                />
                파라미터까지 일치할 때만 제외
              </label>
              {form.matchParams && (
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">
                    파라미터 (쉼표로 구분)
                  </label>
                  <input
                    type="text"
                    value={form.paramsRaw}
                    onChange={(e) => setForm((f) => ({ ...f, paramsRaw: e.target.value }))}
                    placeholder="ex) String, int, Context"
                    className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">메모 (선택)</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="제외 이유..."
              className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-1.5">
            <button
              onClick={handleAdd}
              disabled={saving || !form.className.trim() || (form.type === "METHOD" && !form.methodName.trim())}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-primary text-primary-foreground text-xs disabled:opacity-50"
            >
              {saving ? <RefreshCw size={10} className="animate-spin" /> : <Plus size={10} />}
              {saving ? "저장 중..." : "추가"}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setForm(INITIAL_FORM); }}
              className="px-3 py-1.5 rounded border text-xs hover:bg-accent"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 안내 메시지 */}
      {rules.length === 0 && !showAddForm && (
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/30 rounded p-2">
          <Info size={11} className="mt-0.5 shrink-0" />
          <span>규칙 추가 시 다음 파싱부터 해당 클래스/메서드가 API 목록에서 제외됩니다</span>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw size={11} className="animate-spin" /> 로딩 중...
        </div>
      )}

      {/* 클래스 제외 규칙 목록 */}
      {classRules.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Shield size={9} /> 클래스 제외 ({classRules.length})
          </p>
          {classRules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              label={getRuleLabel(rule)}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}

      {/* 메서드 제외 규칙 목록 */}
      {methodRules.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Code2 size={9} /> 메서드 제외 ({methodRules.length})
          </p>
          {methodRules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              label={getRuleLabel(rule)}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 규칙 단건 행 ─────────────────────────────────────────────
function RuleRow({
  rule,
  label,
  onDelete,
  deletingId,
}: {
  rule: ExcludeRule;
  label: string;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-1 rounded px-2 py-1.5 bg-secondary/50 group">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] truncate" title={label}>{label}</p>
        {rule.matchParams && rule.params.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            파라미터 일치: ({rule.params.join(", ")})
          </p>
        )}
        {rule.note && (
          <p className="text-[10px] text-muted-foreground italic truncate">{rule.note}</p>
        )}
      </div>
      <button
        onClick={() => onDelete(rule.id)}
        disabled={deletingId === rule.id}
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
        title="제외 규칙 삭제"
      >
        {deletingId === rule.id
          ? <RefreshCw size={11} className="animate-spin" />
          : <Trash2 size={11} />
        }
      </button>
    </div>
  );
}
