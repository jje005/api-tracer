// 커버리지 계산 서비스
// ApiEntry ↔ TestCase 매핑 결과를 집계하여 Coverage 통계를 산출

import { prisma } from "@/lib/prisma";

// ─── 타입 정의 ────────────────────────────────────────────────
export interface CoverageSummary {
  totalApis: number;
  coveredApis: number;
  uncoveredApis: number;
  coveragePercent: number;
}

export interface ModuleCoverageSummary {
  moduleId: string;
  moduleName: string;
  moduleType: string;
  totalApis: number;
  coveredApis: number;
  uncoveredApis: number;
  coveragePercent: number;
}

export interface ApiCoverage {
  apiId: string;
  className: string;
  methodName: string;
  params: string[];
  returnType: string;
  isStatic: boolean;
  isCovered: boolean;
  testCases: string[]; // 커버하는 TC 이름 목록
}

export interface ModuleCoverage {
  moduleId: string;
  moduleName: string;
  totalApis: number;
  coveredApis: number;
  coveragePercent: number;
  apis: ApiCoverage[];
}

export interface ModuleApiCoverageResult {
  moduleId: string;
  moduleName: string;
  totalApis: number;
  coveredApis: number;
  coveragePercent: number;
  // 클래스 단위로 그룹핑된 API 목록
  grouped: Record<string, ApiCoverage[]>;
  // 페이지네이션 정보
  totalClasses: number;
  currentPage: number;
  totalPages: number;
}

// ─── 프로젝트 전체 요약 + 모듈 요약 목록 ─────────────────────
/**
 * 프로젝트 커버리지 요약 + 모듈별 요약 (API 상세 제외)
 * 모듈 클릭 시 getModuleApiCoverage로 상세 조회하도록 설계
 */
export async function getProjectCoverageSummaries(projectId: string): Promise<{
  summary: CoverageSummary;
  modules: ModuleCoverageSummary[];
}> {
  console.log(`[CoverageService] 프로젝트 커버리지 요약: ${projectId}`);

  // 전체 API 수
  const totalApis = await prisma.apiEntry.count({
    where: { module: { projectId } },
  });

  // 커버된 API 수 (Coverage 레코드가 하나라도 있는 ApiEntry)
  const coveredApis = await prisma.apiEntry.count({
    where: { module: { projectId }, coverages: { some: {} } },
  });

  const summary: CoverageSummary = {
    totalApis,
    coveredApis,
    uncoveredApis: totalApis - coveredApis,
    coveragePercent: totalApis > 0 ? Math.round((coveredApis / totalApis) * 100) : 0,
  };

  // 모듈별 요약: API count + 커버된 count만 집계 (API 상세 미포함)
  const modules = await prisma.module.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      type: true,
      _count: { select: { apis: true } },
      // 커버된 API 수: coverages 관계가 있는 ApiEntry 수
      apis: {
        select: { id: true, coverages: { select: { id: true }, take: 1 } },
      },
    },
    orderBy: { name: "asc" },
  });

  const moduleSummaries: ModuleCoverageSummary[] = modules.map((m) => {
    const total = m._count.apis;
    const covered = m.apis.filter((a) => a.coverages.length > 0).length;
    const percent = total > 0 ? Math.round((covered / total) * 100) : 0;
    return {
      moduleId: m.id,
      moduleName: m.name,
      moduleType: m.type,
      totalApis: total,
      coveredApis: covered,
      uncoveredApis: total - covered,
      coveragePercent: percent,
    };
  });

  return { summary, modules: moduleSummaries };
}

// ─── 모듈별 API 상세 커버리지 (Lazy 로드) ────────────────────
/**
 * 특정 모듈의 API 커버리지 상세 조회
 * 클래스 단위 그룹핑 + 필터 + 페이지네이션
 *
 * @param moduleId  조회할 모듈 ID
 * @param filter    "all" | "covered" | "uncovered"
 * @param page      클래스 단위 페이지 번호 (1-indexed)
 * @param perPage   페이지당 클래스 수 (기본 20)
 */
export async function getModuleApiCoverage(
  moduleId: string,
  filter: "all" | "covered" | "uncovered" = "all",
  page = 1,
  perPage = 20
): Promise<ModuleApiCoverageResult> {
  console.log(`[CoverageService] 모듈 API 커버리지: ${moduleId}, filter=${filter}, page=${page}`);

  const module = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, name: true },
  });
  if (!module) throw new Error(`모듈을 찾을 수 없습니다: ${moduleId}`);

  // 필터 조건 구성
  // TypeScript 조건부 객체 스프레드: Java의 if 블록 빌더 패턴보다 간결
  const coverageFilter =
    filter === "covered" ? { coverages: { some: {} } }
    : filter === "uncovered" ? { coverages: { none: {} } }
    : {};

  // 전체 모듈 API 수 (필터 무관)
  const totalApis = await prisma.apiEntry.count({ where: { moduleId } });

  // 커버된 API 수 (필터 무관)
  const coveredApis = await prisma.apiEntry.count({
    where: { moduleId, coverages: { some: {} } },
  });

  // 필터 적용 API 조회
  const apis = await prisma.apiEntry.findMany({
    where: { moduleId, ...coverageFilter },
    orderBy: [{ className: "asc" }, { methodName: "asc" }],
    select: {
      id: true,
      className: true,
      methodName: true,
      params: true,
      returnType: true,
      isStatic: true,
      coverages: {
        select: { testCase: { select: { name: true } } },
      },
    },
  });

  // 클래스별 그룹핑
  const allGrouped: Record<string, ApiCoverage[]> = {};
  for (const api of apis) {
    if (!allGrouped[api.className]) allGrouped[api.className] = [];
    allGrouped[api.className].push({
      apiId: api.id,
      className: api.className,
      methodName: api.methodName,
      params: api.params as string[],
      returnType: api.returnType,
      isStatic: api.isStatic,
      isCovered: api.coverages.length > 0,
      testCases: api.coverages.map((c) => c.testCase.name),
    });
  }

  // 클래스 단위 페이지네이션
  const allClassEntries = Object.entries(allGrouped);
  const totalClasses = allClassEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalClasses / perPage));
  const clampedPage = Math.max(1, Math.min(page, totalPages));
  const offset = (clampedPage - 1) * perPage;
  const pageGrouped = Object.fromEntries(
    allClassEntries.slice(offset, offset + perPage)
  );

  return {
    moduleId: module.id,
    moduleName: module.name,
    totalApis,
    coveredApis,
    coveragePercent: totalApis > 0 ? Math.round((coveredApis / totalApis) * 100) : 0,
    grouped: pageGrouped,
    totalClasses,
    currentPage: clampedPage,
    totalPages,
  };
}

// ─── Coverage 레코드 일괄 저장 ────────────────────────────────
export async function saveCoverage(testCaseId: string, matchedApiIds: string[]): Promise<number> {
  if (matchedApiIds.length === 0) return 0;
  const result = await prisma.coverage.createMany({
    data: matchedApiIds.map((apiId) => ({ apiId, testCaseId, status: "COVERED" as const })),
    skipDuplicates: true,
  });
  console.log(`[CoverageService] Coverage 저장: testCase=${testCaseId}, ${result.count}개`);
  return result.count;
}

// ─── Coverage 초기화 (재파싱 시) ──────────────────────────────
export async function clearSuiteCoverage(suiteId: string): Promise<void> {
  const testCaseIds = await prisma.testCase
    .findMany({ where: { suiteId }, select: { id: true } })
    .then((tcs) => tcs.map((tc) => tc.id));

  if (testCaseIds.length === 0) return;
  const deleted = await prisma.coverage.deleteMany({
    where: { testCaseId: { in: testCaseIds } },
  });
  console.log(`[CoverageService] 기존 Coverage 삭제: suite=${suiteId}, ${deleted.count}개`);
}
