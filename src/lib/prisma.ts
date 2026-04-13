// Prisma Client 싱글톤
// Java의 싱글톤 패턴과 유사하나, Next.js dev 환경에서 Hot Reload 시
// 매번 새 인스턴스가 생기는 문제를 globalThis로 방지

import { PrismaClient } from "@prisma/client";

// TypeScript에서 globalThis에 커스텀 프로퍼티를 추가하려면 declare 필요
// Java의 static 필드와 개념적으로 유사
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query", "error", "warn"], // 개발 환경에서 쿼리 로그 출력
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
