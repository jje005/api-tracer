// 사이드바 네비게이션 컴포넌트
// Next.js의 'use client': 브라우저 이벤트(usePathname 등) 사용 시 필요
// Java Spring MVC의 타임리프 레이아웃과 달리 컴포넌트 단위로 클라이언트/서버 분리
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Boxes,
  GitCompare,
  FlaskConical,
  BarChart3,
  Lightbulb,
  FolderCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

// 네비게이션 메뉴 정의
// TypeScript readonly 배열: 런타임에 변경 불가 (Java의 final List와 유사)
const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/upload", label: "파일 업로드", icon: Upload },
  { href: "/modules", label: "API 목록", icon: Boxes },
  { href: "/diff", label: "버전 비교", icon: GitCompare },
  { href: "/tc", label: "TC 관리", icon: FlaskConical },
  { href: "/coverage", label: "커버리지", icon: BarChart3 },
  { href: "/recommendations", label: "TC 추천", icon: Lightbulb },
  { href: "/projects", label: "프로젝트 관리", icon: FolderCog },
] as const;

export function Sidebar() {
  // usePathname: 현재 URL 경로 반환 (Java의 HttpServletRequest.getRequestURI와 유사)
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r bg-card flex flex-col shrink-0">
      {/* 헤더 */}
      <div className="p-5 border-b">
        <h1 className="font-bold text-base leading-tight">
          API Coverage
          <br />
          <span className="text-muted-foreground font-normal text-sm">
            Analyzer
          </span>
        </h1>
      </div>

      {/* 메뉴 목록 */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* 하단 Phase 표시 */}
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground">Phase 1 — MVP</p>
      </div>
    </aside>
  );
}
