// TC 경로 기반 스캔 + 분석 API Route
// dirPath를 받아 재귀 스캔 → 파싱 → API 매핑 → Coverage 저장

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanTcFiles, isValidDir } from "@/lib/services/fileSystemService";
import { analyzeTcFiles, matchApisToEntries } from "@/lib/services/tcAnalyzerService";
import { saveCoverage, clearSuiteCoverage } from "@/lib/services/coverageService";
import { apiError, apiSuccess, getErrorMessage } from "@/lib/apiResponse";

/**
 * POST /api/parse/tc
 *
 * Body:
 *   dirPath    - TC 루트 폴더 경로 (필수)
 *   suiteName  - 테스트 스위트 이름 (필수)
 *   projectId  - 커버리지 매핑할 프로젝트 ID (필수)
 *   reparse    - true이면 동일 경로 기존 데이터 삭제 후 재파싱
 */
export async function POST(req: NextRequest) {
  console.log("[Parse TC API] 요청 수신");

  try {
    const body = (await req.json()) as {
      dirPath?: string;
      suiteName?: string;
      projectId?: string;
      reparse?: boolean;
    };

    const { dirPath, suiteName, projectId, reparse = false } = body;

    if (!dirPath || !suiteName || !projectId) {
      return apiError.badRequest("dirPath, suiteName, projectId 필드가 필요합니다");
    }

    if (!isValidDir(dirPath)) {
      return apiError.badRequest("존재하지 않는 디렉토리입니다");
    }

    // 재파싱: 동일 dirPath의 기존 TestSuite 삭제
    if (reparse) {
      const existing = await prisma.testSuite.findFirst({ where: { dirPath } });
      if (existing) {
        await clearSuiteCoverage(existing.id);
        await prisma.testCase.deleteMany({ where: { suiteId: existing.id } });
        await prisma.testSuite.delete({ where: { id: existing.id } });
        console.log(`[Parse TC API] 기존 스위트 삭제: ${existing.id}`);
      }
    }

    // 1. TC 파일 스캔
    console.log(`[Parse TC API] 스캔 중: ${dirPath}`);
    const scannedFiles = await scanTcFiles(dirPath);
    if (scannedFiles.length === 0) {
      return apiError.badRequest("해당 경로에서 .java/.kt 파일을 찾을 수 없습니다");
    }

    // 2. TC 파싱 (호출된 API 추출)
    console.log(`[Parse TC API] ${scannedFiles.length}개 파일 파싱 중...`);
    const analyzeResult = await analyzeTcFiles(scannedFiles);

    // 3. 언어 판별 (Java/Kotlin 혼합이면 JAVA 우선)
    const hasKotlin = analyzeResult.testCases.some((tc) => tc.language === "KOTLIN");
    const hasJava = analyzeResult.testCases.some((tc) => tc.language === "JAVA");
    const language = hasJava ? "JAVA" : hasKotlin ? "KOTLIN" : "JAVA";

    // 4. 프로젝트의 전체 ApiEntry 조회 (커버리지 매핑용)
    const allApis = await prisma.apiEntry.findMany({
      where: { module: { projectId } },
      select: { id: true, className: true, methodName: true },
    });
    console.log(`[Parse TC API] 매핑 대상 API: ${allApis.length}개`);

    // 5. 트랜잭션으로 TestSuite + TestCase + Coverage 저장
    const result = await prisma.$transaction(async (tx) => {
      // TestSuite 생성 (dirPath 저장 → 재파싱용)
      const suite = await tx.testSuite.create({
        data: {
          name: suiteName,
          language,
          dirPath,
        },
      });

      let totalCovered = 0;
      let totalTcSaved = 0;

      for (const tc of analyzeResult.testCases) {
        // TestCase 저장 (content는 대용량이므로 필요시 생략 가능)
        const testCase = await tx.testCase.create({
          data: {
            suiteId: suite.id,
            name: tc.name,
            filePath: tc.filePath,
            content: tc.content,
            calledApis: tc.calledApis,
          },
        });

        // API 매핑: calledApis → ApiEntry id 목록
        const matchedApiIds = matchApisToEntries(tc.calledApis, allApis);

        // Coverage 저장 (트랜잭션 내에서는 saveCoverage 로직 직접 실행)
        if (matchedApiIds.length > 0) {
          await tx.coverage.createMany({
            data: matchedApiIds.map((apiId) => ({
              apiId,
              testCaseId: testCase.id,
              status: "COVERED" as const,
            })),
            skipDuplicates: true,
          });
          totalCovered += matchedApiIds.length;
        }

        totalTcSaved++;
      }

      return { suite, totalTcSaved, totalCovered };
    });

    console.log(`[Parse TC API] 완료: TC ${result.totalTcSaved}개, 커버리지 ${result.totalCovered}건`);

    return apiSuccess.created({
      success: true,
      suiteId: result.suite.id,
      totalFiles: scannedFiles.length,
      totalTcSaved: result.totalTcSaved,
      totalCoverageLinks: result.totalCovered,
      parseErrors: analyzeResult.errors,
    });
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[Parse TC API] 오류:", message);
    return apiError.internal(message);
  }
}

/**
 * GET /api/parse/tc?projectId=xxx
 * 등록된 TestSuite 목록 조회 (프로젝트 필터 + 연동 프로젝트 정보 포함)
 * 프로젝트 정보는 Coverage → ApiEntry → Module → Project 경로로 역추적
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  console.log(`[Parse TC API] 스위트 목록 조회 (projectId: ${projectId ?? "전체"})`);

  try {
    // projectId 필터: 해당 프로젝트 API를 하나라도 커버하는 스위트만 조회
    // Java의 EXISTS 서브쿼리와 유사: WHERE EXISTS (SELECT 1 FROM ...)
    const suites = await prisma.testSuite.findMany({
      where: projectId ? {
        testCases: {
          some: {
            coverages: {
              some: { api: { module: { projectId } } },
            },
          },
        },
      } : undefined,
      orderBy: { parsedAt: "desc" },
      include: { _count: { select: { testCases: true } } },
    });

    if (suites.length === 0) return apiSuccess.ok([]);

    // 스위트별 연동 프로젝트를 한 번의 쿼리로 역추적
    // N+1 방지: 모든 스위트의 coverage를 한번에 조회한 뒤 클라이언트에서 그룹핑
    const suiteIds = suites.map((s) => s.id);
    const coveragesWithProject = await prisma.coverage.findMany({
      where: { testCase: { suiteId: { in: suiteIds } } },
      select: {
        testCase: { select: { suiteId: true } },
        api: {
          select: {
            module: { select: { project: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    // suiteId → { id, name } 매핑 (첫 번째 coverage의 프로젝트 사용)
    const projectBySuiteId = new Map<string, { id: string; name: string }>();
    for (const cov of coveragesWithProject) {
      const sid = cov.testCase.suiteId;
      if (!projectBySuiteId.has(sid)) {
        projectBySuiteId.set(sid, cov.api.module.project);
      }
    }

    return apiSuccess.ok(
      suites.map((s) => ({
        id: s.id,
        name: s.name,
        language: s.language,
        dirPath: s.dirPath,
        parsedAt: s.parsedAt,
        testCaseCount: s._count.testCases,
        // 연동 프로젝트: 커버리지가 없는 스위트는 null
        project: projectBySuiteId.get(s.id) ?? null,
      }))
    );
  } catch (e) {
    const message = getErrorMessage(e);
    return apiError.internal(message);
  }
}
