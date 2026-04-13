// TC 관리 페이지 — 등록/재파싱/삭제 + 케이스 드릴다운
// 개선: 스위트별 연동 프로젝트 표시, 프로젝트 필터, 재파싱 시 올바른 projectId 사용
"use client";

import { useState, useEffect, useCallback } from "react";
import { PathInputForm } from "@/components/upload/PathInputForm";
import {
  FlaskConical, RefreshCw, CheckCircle2,
  AlertCircle, RotateCcw, FolderOpen, Trash2,
  ChevronDown, ChevronRight, Link as LinkIcon,
  FolderOpen as ProjectIcon,
} from "lucide-react";

// ─── 타입 정의 ──────────────────────────────────────────────────
interface Project {
  id: string;
  name: string;
}

interface TestSuite {
  id: string;
  name: string;
  language: string;
  dirPath: string;
  parsedAt: string;
  testCaseCount: number;
  // API에서 Coverage → Module → Project 경로로 역추적한 연동 프로젝트
  // TypeScript: null union — Java의 Optional<Project>에 해당
  project: { id: string; name: string } | null;
}

interface CoveredApi {
  id: string;
  className: string;
  methodName: string;
  returnType: string;
}

interface TestCaseItem {
  id: string;
  name: string;
  filePath: string;
  calledApis: string[];
  coveredApis: CoveredApi[];
}

interface ParseState {
  status: "idle" | "running" | "success" | "error";
  message: string;
}

// ─── TC 케이스 행 (아코디언 방식) ────────────────────────────────
function TestCaseRow({ tc }: { tc: TestCaseItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-md overflow-hidden text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown size={13} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={13} className="shrink-0 text-muted-foreground" />}
          <span className="font-mono font-medium truncate">{tc.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs text-muted-foreground">커버 {tc.coveredApis.length}개</span>
          {tc.coveredApis.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t bg-muted/20 px-3 py-2 space-y-1">
          {tc.coveredApis.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">매핑된 API가 없습니다</p>
          ) : (
            tc.coveredApis.map((api) => {
              const simpleClass = api.className.split(".").pop() ?? api.className;
              return (
                <div key={api.id} className="flex items-center gap-1.5 font-mono text-xs">
                  <LinkIcon size={10} className="text-green-500 shrink-0" />
                  <span className="text-muted-foreground">{simpleClass}</span>
                  <span>.</span>
                  <span className="font-medium">{api.methodName}</span>
                  <span className="text-muted-foreground ml-auto">: {api.returnType}</span>
                </div>
              );
            })
          )}
          {tc.calledApis.length > tc.coveredApis.length && (
            <p className="text-xs text-muted-foreground pt-1 border-t">
              추출된 호출 {tc.calledApis.length}개 중 {tc.calledApis.length - tc.coveredApis.length}개 미매핑
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 스위트 카드 ─────────────────────────────────────────────────
function SuiteCard({
  suite,
  onReparse,
  onDelete,
}: {
  suite: TestSuite;
  onReparse: (suite: TestSuite) => void;
  onDelete: (suite: TestSuite) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<TestCaseItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);

  const handleToggle = async () => {
    if (!open && cases.length === 0) {
      setLoadingCases(true);
      try {
        const res = await fetch(`/api/parse/tc/${suite.id}`);
        if (res.ok) setCases(await res.json());
      } catch (e) {
        console.error("[SuiteCard] 케이스 로드 실패:", e);
      } finally {
        setLoadingCases(false);
      }
    }
    setOpen((o) => !o);
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* 카드 헤더 */}
      <div className="flex items-start justify-between gap-2 px-4 py-3 bg-card">
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          {open
            ? <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
            : <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{suite.name}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                {suite.language}
              </span>
              {/* 연동 프로젝트 배지 — Coverage 역추적으로 확인된 프로젝트 */}
              {suite.project ? (
                <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                  <ProjectIcon size={10} />
                  {suite.project.name}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">(미매핑)</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <FolderOpen size={11} />
              <span className="font-mono truncate max-w-[220px]">{suite.dirPath}</span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onReparse(suite)}
            title="재파싱"
            className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => onDelete(suite)}
            title="스위트 삭제"
            className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 하단 요약 바 */}
      <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30">
        <span>TC {suite.testCaseCount}개</span>
        <span>•</span>
        <span>{new Date(suite.parsedAt).toLocaleDateString("ko-KR")}</span>
      </div>

      {/* 확장: TC 케이스 목록 */}
      {open && (
        <div className="border-t px-4 py-3 space-y-2 bg-muted/10">
          {loadingCases ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <RefreshCw size={12} className="animate-spin" /> 케이스 로딩 중...
            </div>
          ) : cases.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">TC 케이스가 없습니다</p>
          ) : (
            cases.map((tc) => <TestCaseRow key={tc.id} tc={tc} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────
export default function TcPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [filterProjectId, setFilterProjectId] = useState(""); // 스위트 목록 필터용
  const [tcPath, setTcPath] = useState("");
  const [suiteName, setSuiteName] = useState("");
  const [parseState, setParseState] = useState<ParseState>({ status: "idle", message: "" });
  const [loading, setLoading] = useState(true);

  // 프로젝트 + 스위트 목록 로드
  // filterProjectId가 바뀔 때도 스위트 목록 새로 조회
  const loadData = useCallback(async (pId?: string) => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/projects"),
        fetch(`/api/parse/tc${pId ? `?projectId=${pId}` : ""}`),
      ]);
      const pData: Project[] = await pRes.json();
      const sData: TestSuite[] = await sRes.json();
      setProjects(pData);
      setSuites(sData);
      // 최초 로드 시 첫 프로젝트 자동 선택
      if (pData.length > 0 && !selectedProjectId) setSelectedProjectId(pData[0].id);
    } catch (e) {
      console.error("[TcPage] 데이터 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 스위트 필터 변경 시 API 재조회
  const handleFilterChange = (pid: string) => {
    setFilterProjectId(pid);
    loadData(pid || undefined);
  };

  // TC 분석 실행
  const handleAnalyze = async () => {
    if (!tcPath || !suiteName.trim() || !selectedProjectId) return;
    setParseState({ status: "running", message: "TC 스캔 및 분석 중..." });
    console.log(`[TcPage] TC 분석 시작: ${tcPath}`);

    try {
      const res = await fetch("/api/parse/tc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirPath: tcPath, suiteName: suiteName.trim(), projectId: selectedProjectId }),
      });
      const data = await res.json();

      if (!res.ok) { setParseState({ status: "error", message: data.error }); return; }

      setParseState({
        status: "success",
        message: `완료! TC ${data.totalTcSaved}개 분석, 커버리지 링크 ${data.totalCoverageLinks}건`,
      });
      setSuiteName("");
      setTcPath("");
      await loadData(filterProjectId || undefined);
    } catch (e) {
      setParseState({ status: "error", message: e instanceof Error ? e.message : "알 수 없는 오류" });
    }
  };

  // 스위트 재파싱 — suite.project.id를 우선 사용, 없으면 선택된 projectId
  const handleReparse = async (suite: TestSuite) => {
    const projectId = suite.project?.id ?? selectedProjectId;
    if (!projectId) {
      alert("재파싱할 프로젝트를 선택해주세요");
      return;
    }
    setParseState({ status: "running", message: `"${suite.name}" 재파싱 중...` });
    console.log(`[TcPage] 재파싱: ${suite.id}, projectId=${projectId}`);

    try {
      const res = await fetch("/api/parse/tc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirPath: suite.dirPath,
          suiteName: suite.name,
          projectId,
          reparse: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setParseState({ status: "error", message: data.error }); return; }
      setParseState({ status: "success", message: `재파싱 완료! TC ${data.totalTcSaved}개` });
      await loadData(filterProjectId || undefined);
    } catch (e) {
      setParseState({ status: "error", message: e instanceof Error ? e.message : "오류" });
    }
  };

  // 스위트 삭제
  const handleDelete = async (suite: TestSuite) => {
    if (!confirm(`"${suite.name}" 스위트를 삭제하시겠습니까?\nTC ${suite.testCaseCount}개와 커버리지 데이터가 함께 삭제됩니다.`)) return;
    console.log(`[TcPage] 스위트 삭제: ${suite.id}`);

    try {
      const res = await fetch(`/api/parse/tc/${suite.id}`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json(); alert(data.error ?? "삭제 실패"); return; }
      await loadData(filterProjectId || undefined);
    } catch (e) {
      console.error("[TcPage] 삭제 오류:", e);
      alert("삭제 중 오류 발생");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">TC 관리</h2>
        <p className="text-muted-foreground mt-1">
          TC 폴더 경로를 지정하면 Java/Kotlin 파일을 자동 스캔하여 API 커버리지를 분석합니다
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── 왼쪽: 새 TC 등록 폼 ─────────────────────────── */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">새 TC 등록</h3>

          {/* 프로젝트 선택 */}
          <div>
            <label className="text-sm font-medium block mb-1.5">커버리지 매핑 프로젝트</label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw size={14} className="animate-spin" /> 로딩 중...
              </div>
            ) : (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">프로젝트 선택</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* 스위트 이름 */}
          <div>
            <label className="text-sm font-medium block mb-1.5">테스트 스위트 이름</label>
            <input
              type="text"
              value={suiteName}
              onChange={(e) => setSuiteName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAnalyze(); }}
              placeholder="ex) Unit Tests v1.2"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* 경로 입력 */}
          <PathInputForm
            type="TC"
            onValidated={(path) => setTcPath(path)}
          />

          {/* 상태 메시지 */}
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

          {/* 실행 버튼 */}
          <button
            onClick={handleAnalyze}
            disabled={!tcPath || !suiteName.trim() || !selectedProjectId || parseState.status === "running"}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {parseState.status === "running"
              ? <><RefreshCw size={14} className="animate-spin" /> 분석 중...</>
              : <><FlaskConical size={14} /> TC 분석 시작</>
            }
          </button>
        </div>

        {/* ── 오른쪽: 등록된 스위트 목록 ─────────────────── */}
        <div className="space-y-4">
          {/* 헤더 + 필터 */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold text-lg">
              등록된 TC 스위트
              {suites.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">{suites.length}개</span>
              )}
            </h3>
            {/* 프로젝트 필터 — 선택 시 API 재조회하여 해당 프로젝트 스위트만 표시 */}
            {projects.length > 1 && (
              <select
                value={filterProjectId}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">전체 프로젝트</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <RefreshCw size={14} className="animate-spin" /> 로딩 중...
            </div>
          ) : suites.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <FlaskConical size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                {filterProjectId ? "선택한 프로젝트에 TC 스위트가 없습니다" : "등록된 TC가 없습니다"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {suites.map((suite) => (
                <SuiteCard
                  key={suite.id}
                  suite={suite}
                  onReparse={handleReparse}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
