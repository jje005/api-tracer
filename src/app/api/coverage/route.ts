// 커버리지 요약 API — 프로젝트 전체 + 모듈별 요약 (API 상세 미포함)
import { NextRequest } from "next/server";
import { getProjectCoverageSummaries } from "@/lib/services/coverageService";
import { apiError, apiSuccess, getErrorMessage } from "@/lib/apiResponse";

/**
 * GET /api/coverage?projectId=xxx
 * 프로젝트 커버리지 요약 + 모듈별 요약 목록 반환
 * 모듈 API 상세는 /api/coverage/[moduleId] 로 별도 조회 (lazy loading)
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return apiError.badRequest("projectId 파라미터가 필요합니다");
  }

  console.log(`[Coverage API] 커버리지 요약 조회: ${projectId}`);

  try {
    const result = await getProjectCoverageSummaries(projectId);
    return apiSuccess.ok(result);
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[Coverage API] 오류:", message);
    return apiError.internal(message);
  }
}
