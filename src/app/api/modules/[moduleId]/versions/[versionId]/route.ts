// 특정 버전 삭제 API Route
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ moduleId: string; versionId: string }>;
}

/**
 * DELETE /api/modules/[moduleId]/versions/[versionId]
 * 특정 버전만 삭제 (ApiSnapshot 포함, ApiEntry는 유지)
 * 마지막 버전이면 모듈도 함께 삭제할지 여부는 클라이언트에서 결정
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { moduleId, versionId } = await params;
  console.log(`[Version API] 버전 삭제: moduleId=${moduleId}, versionId=${versionId}`);

  try {
    // 버전 존재 여부 확인
    const version = await prisma.moduleVersion.findUnique({
      where: { id: versionId },
      include: { _count: { select: { apiSnapshots: true } } },
    });

    if (!version || version.moduleId !== moduleId) {
      return NextResponse.json({ error: "버전을 찾을 수 없습니다" }, { status: 404 });
    }

    // 모듈의 전체 버전 수 확인 (마지막 버전 삭제 시 경고용)
    const totalVersions = await prisma.moduleVersion.count({ where: { moduleId } });

    // ModuleVersion 삭제 → ApiSnapshot Cascade 삭제
    await prisma.moduleVersion.delete({ where: { id: versionId } });

    console.log(`[Version API] 버전 삭제 완료: v${version.version} (스냅샷 ${version._count.apiSnapshots}개 삭제)`);

    return NextResponse.json({
      success: true,
      wasLastVersion: totalVersions === 1,
      deletedVersion: version.version,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Version API] 삭제 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
