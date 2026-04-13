// 모듈 편집 / 삭제 액션 컴포넌트 (클라이언트 컴포넌트)
// 서버 컴포넌트인 모듈 상세 페이지에서 인터랙티브 액션 부분만 분리
// Java의 Controller + Service 분리와 유사: 서버는 데이터, 클라이언트는 상태/이벤트
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, AlertTriangle, RefreshCw, Sparkles, Settings2, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { useDeletionStore } from "@/lib/stores/deletionStore";
// 클라이언트 컴포넌트에서는 반드시 parseOptions.ts에서 import
// jarParserService.ts는 Node.js 전용 모듈을 포함 → 클라이언트 번들 오류 유발
import { type ParseOptions, DEFAULT_PARSE_OPTIONS, PARSE_OPTION_ITEMS } from "@/lib/parseOptions";

interface Version {
  id: string;
  version: string;
  // 재파싱을 위한 경로 정보 (경로 기반 파싱 시에만 존재)
  // Java라면 Optional<String>으로 표현할 필드를 TypeScript는 string | null로 표현
  dirPath: string | null;
  filePath: string;
}

interface ModuleActionsProps {
  moduleId: string;
  moduleName: string;
  projectId: string; // 재파싱 요청 시 필요한 프로젝트 ID
  versions: Version[];
  parseOptions?: Partial<ParseOptions>; // 모듈에 저장된 파싱 옵션
}

export function ModuleActions({ moduleId, moduleName, projectId, versions, parseOptions: initialParseOptions }: ModuleActionsProps) {
  // useRouter: 클라이언트에서 페이지 이동 / 새로고침
  // Java의 response.sendRedirect()와 유사
  const router = useRouter();
  const { addTask, removeTask } = useDeletionStore();

  // 이름 편집 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(moduleName);
  const [renaming, setRenaming] = useState(false);

  // 모듈 삭제 확인 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 데이터 정리 상태 (잘못 파싱된 ApiEntry 정리)
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  // 파싱 옵션 상태 — 초기값: 저장된 옵션 + 기본값 병합
  // Object spread: Java의 new HashMap<>(defaults) + putAll(stored)와 유사
  const [parseOpts, setParseOpts] = useState<ParseOptions>({
    ...DEFAULT_PARSE_OPTIONS,
    ...initialParseOptions,
  });
  const [showParseOptions, setShowParseOptions] = useState(false);
  const [savingOpts, setSavingOpts] = useState(false);
  const [optsResult, setOptsResult] = useState<string | null>(null);

  // 재파싱 상태 — 최신 버전 경로를 이용해 AAR/JAR를 다시 파싱
  const [reparsing, setReparsing] = useState(false);
  // 파싱 옵션 저장 후 재파싱 필요 여부 알림 상태
  const [needsReparse, setNeedsReparse] = useState(false);

  // 버전 삭제 상태 (versionId → loading)
  // Record<string, boolean>: Java의 Map<String, Boolean>과 유사
  const [deletingVersions, setDeletingVersions] = useState<Record<string, boolean>>({});

  // ── 모듈명 수정 ──────────────────────────────────────────────
  const handleRename = async () => {
    if (!editName.trim() || editName === moduleName) {
      setIsEditing(false);
      setEditName(moduleName);
      return;
    }

    setRenaming(true);
    console.log(`[ModuleActions] 모듈명 수정: ${moduleName} → ${editName}`);

    try {
      const res = await fetch(`/api/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "수정 실패");
        return;
      }

      setIsEditing(false);
      // 서버 컴포넌트 데이터 갱신: router.refresh()는 서버 재요청 후 DOM 업데이트
      // Java의 redirect()와 달리 현재 스크롤 위치를 유지
      router.refresh();
    } catch (e) {
      console.error("[ModuleActions] 수정 오류:", e);
      alert("수정 중 오류가 발생했습니다");
    } finally {
      setRenaming(false);
    }
  };

  // ── 모듈 전체 삭제 ───────────────────────────────────────────
  const handleDeleteModule = async () => {
    setDeleting(true);
    setShowDeleteConfirm(false);
    // 전역 토스트 등록 — 페이지 이동 후에도 하단에 진행 상태 표시
    addTask({ id: moduleId, label: `모듈 "${moduleName}" 삭제 중...`, type: "module" });
    console.log(`[ModuleActions] 모듈 삭제: ${moduleId}`);

    // 삭제 후 목록으로 먼저 이동 (토스트는 이동 후에도 유지됨)
    router.push("/modules");

    try {
      const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "삭제 실패");
        return;
      }

      router.refresh();
    } catch (e) {
      console.error("[ModuleActions] 삭제 오류:", e);
      alert("삭제 중 오류가 발생했습니다");
    } finally {
      setDeleting(false);
      removeTask(moduleId);
    }
  };

  // ── 파싱 옵션 저장 ─────────────────────────────────────────
  // 변경된 parseOptions를 DB에 저장 (재파싱은 별도로 수행)
  const handleSaveParseOptions = async () => {
    setSavingOpts(true);
    setOptsResult(null);
    console.log(`[ModuleActions] 파싱 옵션 저장:`, parseOpts);

    try {
      const res = await fetch(`/api/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parseOptions: parseOpts }),
      });

      if (!res.ok) {
        const data = await res.json();
        setOptsResult(`저장 실패: ${data.error}`);
        return;
      }

      setOptsResult("파싱 옵션이 저장되었습니다.");
      setNeedsReparse(true); // 재파싱 필요 상태 표시
      router.refresh();
    } catch (e) {
      console.error("[ModuleActions] 옵션 저장 오류:", e);
      setOptsResult("저장 중 오류가 발생했습니다");
    } finally {
      setSavingOpts(false);
    }
  };

  // ── 잘못된 API 데이터 정리 ──────────────────────────────────
  // 파서 버그로 저장된 비정상 메서드명/클래스명 ApiEntry 삭제
  const handleCleanup = async () => {
    setCleaning(true);
    setCleanResult(null);
    console.log(`[ModuleActions] 데이터 정리 시작: ${moduleId}`);

    try {
      const res = await fetch(`/api/modules/${moduleId}/cleanup`, { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok) { setCleanResult(`오류: ${data.error}`); return; }
      setCleanResult(data.message);
      if (data.deleted > 0) router.refresh();
    } catch (e) {
      setCleanResult("정리 중 오류 발생");
      console.error("[ModuleActions] 정리 오류:", e);
    } finally {
      setCleaning(false);
    }
  };

  // ── 재파싱 ─────────────────────────────────────────────────────
  // 최신 버전의 dirPath를 이용해 AAR/JAR를 다시 파싱 (경로 기반 등록 시에만 가능)
  // Java라면 Service 계층 호출이지만 여기서는 fetch로 API Route에 위임
  // allowWithoutDirPath: 파싱 옵션 저장 후 재파싱 시 dirPath 없어도 진행 (filePath 우선)
  const handleReparse = async (allowWithoutDirPath = false) => {
    const latestVersion = versions[0];
    // dirPath가 없으면 경로 기반 등록이 아니므로 재파싱 불가
    if (!latestVersion?.dirPath && !allowWithoutDirPath) {
      alert("경로 기반으로 등록된 모듈만 재파싱 가능합니다");
      return;
    }
    if (!latestVersion) {
      alert("파싱된 버전 정보가 없습니다");
      return;
    }

    setReparsing(true);
    console.log(`[ModuleActions] 재파싱 시작: ${moduleName} v${latestVersion.version}`);

    try {
      const res = await fetch("/api/parse/aar-jar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirPath: latestVersion.dirPath,
          filePath: latestVersion.filePath,
          projectId,
          moduleName,
          version: latestVersion.version,
          reparse: true,
          parseOptions: parseOpts,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`재파싱 실패: ${data.error ?? "알 수 없는 오류"}`);
        return;
      }

      console.log(`[ModuleActions] 재파싱 완료: ${moduleName}`);
      setNeedsReparse(false); // 재파싱 완료 → 알림 해제
      router.refresh();
    } catch (e) {
      console.error("[ModuleActions] 재파싱 오류:", e);
      alert("재파싱 중 오류가 발생했습니다");
    } finally {
      setReparsing(false);
    }
  };

  // ── 특정 버전 삭제 ───────────────────────────────────────────
  const handleDeleteVersion = async (versionId: string, versionLabel: string) => {
    if (!confirm(`v${versionLabel} 버전을 삭제하시겠습니까?\n관련 스냅샷 데이터도 함께 삭제됩니다.`)) return;

    // 해당 버전만 로딩 표시
    setDeletingVersions((prev) => ({ ...prev, [versionId]: true }));
    console.log(`[ModuleActions] 버전 삭제: ${versionId}`);

    try {
      const res = await fetch(`/api/modules/${moduleId}/versions/${versionId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "버전 삭제 실패");
        return;
      }

      // 마지막 버전이 삭제된 경우 목록으로 이동
      if (data.wasLastVersion) {
        alert("마지막 버전이 삭제되어 모듈 목록으로 이동합니다.");
        router.push("/modules");
        return;
      }

      router.refresh();
    } catch (e) {
      console.error("[ModuleActions] 버전 삭제 오류:", e);
      alert("버전 삭제 중 오류가 발생했습니다");
    } finally {
      setDeletingVersions((prev) => ({ ...prev, [versionId]: false }));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── 모듈명 편집 인라인 UI ───────────────────────────── */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") { setIsEditing(false); setEditName(moduleName); }
              }}
              autoFocus
              className="border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-medium"
            />
            {/* 확인 버튼 */}
            <button
              onClick={handleRename}
              disabled={renaming}
              className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              title="저장"
            >
              {renaming ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
            {/* 취소 버튼 */}
            <button
              onClick={() => { setIsEditing(false); setEditName(moduleName); }}
              className="p-1.5 rounded-md border hover:bg-accent"
              title="취소"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            {/* 편집 버튼 */}
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-accent transition-colors"
              title="모듈명 수정"
            >
              <Pencil size={13} />
              이름 수정
            </button>
            {/* 파싱 옵션 버튼 */}
            <button
              onClick={() => { setShowParseOptions(!showParseOptions); setOptsResult(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-accent transition-colors"
              title="파싱 옵션 설정"
            >
              <Settings2 size={13} />
              파싱 옵션
              {showParseOptions ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {/* 데이터 정리 버튼 */}
            <button
              onClick={handleCleanup}
              disabled={cleaning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-accent transition-colors disabled:opacity-50"
              title="파서 오류로 저장된 잘못된 API 항목 정리"
            >
              {cleaning
                ? <RefreshCw size={13} className="animate-spin" />
                : <Sparkles size={13} />
              }
              데이터 정리
            </button>
            {/* 재파싱 버튼 — dirPath가 있는 경로 기반 등록 모듈에서만 표시 */}
            {versions[0]?.dirPath && (
              <button
                onClick={() => handleReparse()}
                disabled={reparsing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-accent transition-colors disabled:opacity-50"
                title="최신 버전 경로 기반 재파싱"
              >
                {reparsing
                  ? <RefreshCw size={13} className="animate-spin" />
                  : <RotateCcw size={13} />
                }
                재파싱
              </button>
            )}
            {/* 삭제 버튼 */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive text-destructive text-sm hover:bg-destructive/10 transition-colors"
              title="모듈 삭제"
            >
              <Trash2 size={13} />
              모듈 삭제
            </button>
          </>
        )}
        {/* 정리 결과 메시지 */}
        {cleanResult && (
          <p className="text-xs text-muted-foreground">{cleanResult}</p>
        )}
      </div>

      {/* ── 파싱 옵션 패널 ───────────────────────────────────── */}
      {showParseOptions && !isEditing && (
        <div className="rounded-lg border p-4 space-y-3 bg-secondary/30">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Settings2 size={14} />
              파싱 옵션
            </h4>
            <p className="text-xs text-muted-foreground">다음 파싱 시 적용됩니다</p>
          </div>

          {/* 옵션 체크박스 목록 */}
          <div className="space-y-2">
            {PARSE_OPTION_ITEMS.map((item) => (
              <label key={item.key} className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={parseOpts[item.key]}
                  onChange={(e) =>
                    // TypeScript의 computed property key: Java의 map.put(key, value)와 동일
                    setParseOpts((prev) => ({ ...prev, [item.key]: e.target.checked }))
                  }
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium group-hover:text-foreground transition-colors">
                    {item.label}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
              </label>
            ))}
          </div>

          {/* 저장 버튼 영역 */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* 저장만 */}
            <button
              onClick={handleSaveParseOptions}
              disabled={savingOpts || reparsing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs hover:bg-accent disabled:opacity-50 transition-colors"
            >
              {savingOpts ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
              {savingOpts ? "저장 중..." : "저장만"}
            </button>

            {/* 저장 + 즉시 재파싱 — dirPath가 있어야 활성화 */}
            {versions[0]?.dirPath && (
              <button
                onClick={async () => {
                  await handleSaveParseOptions();
                  await handleReparse(true);
                }}
                disabled={savingOpts || reparsing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {(savingOpts || reparsing) ? <RefreshCw size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                {(savingOpts || reparsing) ? "처리 중..." : "저장 + 재파싱"}
              </button>
            )}

            {optsResult && (
              <p className="text-xs text-muted-foreground">{optsResult}</p>
            )}
          </div>

          {/* 재파싱 필요 알림 배너 — "저장만" 클릭 후 표시 */}
          {needsReparse && versions[0]?.dirPath && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-orange-300 bg-orange-50 text-orange-700 text-xs">
              <AlertTriangle size={12} />
              <span>옵션이 저장되었습니다. 실제 API 목록에 반영하려면 재파싱이 필요합니다.</span>
              <button
                onClick={() => handleReparse(true)}
                disabled={reparsing}
                className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-orange-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {reparsing ? <RefreshCw size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                지금 재파싱
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 버전별 삭제 목록 ──────────────────────────────────── */}
      {versions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-secondary">
              <span className="text-secondary-foreground">v{v.version}</span>
              <button
                onClick={() => handleDeleteVersion(v.id, v.version)}
                disabled={!!deletingVersions[v.id]}
                className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 ml-1"
                title={`v${v.version} 삭제`}
              >
                {deletingVersions[v.id]
                  ? <RefreshCw size={10} className="animate-spin" />
                  : <X size={10} />
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── 모듈 삭제 확인 모달 ───────────────────────────────── */}
      {/* 간단한 인라인 확인 UI (별도 Dialog 컴포넌트 없이) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg border shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle size={20} />
              <h3 className="font-semibold">모듈 삭제</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{moduleName}</span> 모듈을 삭제하면
              모든 버전, API 목록, 커버리지 데이터가 함께 삭제됩니다.
              <br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeleteModule}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
