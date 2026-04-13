// 모듈 목록 프로젝트 필터 — 클라이언트 컴포넌트
// URL searchParam을 통해 서버 컴포넌트(ModulesPage)에 필터 값 전달
// Java의 form GET 요청과 유사: URL 변경 → 서버 재렌더링
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FolderOpen } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface ProjectFilterProps {
  projects: Project[];
  selectedId: string;
}

export function ProjectFilter({ projects, selectedId }: ProjectFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (projectId: string) => {
    // URLSearchParams 불변 처리: Java의 new HashMap<>(existing)과 유사
    const params = new URLSearchParams(searchParams.toString());
    if (projectId) {
      params.set("projectId", projectId);
    } else {
      params.delete("projectId");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <FolderOpen size={14} className="text-muted-foreground shrink-0" />
      <label className="text-sm font-medium shrink-0">프로젝트</label>
      <select
        value={selectedId}
        onChange={(e) => handleChange(e.target.value)}
        className="border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">전체</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
