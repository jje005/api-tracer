# 개발 이력 (DEVLOG)

이 문서는 세션별 주요 변경 사항을 기록합니다.  
각 세션 종료 시 작업 내용, 변경 파일, 추천 다음 작업을 기록합니다.

---

## 2026-04-10 — 세션 3

### 작업 내용

#### 1. `prisma as any` 타입 캐스팅 전면 제거
- `npx prisma generate` 성공 확인 후 Prisma Client 타입 정상화
- **변경 파일 (6개)**:
  - `src/app/api/modules/[moduleId]/route.ts` — `module.findUnique`, `module.update`
  - `src/app/api/parse/aar-jar/route.ts` — `module.upsert`, `excludeRule.findMany` + `r: any` 제거
  - `src/app/api/upload/aar-jar/route.ts` — `module.upsert`, `excludeRule.findMany` + `r: any` 제거
  - `src/app/api/projects/[projectId]/exclude-rules/route.ts` — `excludeRule.findMany`, `excludeRule.create`
  - `src/app/api/projects/[projectId]/exclude-rules/[ruleId]/route.ts` — `excludeRule.update`, `excludeRule.delete`
  - `src/app/modules/[moduleId]/page.tsx` — `module.findUnique`
- Prisma Client 미갱신 대비용 try/catch 방어 코드도 함께 정리

#### 2. 모듈 목록 프로젝트 필터
- **신규 파일**: `src/components/modules/ProjectFilter.tsx`
  - `useRouter` + `useSearchParams` 로 URL searchParam 갱신
  - `Suspense` 경계 안에서 렌더링 (Next.js 15 요구사항)
- **변경**: `src/app/modules/page.tsx`
  - `searchParams.projectId` 수신 → Prisma `where: { projectId }` 필터 적용
  - 프로젝트 목록 + 모듈 목록 `Promise.all` 병렬 조회
  - 프로젝트가 2개 이상일 때만 필터 드롭다운 표시
  - 빈 상태 메시지 분기 ("선택한 프로젝트에 모듈이 없습니다" vs "등록된 모듈이 없습니다")

#### 3. TC 파싱 페이지 개선
- **변경**: `src/app/api/parse/tc/route.ts` — `GET` 핸들러 개선
  - 프로젝트 필터(`?projectId=xxx`) 지원 — Prisma nested WHERE EXISTS로 구현
  - 스위트별 연동 프로젝트 역추적: Coverage → ApiEntry → Module → Project
  - N+1 방지: 모든 스위트의 coverage를 한 번에 조회 후 클라이언트 측 Map으로 그룹핑
  - 응답에 `project: { id, name } | null` 필드 추가
- **변경**: `src/app/tc/page.tsx`
  - 스위트 카드에 연동 프로젝트 배지 표시 (Coverage 역추적 결과)
  - 오른쪽 스위트 목록에 프로젝트 필터 드롭다운 추가
  - `handleReparse` 개선: `suite.project.id`를 우선 사용 (기존엔 left-panel selectedProjectId 사용)
  - 최초 로드 후 `tcPath` 리셋 추가 (폼 초기화)
  - Enter 키로 TC 분석 시작 (suiteName input)

---

## 2026-04-09 — 세션 2

### 작업 내용

#### 1. 모듈별 파싱 옵션 (DB 저장)
- Prisma schema: `Module.parseOptions Json @default("{}")` 추가
- 마이그레이션: `20260409060149_add_module_parse_options`
- `src/lib/parseOptions.ts` 신규 — Node.js 의존성 없는 순수 타입/상수 파일
- `ModuleActions.tsx` — 파싱 옵션 UI 패널 (5개 체크박스 + 저장)
- `src/app/api/modules/[moduleId]/route.ts` PATCH — `parseOptions` 업데이트 지원

#### 2. Claude AI TC 추천
- `src/app/api/recommendations/route.ts` — 미커버 API → Claude API 호출 → Recommendation 저장
- `src/app/api/recommendations/check/route.ts` — API 키 유무 확인 (클라이언트용)
- `src/app/recommendations/page.tsx` — 모듈별 추천 생성/조회/삭제 UI

#### 3. 재파싱 버튼
- `ModuleActions.tsx` — `handleReparse()`: 최신 버전 `dirPath` 사용, `/api/parse/aar-jar` 호출
- `ModuleActionsProps` — `projectId`, `versions[].dirPath` 필드 추가

#### 4. 커버리지 CSV Export
- `src/app/api/coverage/export/route.ts` — UTF-8 BOM CSV, RFC4180 이스케이핑
- `src/app/coverage/page.tsx` — "CSV 내보내기" 버튼

#### 5. 프로젝트 관리 페이지 강화
- `src/app/api/projects/route.ts` GET — `coveragePercent`, `lastParsedAt` 포함
- `src/app/projects/page.tsx` — 커버리지 게이지 바, 마지막 파싱일, 빠른 링크

#### 6. 대시보드 강화
- `src/app/page.tsx` — 5번째 카드 "미커버 API", 최근 파싱 이력, 프로젝트별 현황 게이지

---

## 2026-04-08 — 세션 1

### 초기 구조 완성

- Next.js 15 + Prisma + PostgreSQL 기반 프로젝트 셋업
- AAR/JAR 파싱 (경로 기반 + 파일 업로드)
- 버전 관리 (버전별 삭제)
- 버전 비교 Diff 페이지
- TC 커버리지 리포트 (클래스 그룹핑, 필터, 페이지네이션)
- TC 스위트 관리 (등록/재파싱/삭제)
- 제외 규칙 (ExcludeRule) 관리

---

## 추천 다음 작업 (우선순위 순)

### 🔴 핵심 기능
- [ ] **`/modules` 빠른 링크 개선** — 대시보드 "상세보기"를 `/modules?projectId=xxx` 로 연결
- [ ] **API 변경 감지 알림** — 버전 비교 후 REMOVED API에 TC 커버리지가 걸려 있는 경우 경고 표시
- [ ] **모듈 상세 → 커버리지 직접 링크** — 모듈 상세 페이지에서 해당 모듈 커버리지로 바로가기

### 🟡 UX 개선
- [ ] **대시보드 "상세보기" → 프로젝트 필터 적용 링크** — 현재 `/modules`로만 연결
- [ ] **커버리지 Export 옵션** — 미커버만 / 전체 선택 라디오 추가
- [ ] **TC 추천 페이지 프로젝트 필터** — 전체 모듈 나열 시 프로젝트별 그룹핑
- [ ] **파싱 진행 상태 표시** — 대용량 AAR 파싱 시 진행률 또는 로딩 오버레이

### 🟢 기술 부채
- [ ] **에러 바운더리** — 클라이언트 컴포넌트 전반에 React Error Boundary 적용
- [ ] **API Route 응답 타입 통일** — 일부 route는 `{ error }`, 일부는 `{ message }` 혼용 → 공통 응답 타입 정의
