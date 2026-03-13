"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "32px", textAlign: "center", fontFamily: "sans-serif" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#0f172a" }}>应用启动失败</h2>
          <p style={{ color: "#64748b", fontSize: "14px" }}>{error.message || "发生了未知错误"}</p>
          {error.digest && (
            <p style={{ color: "#94a3b8", fontSize: "12px", fontFamily: "monospace" }}>Digest: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{ background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "14px", cursor: "pointer" }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
