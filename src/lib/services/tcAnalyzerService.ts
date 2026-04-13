// TC 분석 서비스
// Java/Kotlin 소스 파일을 파싱하여 어떤 API를 호출하는지 추출
// 정규식 기반 정적 분석: 컴파일 없이 텍스트 레벨에서 메서드 호출 패턴 탐지

import fs from "fs";
import path from "path";
import type { ScannedFile } from "./fileSystemService";

// ─── 타입 정의 ────────────────────────────────────────────────
export interface ParsedTestCase {
  name: string;          // 파일명 (확장자 제외)
  filePath: string;      // 절대 경로
  language: "JAVA" | "KOTLIN";
  calledApis: string[];  // 탐지된 API 호출 패턴 ["ClassName.methodName", ...]
  content: string;       // 파일 전체 텍스트
}

export interface TcAnalyzeResult {
  testCases: ParsedTestCase[];
  totalFiles: number;
  errors: string[];
}

// ─── TC 파일 파싱 진입점 ──────────────────────────────────────
/**
 * 스캔된 TC 파일 목록을 파싱하여 호출 API 목록을 추출
 *
 * @param files fileSystemService.scanTcFiles()의 결과
 */
export async function analyzeTcFiles(files: ScannedFile[]): Promise<TcAnalyzeResult> {
  console.log(`[TcAnalyzer] 분석 시작: ${files.length}개 파일`);

  const testCases: ParsedTestCase[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const tc = parseTcFile(file);
      testCases.push(tc);
    } catch (e) {
      const msg = `${file.fileName} 파싱 실패: ${e instanceof Error ? e.message : String(e)}`;
      errors.push(msg);
      console.warn(`[TcAnalyzer] ${msg}`);
    }
  }

  console.log(`[TcAnalyzer] 완료: TC ${testCases.length}개, 오류 ${errors.length}개`);
  return { testCases, totalFiles: files.length, errors };
}

// ─── 단일 TC 파일 파싱 ────────────────────────────────────────
/**
 * 단일 Java/Kotlin 파일을 읽어 호출된 API 패턴을 추출
 *
 * 탐지 전략:
 * 1. @Test 어노테이션이 있는 메서드만 대상
 * 2. "ClassName.methodName(" 패턴을 정규식으로 추출
 * 3. 대문자로 시작하는 클래스명만 인정 (변수명 제외)
 */
function parseTcFile(file: ScannedFile): ParsedTestCase {
  // 파일 읽기: Node.js readFileSync = Java의 Files.readString()
  const content = fs.readFileSync(file.filePath, "utf-8");
  const language: "JAVA" | "KOTLIN" = file.ext === ".kt" ? "KOTLIN" : "JAVA";

  const calledApis = extractCalledApis(content, language);
  const name = path.basename(file.fileName, file.ext);

  return {
    name,
    filePath: file.filePath,
    language,
    calledApis,
    content,
  };
}

// ─── API 호출 패턴 추출 ───────────────────────────────────────
/**
 * 소스 코드에서 "ClassName.methodName(" 패턴을 추출
 *
 * TypeScript의 정규식: Java의 Pattern/Matcher와 동일한 역할
 * /g 플래그: Java의 Matcher.find() 루프와 동일 (모든 매칭 찾기)
 */
function extractCalledApis(content: string, _language: "JAVA" | "KOTLIN"): string[] {
  const apiSet = new Set<string>();

  // 패턴 1: ClassName.methodName( 형태
  // 대문자로 시작하는 클래스명 + 점 + 소문자로 시작하는 메서드명
  // ex) DeviceManager.getSerial(), NetworkManager.connect(host)
  const directCallPattern = /\b([A-Z][a-zA-Z0-9_]*)\s*\.\s*([a-z][a-zA-Z0-9_]*)\s*\(/g;
  let match: RegExpExecArray | null;

  // Java의 while ((m = matcher.find())) 패턴과 동일
  while ((match = directCallPattern.exec(content)) !== null) {
    const className = match[1];
    const methodName = match[2];

    // 일반적인 Java/Android 클래스 제외 (너무 광범위한 매칭 방지)
    if (shouldSkipClass(className)) continue;

    apiSet.add(`${className}.${methodName}`);
  }

  // 패턴 2: 변수를 통한 호출도 클래스 타입 선언에서 추출
  // ex) DeviceManager dm = ...; dm.getSerial() → DeviceManager.getSerial
  const varDeclPattern = /\b([A-Z][a-zA-Z0-9_]*)\s+([a-z][a-zA-Z0-9_]*)\s*[=;(]/g;
  const varTypeMap = new Map<string, string>(); // varName → ClassName

  while ((match = varDeclPattern.exec(content)) !== null) {
    const typeName = match[1];
    const varName = match[2];
    if (!shouldSkipClass(typeName)) {
      varTypeMap.set(varName, typeName);
    }
  }

  // 변수명.메서드명( 패턴에서 타입 역추적
  const varCallPattern = /\b([a-z][a-zA-Z0-9_]*)\s*\.\s*([a-z][a-zA-Z0-9_]*)\s*\(/g;
  while ((match = varCallPattern.exec(content)) !== null) {
    const varName = match[1];
    const methodName = match[2];
    const className = varTypeMap.get(varName);
    if (className) {
      apiSet.add(`${className}.${methodName}`);
    }
  }

  return Array.from(apiSet);
}

/**
 * 매핑에서 제외할 일반 Java/Android/Kotlin 클래스명
 * 프로젝트 고유 SDK 클래스만 추출하기 위함
 */
function shouldSkipClass(className: string): boolean {
  const skipClasses = new Set([
    // Java 기본
    "String", "Integer", "Long", "Boolean", "Double", "Float",
    "Object", "Class", "System", "Math", "Arrays", "Collections",
    "List", "Map", "Set", "ArrayList", "HashMap", "HashSet",
    "Optional", "Stream", "StringBuilder", "StringBuffer",
    "Thread", "Runnable", "Exception", "RuntimeException",
    // Android
    "Context", "Activity", "Fragment", "Intent", "Bundle",
    "View", "TextView", "Button", "Log", "Toast",
    // Kotlin
    "Unit", "Any", "Nothing", "Pair", "Triple",
    // JUnit / Mockito
    "Assert", "Assertions", "Mockito", "Matchers", "ArgumentCaptor",
    "Mock", "Spy", "InjectMocks",
    // 테스트 프레임워크
    "Test", "Before", "After", "BeforeEach", "AfterEach",
    "Given", "When", "Then",
  ]);
  return skipClasses.has(className);
}

// ─── DB 저장용 API 매핑 ───────────────────────────────────────
/**
 * TC에서 추출한 calledApis와 DB의 ApiEntry를 매핑
 * "ClassName.methodName" 형태로 비교
 *
 * @param calledApis TC에서 추출한 API 호출 목록
 * @param allApis    DB에서 가져온 ApiEntry 목록
 * @returns 매핑된 ApiEntry id 목록
 */
export function matchApisToEntries(
  calledApis: string[],
  allApis: Array<{ id: string; className: string; methodName: string }>
): string[] {
  // 빠른 조회를 위해 Map 구성: "SimpleClass.method" → apiId[]
  // Java의 HashMap<String, List<String>>과 동일
  const apiMap = new Map<string, string[]>();

  for (const api of allApis) {
    // 풀 패키지명에서 마지막 클래스명만 추출 (패키지 제거)
    const simpleClass = api.className.split(".").pop() ?? api.className;
    const key = `${simpleClass}.${api.methodName}`;
    const existing = apiMap.get(key) ?? [];
    existing.push(api.id);
    apiMap.set(key, existing);
  }

  const matched = new Set<string>();
  for (const called of calledApis) {
    const ids = apiMap.get(called);
    if (ids) ids.forEach((id) => matched.add(id));
  }

  return Array.from(matched);
}
