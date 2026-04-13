// 프로젝트 단건 수정/삭제 API
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, getErrorMessage } from "@/lib/apiResponse";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * PATCH /api/projects/[projectId]
 * 프로젝트 이름/설명 수정
 * Body: { name?: string, description?: string }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  console.log(`[Projects API] 프로젝트 수정: ${projectId}`);

  try {
    const body = await req.json() as { name?: string; description?: string };

    if (body.name !== undefined && !body.name.trim()) {
      return apiError.badRequest("프로젝트 이름은 비워둘 수 없습니다");
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description.trim() || null }),
      },
    });

    console.log(`[Projects API] 수정 완료: ${updated.name}`);
    return apiSuccess.ok({ id: updated.id, name: updated.name, description: updated.description });
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[Projects API] 수정 오류:", message);
    return apiError.internal(message);
  }
}

/**
 * DELETE /api/projects/[projectId]
 * 프로젝트 삭제 (하위 모듈, API, 버전, 커버리지 모두 Cascade 삭제)
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  console.log(`[Projects API] 프로젝트 삭제: ${projectId}`);

  try {
    // 삭제 전 통계 수집 (로그용)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { _count: { select: { modules: true } } },
    });
    if (!project) {
      return apiError.notFound("프로젝트를 찾을 수 없습니다");
    }

    await prisma.project.delete({ where: { id: projectId } });

    console.log(`[Projects API] 삭제 완료: ${project.name} (모듈 ${project._count.modules}개)`);
    return apiSuccess.ok({ success: true, deletedName: project.name });
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[Projects API] 삭제 오류:", message);
    return apiError.internal(message);
  }
}
