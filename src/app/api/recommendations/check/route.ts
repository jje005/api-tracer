// API 키 설정 여부 확인 — 클라이언트에서 process.env에 직접 접근 불가 문제 해결
// 서버에서만 환경변수 접근 가능 → 이 라우트를 통해 설정 여부 전달
import { NextResponse } from "next/server";

/**
 * GET /api/recommendations/check
 * ANTHROPIC_API_KEY 설정 여부 반환 (키 값 노출 없이 bool만 반환)
 */
export async function GET() {
  return NextResponse.json({
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
  });
}
