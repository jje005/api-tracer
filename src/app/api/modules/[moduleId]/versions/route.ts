// 모듈 버전 목록 API Route
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, getErrorMessage } from "@/lib/apiResponse";

interface RouteParams {
  params: Promise<{ moduleId: string }>;
}

/**
 * GET /api/modules/[moduleId]/versions
 * 특정 모듈의 전체 버전 이력 반환 (최신순)
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { moduleId } = await params;
  console.log(`[Versions API] moduleId: ${moduleId}`);

  try {
    const versions = await prisma.moduleVersion.findMany({
      where: { moduleId },
      orderBy: { parsedAt: "desc" },
      include: {
        // 버전별 API 스냅샷 통계
        _count: { select: { apiSnapshots: true } },
      },
    });

    if (versions.length === 0) {
      // 모듈 존재 여부 확인
      const module = await prisma.module.findUnique({ where: { id: moduleId } });
      if (!module) {
        return apiError.notFound("모듈을 찾을 수 없습니다");
      }
    }

    const result = versions.map((v) => ({
      id: v.id,
      version: v.version,
      filePath: v.filePath,
      parsedAt: v.parsedAt,
      apiCount: v._count.apiSnapshots,
    }));

    return apiSuccess.ok(result);
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[Versions API] 오류:", message);
    return apiError.internal(message);
  }
}
