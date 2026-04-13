// Root Layout - Next.js App Router의 최상위 레이아웃
// Java Spring의 BaseController / 공통 템플릿과 유사한 역할
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { DeletionToast } from "@/components/layout/DeletionToast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "API Coverage Analyzer",
  description: "AAR/JAR API 커버리지 분석 도구",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="flex h-screen bg-background">
          {/* 사이드바 네비게이션 */}
          <Sidebar />
          {/* 메인 콘텐츠 영역 */}
          <main className="flex-1 overflow-auto">
            <div className="p-6">{children}</div>
          </main>
        </div>
        {/* 전역 삭제 진행 알림 — 페이지 이동 무관하게 유지 */}
        <DeletionToast />
      </body>
    </html>
  );
}
