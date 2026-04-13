// 커버리지 요약 API — 프로젝트 전체 + 모듈별 요약 (API 상세 미포함)
import { NextRequest, NextResponse } from "next/server";
import { getProjectCoverageSummaries } from "@/lib/services/coverageService";

/**
 * GET /api/coverage?projectId=xxx
 * 프로젝트 커버리지 요약 + 모듈별 요약 목록 반환
 * 모듈 API 상세는 /api/coverage/[moduleId] 로 별도 조회 (lazy loading)
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId 파라미터가 필요합니다" }, { status: 400 });
  }

  console.log(`[Coverage API] 커버리지 요약 조회: ${projectId}`);

  try {
    const result = await getProjectCoverageSummaries(projectId);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Coverage API] 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
