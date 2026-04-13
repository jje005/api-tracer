import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 사이드에서 Node.js 네이티브 모듈 사용을 위한 설정
  // Next.js 15에서는 serverExternalPackages가 stable API로 승격됨
  serverExternalPackages: ["java-class-tools", "yauzl"],
};

export default nextConfig;
