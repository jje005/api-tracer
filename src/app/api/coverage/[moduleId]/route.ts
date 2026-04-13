// 모듈별 API 커버리지 상세 API — 클래스 그룹핑 + 필터 + 페이지네이션
import { NextRequest } from "next/server";
import { getModuleApiCoverage } from "@/lib/services/coverageService";
import { apiError, apiSuccess, getErrorMessage } from "@/lib/apiResponse";

interface RouteParams {
  params: Promise<{ moduleId: string }>;
}

/**
 * GET /api/coverage/[moduleId]?filter=all&page=1&perPage=20
 *
 * 모듈 API 커버리지 상세 (클래스 단위 그룹핑 + 페이지네이션)
 *
 * Query params:
 *   filter  - "all" | "covered" | "uncovered" (기본 "all")
 *   page    - 페이지 번호 (기본 1)
 *   perPage - 페이지당 클래스 수 (기본 20)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { moduleId } = await params;
  const { searchParams } = req.nextUrl;

  const filter = (searchParams.get("filter") ?? "all") as "all" | "covered" | "uncovered";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const perPage = Math.max(1, Number(searchParams.get("perPage") ?? "20"));

  console.log(`[Coverage Module API] moduleId=${moduleId}, filter=${filter}, page=${page}`);

  try {
    const result = await getModuleApiCoverage(moduleId, filter, page, perPage);
    return apiSuccess.ok(result);
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[Coverage Module API] 오류:", message);
    return apiError.internal(message);
  }
}
