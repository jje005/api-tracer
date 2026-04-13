// 모듈 목록 API Route
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, getErrorMessage } from "@/lib/apiResponse";

/**
 * GET /api/modules?projectId=xxx
 * 특정 프로젝트의 모듈 목록 + 최신 버전 + API 수 반환
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  console.log(`[Modules API] 목록 조회 (projectId: ${projectId})`);

  try {
    const modules = await prisma.module.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { apis: true } },
        versions: {
          orderBy: { parsedAt: "desc" },
          take: 1, // 최신 버전만
        },
      },
    });

    const result = modules.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      projectId: m.projectId,
      apiCount: m._count.apis,
      latestVersion: m.versions[0]?.version ?? null,
      latestUploadedAt: m.versions[0]?.parsedAt ?? null,
    }));

    return apiSuccess.ok(result);
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[Modules API] 오류:", message);
    return apiError.internal(message);
  }
}
