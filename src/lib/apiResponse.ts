// API 응답 공통 헬퍼 — 모든 API route에서 일관된 응답 형식을 사용하기 위한 유틸
// Java의 ResponseEntity<T>와 유사한 개념
// NextResponse.json() 래퍼로, 상태 코드와 응답 바디를 한 번에 처리

import { NextResponse } from "next/server";

// ─── 공통 타입 정의 ────────────────────────────────────────────────

/** 에러 응답 타입 — 모든 에러는 { error: string } 구조 */
export type ApiErrorBody = { error: string };

/** 성공 응답 타입 — 제네릭으로 실제 데이터 타입 지정 */
export type ApiSuccessBody<T> = T;

// ─── 에러 응답 헬퍼 ────────────────────────────────────────────────

/**
 * 400 Bad Request — 요청 파라미터 누락 또는 잘못된 값
 * @example apiError.badRequest("moduleId가 필요합니다")
 */
export const apiError = {
  badRequest: (message: string) =>
    NextResponse.json<ApiErrorBody>({ error: message }, { status: 400 }),

  /** 404 Not Found — 리소스가 존재하지 않음 */
  notFound: (message: string) =>
    NextResponse.json<ApiErrorBody>({ error: message }, { status: 404 }),

  /** 409 Conflict — 이미 존재하거나 상태 충돌 */
  conflict: (message: string) =>
    NextResponse.json<ApiErrorBody>({ error: message }, { status: 409 }),

  /** 500 Internal Server Error — 서버/DB/파싱 오류 */
  internal: (message: string) =>
    NextResponse.json<ApiErrorBody>({ error: message }, { status: 500 }),

  /** 502 Bad Gateway — 외부 API(Claude 등) 오류 */
  badGateway: (message: string) =>
    NextResponse.json<ApiErrorBody>({ error: message }, { status: 502 }),
};

// ─── 성공 응답 헬퍼 ────────────────────────────────────────────────

/**
 * 200 OK — 조회 성공 (GET)
 * @example apiSuccess.ok(data)
 */
export const apiSuccess = {
  ok: <T>(data: T) =>
    NextResponse.json<ApiSuccessBody<T>>(data, { status: 200 }),

  /** 201 Created — 리소스 생성 성공 (POST) */
  created: <T>(data: T) =>
    NextResponse.json<ApiSuccessBody<T>>(data, { status: 201 }),
};

// ─── 에러 메시지 추출 헬퍼 ─────────────────────────────────────────

/**
 * unknown 타입 에러에서 메시지 문자열 추출
 * Java의 e.getMessage()와 동일한 역할
 * try-catch의 catch(e)는 TypeScript에서 unknown 타입 → 타입 가드 필요
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
