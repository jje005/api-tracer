// 모듈 목록 페이지 (서버 컴포넌트) — 프로젝트 필터 + 그룹핑
// searchParams.projectId가 있으면 해당 프로젝트의 모듈만 표시
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import { Boxes, ChevronRight, FolderOpen, Package, Package2 } from "lucide-react";
import { ModuleDeleteButton } from "@/components/modules/ModuleDeleteButton";
import { ProjectFilter } from "@/components/modules/ProjectFilter";

export const dynamic = "force-dynamic";

// Next.js 15: searchParams도 Promise
interface PageProps {
  searchParams: Promise<{ projectId?: string }>;
}

async function getModulesData(projectId?: string) {
  console.log(`[Modules Page] 모듈 목록 조회, projectId=${projectId ?? "전체"}`);

  // 프로젝트 목록 + 모듈 목록 병렬 조회
  const [projects, modules] = await Promise.all([
    prisma.project.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    prisma.module.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { apis: true } },
        versions: { orderBy: { parsedAt: "desc" }, take: 1 },
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  // 프로젝트별 그룹핑: Map<projectId, { name, modules[] }>
  // TypeScript Map: Java의 LinkedHashMap과 유사 — 삽입 순서 보장
  const grouped = new Map<string, { projectName: string; modules: typeof modules }>();
  for (const module of modules) {
    const { id, name } = module.project;
    if (!grouped.has(id)) grouped.set(id, { projectName: name, modules: [] });
    grouped.get(id)!.modules.push(module);
  }

  return { projects, grouped };
}

export default async function ModulesPage({ searchParams }: PageProps) {
  const { projectId } = await searchParams;
  const { projects, grouped } = await getModulesData(projectId);
  const totalModules = [...grouped.values()].reduce((sum, g) => sum + g.modules.length, 0);

  return (
    <div className="space-y-6">
      {/* 헤더 + 필터 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">API 목록</h2>
          <p className="text-muted-foreground mt-1">파싱된 모듈과 API 목록을 확인합니다</p>
        </div>

        {/* 프로젝트 필터 드롭다운 — useSearchParams() 사용으로 Suspense 필요 */}
        {projects.length > 1 && (
          <Suspense fallback={null}>
            <ProjectFilter projects={projects} selectedId={projectId ?? ""} />
          </Suspense>
        )}
      </div>

      {totalModules === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Boxes size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">
            {projectId ? "선택한 프로젝트에 모듈이 없습니다" : "등록된 모듈이 없습니다"}
          </p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            AAR 또는 JAR 파일을 업로드하면 자동으로 API가 파싱됩니다
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
          >
            파일 업로드
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([pid, { projectName, modules }]) => (
            <div key={pid}>
              {/* 프로젝트 헤더 */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                <FolderOpen size={16} className="text-muted-foreground" />
                <h3 className="font-semibold text-sm">{projectName}</h3>
                <span className="text-xs text-muted-foreground ml-1">모듈 {modules.length}개</span>
              </div>

              {/* 모듈 카드 목록 */}
              <div className="grid gap-2">
                {modules.map((module) => (
                  <Link
                    key={module.id}
                    href={`/modules/${module.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border hover:shadow-sm transition-shadow bg-card"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-md bg-secondary">
                        {module.type === "AAR"
                          ? <Package size={18} className="text-blue-500" />
                          : <Package2 size={18} className="text-purple-500" />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{module.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                            {module.type}
                          </span>
                          {module.versions[0] && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                              v{module.versions[0].version}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">API {module._count.apis}개</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <ChevronRight size={16} className="text-muted-foreground" />
                      <ModuleDeleteButton moduleId={module.id} moduleName={module.name} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
