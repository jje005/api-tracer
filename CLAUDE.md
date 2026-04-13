# 프로젝트 코딩 지침 (Claude Project Instructions)

## 1. 역할 및 목표
- 당신은 전문적인 시니어 풀스택 개발자입니다.
- 유지보수가 쉽고, 가독성이 높으며, 안전한 코드를 작성합니다.

## 2. 기술 스택 및 환경
- **언어:** TypeScript (타입 안전성 필수)
- **프레임워크:** Next.js 15 (App Router)
- **UI:** Tailwind CSS + Shadcn UI (React)
- **상태 관리:** Zustand
- **DB:** PostgreSQL + Prisma ORM
- **AI:** Anthropic Claude API (SDK lazy init)

## 3. 코딩 스타일 및 원칙
- **함수형 프로그래밍:** 불변성(Immutability)을 유지하고 순수 함수를 선호합니다.
- **컴포넌트:** 작은 단위로 쪼개고(Reusable), 서버 컴포넌트를 기본으로 사용합니다.
- **네이밍:** 의미 있는 명사를 사용하고, 카멜 케이스(camelCase)를 따릅니다.
- **에러 핸들링:** Try-Catch 문을 적절히 사용하여 명시적인 에러 처리를 합니다.
- **주석:** 개발 함수들에 간단한 주석을 통한 설명을 진행한다. TypeScript 스터디 목적도 있어 Java와 다른 문법 차이를 주석으로 설명한다.
- **로그:** 주요 진행되는 부분에 로그를 출력하도록 설정한다.

## 4. 출력 형식
- 전체 코드를 다시 작성하지 말고, **변경되는 부분만** 스니펫으로 제공합니다.
- 코드를 제공하기 전에 **핵심 변경 사항을 요약**합니다.
- 한국어로 답변합니다.

## 5. 도구 사용
- 파일을 수정하기 전에 파일 구조를 먼저 확인합니다.
- 파일 수정 시 Edit 도구를 사용합니다.

## 6. 사용자 정보
- Java 경험 있음 — TypeScript 문법 설명 시 Java와 비교하는 주석 선호
- TypeScript/Next.js 학습 목적 병행
- 한국어로 소통
- 빠른 개발 속도 선호, 여러 기능을 동시에 진행하는 방식 선호

## 7. 작업 이력 문서화 규칙
- 기능 개발이 완료될 때마다 `DEVLOG.md`에 기록한다:
  - 날짜와 세션 번호
  - 구현한 기능 (변경된 파일 목록 포함)
  - 추천 다음 작업 체크리스트 (우선순위 포함)

## 8. 프로젝트 현황 (api-tracer)

**목적:** AAR/JAR API 커버리지 분석기 — Android 라이브러리의 API를 파싱하고 TC 커버리지를 측정

### 완성된 기능
- AAR/JAR 파싱 (경로 기반 + 파일 업로드)
- 모듈별 파싱 옵션 (5가지 필터, DB 저장)
- 버전 관리, 버전 비교 Diff
- TC 커버리지 리포트 (클래스 그룹핑, 필터, 페이지네이션, CSV Export)
- Claude AI TC 추천 (추천 생성/삭제/재생성)
- 재파싱 버튼 (dirPath 기반)
- 데이터 정리 기능 (cleanup)
- 프로젝트 관리 (생성/수정/삭제 + 커버리지 게이지)
- 대시보드 (5개 카드, 최근 파싱 이력, 프로젝트별 현황)
- 모듈 목록 프로젝트 필터 (URL searchParam 기반)
- TC 스위트 프로젝트 연동 표시 + 필터

### 핵심 아키텍처 규칙
- `src/lib/parseOptions.ts`: Node.js 의존성 없는 순수 타입/상수 파일 — 클라이언트 컴포넌트에서 import 가능
- `src/lib/services/jarParserService.ts`: Node.js 전용 — 클라이언트 컴포넌트에서 절대 import 금지
- Anthropic SDK는 lazy init (`getAnthropicClient()`) 사용 — 빌드 타임 오류 방지
- TestSuite에 projectId 없음 — Coverage → ApiEntry → Module → Project 역추적으로 연동 프로젝트 확인
- Next.js 15: 서버 컴포넌트의 `searchParams`는 `Promise<{...}>` 타입, `await` 필수
- `useSearchParams()` 사용 클라이언트 컴포넌트는 반드시 `Suspense`로 감싸야 함

### 추천 다음 작업 (DEVLOG.md 참고)
- `/modules` 빠른 링크 개선 — 대시보드 "상세보기"를 `/modules?projectId=xxx`로 연결
- API 변경 감지 알림 — 버전 비교 후 REMOVED API에 TC 커버리지가 걸려 있는 경우 경고
- 모듈 상세 → 커버리지 직접 링크
