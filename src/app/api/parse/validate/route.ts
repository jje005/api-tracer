// 경로 유효성 검사 API
// UI에서 경로 입력 시 실시간으로 존재 여부 + 파일 목록을 미리 확인

import { NextRequest, NextResponse } from "next/server";
import { isValidDir, scanAarJarFiles, scanTcFiles } from "@/lib/services/fileSystemService";

/**
 * POST /api/parse/validate
 * Body: { dirPath: string, type: "AAR_JAR" | "TC" }
 *
 * 반환:
 *   valid: boolean
 *   files: 발견된 파일 목록 (미리보기)
 *   message: 안내 메시지
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { dirPath?: string; type?: string };
    const { dirPath, type } = body;

    if (!dirPath || !type) {
      return NextResponse.json({ valid: false, message: "dirPath, type 필드가 필요합니다" });
    }

    console.log(`[Validate API] 경로 검사: ${dirPath} (${type})`);

    // 디렉토리 존재 여부 확인
    if (!isValidDir(dirPath)) {
      return NextResponse.json({
        valid: false,
        message: "경로가 존재하지 않거나 디렉토리가 아닙니다",
        files: [],
      });
    }

    // 타입별 파일 스캔
    const files = type === "AAR_JAR"
      ? await scanAarJarFiles(dirPath)
      : await scanTcFiles(dirPath);

    if (files.length === 0) {
      const ext = type === "AAR_JAR" ? ".aar / .jar" : ".java / .kt";
      return NextResponse.json({
        valid: false,
        message: `해당 경로에서 ${ext} 파일을 찾을 수 없습니다`,
        files: [],
      });
    }

    return NextResponse.json({
      valid: true,
      message: `${files.length}개 파일 발견`,
      // 미리보기: 최대 20개만 반환
      files: files.slice(0, 20).map((f) => ({
        fileName: f.fileName,
        sizeBytes: f.sizeBytes,
      })),
      totalCount: files.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Validate API] 오류:", message);
    return NextResponse.json({ valid: false, message }, { status: 500 });
  }
}
