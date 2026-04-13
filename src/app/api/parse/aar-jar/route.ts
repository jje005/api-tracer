// 경로 기반 AAR/JAR 파싱 API Route
// 브라우저 업로드 없이 서버 파일시스템에서 직접 파싱
// 재파싱: 동일 버전이 이미 있으면 기존 데이터 삭제 후 재처리

import { NextRequest } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { parseAarOrJar, applyExcludeRules } from "@/lib/services/jarParserService";
import { ParseOptions, DEFAULT_PARSE_OPTIONS } from "@/lib/parseOptions";
import { scanAarJarFiles, isValidDir } from "@/lib/services/fileSystemService";
import { apiError, apiSuccess, getErrorMessage } from "@/lib/apiResponse";

/**
 * POST /api/parse/aar-jar
 *
 * Body:
 *   dirPath      - AAR/JAR가 있는 폴더 경로 (필수)
 *   fileName     - 파싱할 파일명 (선택, 없으면 폴더 내 첫 번째 파일)
 *   projectId    - 소속 프로젝트 ID (필수)
 *   moduleName   - 모듈명 (필수)
 *   version      - 버전 문자열 ex) "1.2.0" (필수)
 *   reparse      - true이면 같은 버전 기존 데이터 삭제 후 재파싱
 *   parseOptions - 파싱 옵션 (미지정 시 모듈의 저장된 옵션 또는 기본값 사용)
 */
export async function POST(req: NextRequest) {
  console.log("[Parse AAR-JAR API] 요청 수신");

  try {
    const body = (await req.json()) as {
      dirPath?: string;
      fileName?: string;
      projectId?: string;
      moduleName?: string;
      version?: string;
      reparse?: boolean;
      parseOptions?: Partial<ParseOptions>;
    };

    const { dirPath, fileName, projectId, moduleName, version, reparse = false, parseOptions: requestOptions } = body;

    // 입력값 검증
    if (!dirPath || !projectId || !moduleName || !version) {
      return apiError.badRequest("dirPath, projectId, moduleName, version 필드가 필요합니다");
    }

    if (!isValidDir(dirPath)) {
      return apiError.badRequest("존재하지 않는 디렉토리입니다");
    }

    // 파싱할 파일 결정
    let targetFilePath: string;
    if (fileName) {
      targetFilePath = path.join(dirPath, fileName);
    } else {
      // fileName 미지정 시 디렉토리에서 첫 번째 AAR/JAR 자동 선택
      const scanned = await scanAarJarFiles(dirPath);
      if (scanned.length === 0) {
        return apiError.badRequest("해당 경로에서 .aar/.jar 파일을 찾을 수 없습니다");
      }
      targetFilePath = scanned[0].filePath;
    }

    // 파일 타입 판별
    const ext = path.extname(targetFilePath).toLowerCase();
    const fileType = ext === ".aar" ? "AAR" : ext === ".jar" ? "JAR" : null;
    if (!fileType) {
      return apiError.badRequest(".aar 또는 .jar 파일만 지원합니다");
    }

    console.log(`[Parse AAR-JAR API] 파일: ${targetFilePath}, 버전: ${version}`);

    // 프로젝트 확인
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return apiError.notFound("존재하지 않는 프로젝트입니다");
    }

    // 모듈 upsert — 새 파싱 옵션이 전달된 경우 업데이트
    // parseOptions: requestOptions가 있으면 기존 모듈 옵션과 병합하여 저장
    const module = await prisma.module.upsert({
      where: { projectId_name: { projectId, name: moduleName } },
      update: requestOptions ? { parseOptions: requestOptions } : {},
      create: {
        projectId,
        name: moduleName,
        type: fileType,
        parseOptions: requestOptions ?? DEFAULT_PARSE_OPTIONS,
      },
    });

    // 저장된 파싱 옵션 로드 — 요청 옵션 우선, 없으면 모듈에 저장된 옵션, 없으면 기본값
    const storedOptions = (module.parseOptions as Partial<ParseOptions>) ?? {};
    const resolvedParseOptions: ParseOptions = {
      ...DEFAULT_PARSE_OPTIONS,
      ...storedOptions,
      ...requestOptions,  // 요청 옵션이 최우선
    };
    console.log(`[Parse AAR-JAR API] 적용 파싱 옵션:`, resolvedParseOptions);

    // 재파싱: 기존 버전 데이터 삭제
    if (reparse) {
      const existing = await prisma.moduleVersion.findUnique({
        where: { moduleId_version: { moduleId: module.id, version } },
      });
      if (existing) {
        // ApiSnapshot → ApiEntry도 cascade로 삭제됨
        await prisma.moduleVersion.delete({ where: { id: existing.id } });
        console.log(`[Parse AAR-JAR API] 기존 버전 삭제 완료: ${version}`);
      }
    } else {
      // 중복 버전 확인
      const existing = await prisma.moduleVersion.findUnique({
        where: { moduleId_version: { moduleId: module.id, version } },
      });
      if (existing) {
        return apiError.conflict(`버전 ${version}은 이미 존재합니다. 재파싱하려면 reparse: true를 사용하세요`);
      }
    }

    // 파싱 실행 (resolvedParseOptions 적용)
    console.log(`[Parse AAR-JAR API] 파싱 중...`);
    const parseResult = await parseAarOrJar(targetFilePath, fileType, resolvedParseOptions);

    // ── 제외 규칙 적용 ─────────────────────────────────────────
    // 제외 규칙 적용
    let excludedCount = 0;
    const excludeRules = await prisma.excludeRule.findMany({ where: { projectId } });
    const { filtered: filteredApis, excludedCount: cnt } = applyExcludeRules(
      parseResult.apis,
      excludeRules.map((r) => ({
        type: r.type,
        className: r.className,
        methodName: r.methodName,
        matchParams: r.matchParams,
        params: r.params as string[],
      }))
    );
    excludedCount = cnt;
    if (excludedCount > 0) {
      console.log(`[Parse AAR-JAR API] 제외 규칙 ${excludeRules.length}개 적용 → ${excludedCount}개 API 제외`);
    }
    parseResult.apis = filteredApis;

    // ── 트랜잭션 전 사전 조회 ──────────────────────────────────
    // 루프 안에서 매번 count() 쿼리를 날리면 API 1만 개 기준 1만 번 추가 쿼리 발생
    // → 트랜잭션 전에 한 번에 기존 apiEntry ID를 가져와 Set으로 캐싱
    // Java의 List → Set 변환 패턴과 동일: O(N) 조회 → O(1) 룩업
    const existingEntries = await prisma.apiEntry.findMany({
      where: { moduleId: module.id },
      select: { id: true },
    });
    const existingApiIdSet = new Set(existingEntries.map((e) => e.id));
    console.log(`[Parse AAR-JAR API] 기존 ApiEntry ${existingApiIdSet.size}개 캐싱 완료`);

    // 트랜잭션으로 저장 (타임아웃 60초 — 대용량 JAR 대비)
    const saved = await prisma.$transaction(async (tx) => {
      // 1. ModuleVersion 생성 (dirPath 저장 → 재파싱용)
      const moduleVersion = await tx.moduleVersion.create({
        data: {
          moduleId: module.id,
          version,
          filePath: targetFilePath,
          dirPath,
        },
      });

      // 2. ApiEntry upsert (루프) + 스냅샷 데이터 수집
      let newCount = 0;
      let sameCount = 0;
      // 이미 처리한 id 추적 — 중복 스냅샷 방지
      const processedApiIds = new Set<string>();
      // 스냅샷 페이로드를 메모리에 수집 후 createMany로 일괄 저장
      // Java의 batch insert와 동일한 전략
      const snapshotPayload: Array<{
        moduleVersionId: string;
        apiEntryId: string;
        changeType: "ADDED" | "SAME";
      }> = [];

      for (const api of parseResult.apis) {
        const apiEntry = await tx.apiEntry.upsert({
          where: {
            moduleId_className_methodName_params: {
              moduleId: module.id,
              className: api.className,
              methodName: api.methodName,
              params: api.params,
            },
          },
          update: { returnType: api.returnType, isStatic: api.isStatic, isDeprecated: api.isDeprecated },
          create: {
            moduleId: module.id,
            className: api.className,
            methodName: api.methodName,
            params: api.params,
            returnType: api.returnType,
            isStatic: api.isStatic,
            isDeprecated: api.isDeprecated,
          },
        });

        if (processedApiIds.has(apiEntry.id)) continue;
        processedApiIds.add(apiEntry.id);

        // Set 룩업: 트랜잭션 전 캐싱한 기존 ID로 신규 여부 판별 (DB 쿼리 없음)
        const isNew = !existingApiIdSet.has(apiEntry.id);
        snapshotPayload.push({
          moduleVersionId: moduleVersion.id,
          apiEntryId: apiEntry.id,
          changeType: isNew ? "ADDED" : "SAME",
        });
        isNew ? newCount++ : sameCount++;
      }

      // 3. ApiSnapshot 일괄 저장 — createMany로 단일 INSERT
      // skipDuplicates: unique 충돌 시 에러 없이 무시 (최종 안전망)
      await tx.apiSnapshot.createMany({
        data: snapshotPayload,
        skipDuplicates: true,
      });

      console.log(`[Parse AAR-JAR API] 스냅샷 ${snapshotPayload.length}개 저장 완료`);
      return { moduleVersion, newCount, sameCount };
    }, { timeout: 60_000 }); // 대용량 JAR 대비 60초

    console.log(`[Parse AAR-JAR API] 완료: API ${parseResult.apis.length}개`);

    return apiSuccess.created({
      success: true,
      moduleId: module.id,
      versionId: saved.moduleVersion.id,
      totalApis: parseResult.apis.length,
      excludedApis: excludedCount,
      newApis: saved.newCount,
      sameApis: saved.sameCount,
      totalClasses: parseResult.totalClasses,
      parseErrors: parseResult.errors,
      filePath: targetFilePath,
    });
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[Parse AAR-JAR API] 오류:", message);
    return apiError.internal(message);
  }
}

/**
 * GET /api/parse/aar-jar?dirPath=xxx
 * 경로 내 AAR/JAR 파일 목록 미리보기
 */
export async function GET(req: NextRequest) {
  const dirPath = req.nextUrl.searchParams.get("dirPath");
  if (!dirPath) {
    return apiError.badRequest("dirPath 파라미터가 필요합니다");
  }

  if (!isValidDir(dirPath)) {
    return apiError.badRequest("존재하지 않는 디렉토리입니다");
  }

  const files = await scanAarJarFiles(dirPath);
  return apiSuccess.ok({
    dirPath,
    files: files.map((f) => ({ fileName: f.fileName, filePath: f.filePath, sizeBytes: f.sizeBytes })),
  });
}
