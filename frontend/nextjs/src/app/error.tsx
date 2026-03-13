"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="max-w-md">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">页面加载出错</h2>
        <p className="text-slate-500 mb-1 text-sm">{error.message || "发生了未知错误"}</p>
        {error.digest && (
          <p className="text-xs text-slate-400 font-mono mb-6">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          重试
        </button>
      </div>
    </div>
  );
}
