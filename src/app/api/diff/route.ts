// 버전 Diff API Route
// 두 ModuleVersion을 비교하여 ADDED / REMOVED / MODIFIED / SAME API 목록 반환
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildApiSignature } from "@/lib/utils";

/**
 * GET /api/diff?v1=<versionId>&v2=<versionId>
 *
 * v1: 이전 버전 ID (ModuleVersion.id)
 * v2: 새 버전 ID (ModuleVersion.id)
 *
 * 반환:
 *   added: v2에만 존재
 *   removed: v1에만 존재
 *   modified: 시그니처는 같으나 returnType 변경
 *   same: 변경 없음
 */
export async function GET(req: NextRequest) {
  const v1Id = req.nextUrl.searchParams.get("v1");
  const v2Id = req.nextUrl.searchParams.get("v2");

  if (!v1Id || !v2Id) {
    return NextResponse.json(
      { error: "v1, v2 파라미터가 필요합니다" },
      { status: 400 }
    );
  }

  console.log(`[Diff API] 비교 시작: v1=${v1Id}, v2=${v2Id}`);

  try {
    // 두 버전의 API 스냅샷 조회
    const [v1Snapshots, v2Snapshots] = await Promise.all([
      prisma.apiSnapshot.findMany({
        where: { moduleVersionId: v1Id },
        include: { apiEntry: true },
      }),
      prisma.apiSnapshot.findMany({
        where: { moduleVersionId: v2Id },
        include: { apiEntry: true },
      }),
    ]);

    const v1Version = await prisma.moduleVersion.findUnique({
      where: { id: v1Id },
    });
    const v2Version = await prisma.moduleVersion.findUnique({
      where: { id: v2Id },
    });

    if (!v1Version || !v2Version) {
      return NextResponse.json(
        { error: "버전 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // v1 API 맵: signature → ApiEntry
    // TypeScript Map: Java의 HashMap<String, ApiEntry>과 동일
    const v1Map = new Map(
      v1Snapshots.map(({ apiEntry }) => [
        buildApiSignature(
          apiEntry.className,
          apiEntry.methodName,
          apiEntry.params as string[]
        ),
        apiEntry,
      ])
    );

    const v2Map = new Map(
      v2Snapshots.map(({ apiEntry }) => [
        buildApiSignature(
          apiEntry.className,
          apiEntry.methodName,
          apiEntry.params as string[]
        ),
        apiEntry,
      ])
    );

    // Diff 계산
    const added = [];
    const modified = [];
    const same = [];
    const removed = [];

    // v2 기준 순회: 추가 or 변경 or 동일
    // Array.from()으로 Map 변환: tsconfig target이 ES5일 때 for...of Map 직접 사용 불가
    for (const [sig, v2Api] of Array.from(v2Map)) {
      const v1Api = v1Map.get(sig);
      if (!v1Api) {
        added.push({ signature: sig, api: v2Api });
      } else if (v1Api.returnType !== v2Api.returnType) {
        modified.push({
          signature: sig,
          oldReturnType: v1Api.returnType,
          newReturnType: v2Api.returnType,
          api: v2Api,
        });
      } else {
        same.push({ signature: sig, api: v2Api });
      }
    }

    // v1 기준 순회: 삭제된 것 찾기
    for (const [sig, v1Api] of Array.from(v1Map)) {
      if (!v2Map.has(sig)) {
        removed.push({ signature: sig, api: v1Api });
      }
    }

    console.log(
      `[Diff API] 결과 - 추가: ${added.length}, 삭제: ${removed.length}, 변경: ${modified.length}, 동일: ${same.length}`
    );

    return NextResponse.json({
      v1: { id: v1Id, version: v1Version.version },
      v2: { id: v2Id, version: v2Version.version },
      summary: {
        added: added.length,
        removed: removed.length,
        modified: modified.length,
        same: same.length,
        total: v2Snapshots.length,
      },
      diff: { added, removed, modified, same },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Diff API] 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
