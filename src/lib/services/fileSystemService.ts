// 파일시스템 유틸 서비스
// 경로 검증, 파일 목록 스캔 등 공통 FS 작업을 담당
// Node.js fs/promises 모듈: Java의 java.nio.file.Files와 유사

import fs from "fs";
import path from "path";
import { readdir, stat } from "fs/promises";

export interface ScannedFile {
  filePath: string;   // 절대 경로
  fileName: string;   // 파일명만
  ext: string;        // 확장자 (.java, .kt, .aar 등)
  sizeBytes: number;
}

/**
 * 경로가 존재하는 디렉토리인지 확인
 */
export function isValidDir(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 경로가 존재하는 파일인지 확인
 */
export function isValidFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * 디렉토리에서 특정 확장자 파일을 재귀 스캔
 * Java의 Files.walk()와 유사
 *
 * @param dirPath  스캔할 루트 디렉토리 절대 경로
 * @param exts     찾을 확장자 배열 ex) [".java", ".kt"]
 * @param maxDepth 최대 탐색 깊이 (기본 10)
 */
export async function scanFiles(
  dirPath: string,
  exts: string[],
  maxDepth = 10
): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];

  // 내부 재귀 함수
  // TypeScript의 내부 함수: Java의 private 중첩 메서드와 유사
  async function walk(currentPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await readdir(currentPath, { withFileTypes: true });
    } catch {
      console.warn(`[FileSystem] 접근 불가: ${currentPath}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // node_modules, .git, build 등 제외
        if (shouldSkipDir(entry.name)) continue;
        await walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!exts.includes(ext)) continue;

        try {
          const info = await stat(fullPath);
          results.push({
            filePath: fullPath,
            fileName: entry.name,
            ext,
            sizeBytes: info.size,
          });
        } catch {
          // 파일 stat 실패 시 스킵
        }
      }
    }
  }

  await walk(dirPath, 0);
  console.log(`[FileSystem] 스캔 완료: ${dirPath} → ${results.length}개 (${exts.join(",")})`);
  return results;
}

/**
 * 스킵할 디렉토리명 판별
 * 빌드 산출물, 의존성 폴더 등 제외
 */
function shouldSkipDir(name: string): boolean {
  const skipList = new Set([
    "node_modules", ".git", ".gradle", ".idea",
    "build", "out", "dist", ".next", "target",
    "__pycache__", ".DS_Store",
  ]);
  return skipList.has(name) || name.startsWith(".");
}

/**
 * 디렉토리에서 AAR/JAR 파일 목록 스캔 (1단계 깊이만, 재귀 불필요)
 */
export async function scanAarJarFiles(dirPath: string): Promise<ScannedFile[]> {
  return scanFiles(dirPath, [".aar", ".jar"], 3);
}

/**
 * 디렉토리에서 Java/Kotlin TC 파일 재귀 스캔
 */
export async function scanTcFiles(dirPath: string): Promise<ScannedFile[]> {
  return scanFiles(dirPath, [".java", ".kt"], 10);
}
