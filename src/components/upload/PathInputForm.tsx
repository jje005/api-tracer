// 경로 입력 폼 컴포넌트 (AAR/JAR & TC 공통)
// 폴더 경로 입력 → 실시간 검증 → 발견된 파일 미리보기
"use client";

import { useState, useCallback } from "react";
import { FolderOpen, CheckCircle2, AlertCircle, RefreshCw, File } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

// ─── 타입 ──────────────────────────────────────────────────────
type ScanType = "AAR_JAR" | "TC";

interface ValidateResult {
  valid: boolean;
  message: string;
  files: Array<{ fileName: string; sizeBytes: number }>;
  totalCount?: number;
}

interface PathInputFormProps {
  type: ScanType;
  onValidated?: (dirPath: string, files: ValidateResult["files"]) => void;
}

export function PathInputForm({ type, onValidated }: PathInputFormProps) {
  const [dirPath, setDirPath] = useState("");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);

  const label = type === "AAR_JAR" ? "AAR / JAR 폴더 경로" : "TC 루트 폴더 경로";
  const placeholder = type === "AAR_JAR"
    ? "ex) D:\\sdk\\release  또는  /home/user/sdk/release"
    : "ex) D:\\project\\src\\test  또는  /home/user/project/src/test";

  // 경로 검증 요청
  const validate = useCallback(async () => {
    if (!dirPath.trim()) return;
    setValidating(true);
    setResult(null);

    console.log(`[PathInputForm] 경로 검증: ${dirPath}`);

    try {
      const res = await fetch("/api/parse/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirPath: dirPath.trim(), type }),
      });
      const data: ValidateResult = await res.json();
      setResult(data);

      if (data.valid) {
        onValidated?.(dirPath.trim(), data.files);
      }
    } catch (e) {
      setResult({ valid: false, message: "서버 연결 오류", files: [] });
      console.error("[PathInputForm] 검증 실패:", e);
    } finally {
      setValidating(false);
    }
  }, [dirPath, type, onValidated]);

  return (
    <div className="space-y-3">
      {/* 경로 입력 */}
      <div>
        <label className="text-sm font-medium block mb-1.5">{label}</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FolderOpen size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={dirPath}
              onChange={(e) => {
                setDirPath(e.target.value);
                setResult(null); // 입력 변경 시 결과 초기화
              }}
              onKeyDown={(e) => e.key === "Enter" && validate()}
              placeholder={placeholder}
              className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            />
          </div>
          <button
            onClick={validate}
            disabled={!dirPath.trim() || validating}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors shrink-0"
          >
            {validating
              ? <RefreshCw size={14} className="animate-spin" />
              : <CheckCircle2 size={14} />
            }
            {validating ? "확인 중..." : "경로 확인"}
          </button>
        </div>
      </div>

      {/* 검증 결과 */}
      {result && (
        <div className={[
          "rounded-md p-3 text-sm",
          result.valid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200",
        ].join(" ")}>
          <div className={`flex items-center gap-2 font-medium ${result.valid ? "text-green-700" : "text-red-700"}`}>
            {result.valid
              ? <CheckCircle2 size={14} />
              : <AlertCircle size={14} />
            }
            {result.message}
            {result.totalCount && result.totalCount > 20 && (
              <span className="font-normal text-xs ml-1">(상위 20개 표시)</span>
            )}
          </div>

          {/* 파일 미리보기 */}
          {result.valid && result.files.length > 0 && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {result.files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-green-600 font-mono">
                  <div className="flex items-center gap-1.5">
                    <File size={11} />
                    <span>{f.fileName}</span>
                  </div>
                  <span className="text-muted-foreground">{formatFileSize(f.sizeBytes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
