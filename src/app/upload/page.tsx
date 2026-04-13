// 파일 등록 페이지 — 경로 입력 + 파일 선택 탭 방식
// 경로 탭: 서버 파일시스템 경로 → /api/parse/aar-jar
// 파일 탭: OS 파일 선택 (FormData) → /api/upload/aar-jar
"use client";

import { useState, useEffect } from "react";
import { AarJarInputPanel, type AarJarInput } from "@/components/upload/AarJarInputPanel";
import {
  Plus, RefreshCw, CheckCircle2, AlertCircle, RotateCcw,
  Package, Package2, ChevronDown, ChevronUp, Settings2,
} from "lucide-react";
import { ExcludeRulesPanel } from "@/components/upload/ExcludeRulesPanel";
// 클라이언트 컴포넌트에서는 반드시 parseOptions.ts에서 import
// jarParserService.ts → Node.js 전용 모듈 포함 → 클라이언트 번들 오류
import { type ParseOptions, DEFAULT_PARSE_OPTIONS, PARSE_OPTION_ITEMS } from "@/lib/parseOptions";

// ─── 타입 ──────────────────────────────────────────────────────
interface Project {
  id: string;
  name: string;
  moduleCount: number;
}

interface ModuleVersion {
  id: string;
  version: string;
  parsedAt: string;
}

interface ModuleSummary {
  id: string;
  name: string;
  type: string;           // AAR | JAR
  apiCount: number;
  latestVersion: string | null;
  latestUploadedAt: string | null;
}

interface ParseState {
  status: "idle" | "running" | "success" | "error";
  message: string;
  detail?: Record<string, unknown>;
}

// ─── 프로젝트 모듈 이력 패널 ────────────────────────────────────
// 프로젝트 선택 시 등록된 모듈 + 버전 이력을 보여주는 사이드 패널
function ProjectModuleHistory({ projectId }: { projectId: string }) {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  // 펼쳐진 모듈 ID → 버전 목록
  const [expandedVersions, setExpandedVersions] = useState<Record<string, ModuleVersion[]>>({});
  const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!projectId) return;
    setLoadingModules(true);
    setExpandedVersions({});
    console.log(`[UploadPage] 프로젝트 모듈 로드: ${projectId}`);

    fetch(`/api/modules?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data: ModuleSummary[]) => setModules(data))
      .catch((e) => console.error("[UploadPage] 모듈 로드 실패:", e))
      .finally(() => setLoadingModules(false));
  }, [projectId]);

  // 모듈 클릭 시 버전 이력 토글
  const toggleVersions = async (moduleId: string) => {
    // 이미 열려있으면 닫기
    if (expandedVersions[moduleId]) {
      setExpandedVersions((prev) => {
        const next = { ...prev };
        delete next[moduleId];
        return next;
      });
      return;
    }

    setLoadingVersions((prev) => ({ ...prev, [moduleId]: true }));
    try {
      const res = await fetch(`/api/modules/${moduleId}/versions`);
      const data: ModuleVersion[] = await res.json();
      setExpandedVersions((prev) => ({ ...prev, [moduleId]: data }));
    } catch (e) {
      console.error("[UploadPage] 버전 로드 실패:", e);
    } finally {
      setLoadingVersions((prev) => ({ ...prev, [moduleId]: false }));
    }
  };

  if (loadingModules) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <RefreshCw size={13} className="animate-spin" /> 모듈 목록 로딩 중...
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        아직 등록된 모듈이 없습니다. 아래에서 첫 번째 모듈을 등록하세요.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {modules.map((m) => {
        const isOpen = !!expandedVersions[m.id];
        const isLoadingV = !!loadingVersions[m.id];
        const versions = expandedVersions[m.id] ?? [];

        return (
          <div key={m.id} className="rounded-md border overflow-hidden">
            {/* 모듈 헤더 행 */}
            <button
              onClick={() => toggleVersions(m.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary/50 hover:bg-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                {m.type === "AAR"
                  ? <Package size={14} className="text-blue-500 shrink-0" />
                  : <Package2 size={14} className="text-purple-500 shrink-0" />
                }
                <span className="font-medium text-sm truncate">{m.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                  {m.type}
                </span>
                {m.latestVersion && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 shrink-0">
                    v{m.latestVersion}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs text-muted-foreground">API {m.apiCount}개</span>
                {isLoadingV
                  ? <RefreshCw size={12} className="animate-spin text-muted-foreground" />
                  : isOpen
                  ? <ChevronUp size={14} className="text-muted-foreground" />
                  : <ChevronDown size={14} className="text-muted-foreground" />
                }
              </div>
            </button>

            {/* 버전 이력 목록 */}
            {isOpen && (
              <div className="divide-y">
                {versions.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">버전 이력 없음</p>
                ) : (
                  versions.map((v) => (
                    <div key={v.id} className="flex items-center justify-between px-4 py-2 text-xs">
                      <span className="font-mono text-blue-600">v{v.version}</span>
                      <span className="text-muted-foreground">
                        {new Date(v.parsedAt).toLocaleDateString("ko-KR", {
                          year: "numeric", month: "2-digit", day: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function UploadPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [loading, setLoading] = useState(true);

  const [aarJarInput, setAarJarInput] = useState<AarJarInput | null>(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [version, setVersion] = useState("");
  const [parseState, setParseState] = useState<ParseState>({ status: "idle", message: "" });
  // 파싱 성공 시 증가 → ProjectModuleHistory의 key로 사용 → 강제 리마운트 + 재요청
  // Java의 트리거 변수 패턴과 유사 (상태 변경으로 부수 효과 유발)
  const [moduleHistoryKey, setModuleHistoryKey] = useState(0);

  // 파싱 옵션 상태 — 기본값으로 초기화
  const [parseOpts, setParseOpts] = useState<ParseOptions>({ ...DEFAULT_PARSE_OPTIONS });
  const [showParseOptions, setShowParseOptions] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) setSelectedProjectId(data[0].id);
    } catch (e) {
      console.error("[UploadPage] 프로젝트 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      if (res.ok) {
        const p = await res.json();
        await loadProjects();
        setSelectedProjectId(p.id);
        setIsCreatingProject(false);
        setNewProjectName("");
      }
    } catch (e) { console.error("[UploadPage] 프로젝트 생성 실패:", e); }
  };

  const handleAarJarInput = (input: AarJarInput) => {
    setAarJarInput(input);
    setParseState({ status: "idle", message: "" });

    const firstFile = input.files[0];
    if (firstFile) {
      setSelectedFile(firstFile.fileName);
      const base = firstFile.fileName.replace(/\.(aar|jar)$/i, "");
      const vMatch = base.match(/[-_](\d+\.\d+[\.\d]*)$/);
      if (vMatch) {
        setVersion(vMatch[1]);
        setModuleName(base.replace(vMatch[0], ""));
      } else {
        setModuleName(base);
        setVersion("");
      }
    }
  };

  const handleParse = async (reparse = false) => {
    if (!aarJarInput || !selectedProjectId || !moduleName || !version) return;
    setParseState({ status: "running", message: "파싱 중..." });

    try {
      let res: Response;

      if (aarJarInput.mode === "path") {
        res = await fetch("/api/parse/aar-jar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dirPath: aarJarInput.dirPath,
            fileName: selectedFile || undefined,
            projectId: selectedProjectId,
            moduleName: moduleName.trim(),
            version: version.trim(),
            reparse,
            parseOptions: parseOpts,   // 파싱 옵션 전달
          }),
        });
      } else {
        // 파일 업로드 모드는 FormData 사용 — parseOptions를 JSON 문자열로 추가
        const formData = new FormData();
        formData.append("file", aarJarInput.fileObject);
        formData.append("projectId", selectedProjectId);
        formData.append("moduleName", moduleName.trim());
        formData.append("version", version.trim());
        formData.append("parseOptions", JSON.stringify(parseOpts));
        res = await fetch("/api/upload/aar-jar", { method: "POST", body: formData });
      }

      const data = await res.json();
      if (!res.ok) {
        setParseState({ status: "error", message: data.error ?? "파싱 실패" });
        return;
      }

      setParseState({
        status: "success",
        message: `완료! API ${data.totalApis}개 파싱 (신규 ${data.newApis}개)`,
        detail: data,
      });
      // 파싱 성공 시 프로젝트 목록 + 모듈 이력 갱신
      // moduleHistoryKey 증가 → ProjectModuleHistory 리마운트 → 최신 버전 반영
      setModuleHistoryKey((k) => k + 1);
      await loadProjects();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      setParseState({ status: "error", message: msg });
      console.error("[UploadPage] 파싱 실패:", msg);
    }
  };

  const canReparse =
    parseState.status === "error" &&
    parseState.message.includes("이미 존재") &&
    aarJarInput?.mode === "path";

  return (
    // 2컬럼 레이아웃: 왼쪽 등록 폼 / 오른쪽 이력 패널
    // md 이상 화면에서 사이드바 표시, 모바일은 단일 컬럼
    <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">

      {/* ── 왼쪽: 등록 폼 ──────────────────────────────────── */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">모듈 등록</h2>
          <p className="text-muted-foreground mt-1">
            AAR / JAR 파일을 경로로 지정하거나 직접 선택하여 API를 파싱합니다
          </p>
        </div>

        {/* 1. 프로젝트 선택 */}
        <section className="rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">1. 프로젝트 선택</h3>
            <button
              onClick={() => setIsCreatingProject(!isCreatingProject)}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus size={14} /> 새 프로젝트
            </button>
          </div>

          {isCreatingProject && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="프로젝트 이름"
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={handleCreateProject}
                className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">
                생성
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <RefreshCw size={14} className="animate-spin" /> 로딩 중...
            </div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">프로젝트를 먼저 생성하세요.</p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <label key={p.id}
                  className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-accent transition-colors">
                  <input type="radio" name="project" value={p.id}
                    checked={selectedProjectId === p.id}
                    onChange={() => setSelectedProjectId(p.id)}
                    className="accent-primary" />
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">모듈 {p.moduleCount}개</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* 2. AAR/JAR 파일 지정 */}
        {selectedProjectId && (
          <section className="rounded-lg border p-5 space-y-4">
            <h3 className="font-semibold">2. AAR / JAR 파일 지정</h3>
            <AarJarInputPanel onInput={handleAarJarInput} />

            {aarJarInput?.mode === "path" && aarJarInput.files.length > 1 && (
              <div>
                <label className="text-sm font-medium block mb-1.5">파싱할 파일 선택</label>
                <select
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {aarJarInput.files.map((f) => (
                    <option key={f.fileName} value={f.fileName}>{f.fileName}</option>
                  ))}
                </select>
              </div>
            )}
          </section>
        )}

        {/* 3. 모듈 정보 입력 */}
        {aarJarInput && (
          <section className="rounded-lg border p-5 space-y-4">
            <h3 className="font-semibold">3. 모듈 정보 입력</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">모듈명</label>
                <input type="text" value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="ex) core-sdk"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">버전</label>
                <input type="text" value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="ex) 1.2.3"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            {/* 파싱 옵션 토글 섹션 */}
            <div className="rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => setShowParseOptions(!showParseOptions)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary/50 hover:bg-secondary text-sm transition-colors"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Settings2 size={13} />
                  파싱 옵션
                </span>
                {showParseOptions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {showParseOptions && (
                <div className="p-3 space-y-2.5">
                  {PARSE_OPTION_ITEMS.map((item) => (
                    <label key={item.key} className="flex items-start gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={parseOpts[item.key]}
                        onChange={(e) =>
                          setParseOpts((prev) => ({ ...prev, [item.key]: e.target.checked }))
                        }
                        className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-medium">{item.label}</span>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {parseState.status === "success" && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 size={14} /> {parseState.message}
              </div>
            )}
            {parseState.status === "error" && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle size={14} /> {parseState.message}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleParse(false)}
                disabled={!moduleName.trim() || !version.trim() || parseState.status === "running"}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {parseState.status === "running"
                  ? <><RefreshCw size={14} className="animate-spin" /> 파싱 중...</>
                  : "파싱 시작"
                }
              </button>
              {canReparse && (
                <button
                  onClick={() => handleParse(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
                >
                  <RotateCcw size={14} /> 재파싱
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {/* ── 오른쪽: 사이드바 (모듈 이력 + 제외 규칙) ──────── */}
      <aside className="sticky top-6 space-y-4">

        {/* 등록된 모듈 이력 */}
        <div className="rounded-lg border p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-sm">등록된 모듈</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              클릭하면 버전 이력을 확인할 수 있습니다
            </p>
          </div>
          {selectedProjectId ? (
            // key에 moduleHistoryKey 포함 → 파싱 성공 시 강제 리마운트 + 재요청
            <ProjectModuleHistory key={`${selectedProjectId}-${moduleHistoryKey}`} projectId={selectedProjectId} />
          ) : (
            <p className="text-sm text-muted-foreground">프로젝트를 선택하세요</p>
          )}
        </div>

        {/* 제외 규칙 관리 */}
        <div className="rounded-lg border p-4">
          {selectedProjectId ? (
            // key로 projectId 변경 시 컴포넌트 리셋
            <ExcludeRulesPanel key={`excl-${selectedProjectId}`} projectId={selectedProjectId} />
          ) : (
            <p className="text-sm text-muted-foreground">프로젝트를 선택하면 제외 규칙을 관리할 수 있습니다</p>
          )}
        </div>

      </aside>
    </div>
  );
}
