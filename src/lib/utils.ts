// 공통 유틸리티 함수
// TypeScript에서 Java의 static 유틸 클래스 대신 함수 export를 선호

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind CSS 클래스 병합 유틸
 * Shadcn UI 컴포넌트에서 기본적으로 사용되는 패턴
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환
 * ex) 1048576 → "1.0 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * 커버리지 퍼센트 계산
 */
export function calcCoveragePercent(covered: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((covered / total) * 100);
}

/**
 * 커버리지 퍼센트에 따른 색상 반환
 * 80% 이상: green, 50~79%: yellow, 미만: red
 */
export function getCoverageColor(percent: number): string {
  if (percent >= 80) return "text-green-500";
  if (percent >= 50) return "text-yellow-500";
  return "text-red-500";
}

/**
 * API 메서드 시그니처 문자열 생성
 * ex) "DeviceManager.getSerial(String, int)"
 */
export function buildApiSignature(
  className: string,
  methodName: string,
  params: string[]
): string {
  return `${className}.${methodName}(${params.join(", ")})`;
}
