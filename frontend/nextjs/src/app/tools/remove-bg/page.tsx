"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { UploadCloud, Download, RefreshCw, ArrowLeft } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SIZE_PRESETS, type PresetId } from "@/constants/presets";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Status = "idle" | "processing" | "success";
type BgColor = "transparent" | "white" | "black";

export default function RemoveBgPage() {
  const router = useRouter();
  const { deductPoints, showToast } = useAppContext();
  const [status, setStatus] = useState<Status>("idle");
  const [aspectRatio, setAspectRatio] = useState<PresetId>("original");
  const [bgColor, setBgColor] = useState<BgColor>("transparent");
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setImage(url);
    setStatus("processing");
    setTimeout(async () => {
      try {
        const success = await deductPoints(10);
        if (success) {
          setStatus("success");
        } else {
          router.push("/");
        }
      } catch {
        setStatus("idle");
        setImage(null);
        showToast("网络异常，请重试", "error");
      }
    }, 2000);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (status !== "idle") return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setStatus("idle");
    setImage(null);
    setAspectRatio("original");
    setBgColor("transparent");
  };

  const download = () => {
    const link = document.createElement("a");
    link.href = image || "";
    link.download = "cutout-image.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const aspectRatioClass = SIZE_PRESETS.find((p) => p.id === aspectRatio)?.ratioClass || "aspect-auto";

  const bgColorClass = {
    transparent: "bg-grid-pattern",
    white: "bg-white",
    black: "bg-black",
  }[bgColor];

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col h-full overflow-hidden">
      <div className="mb-4 flex items-center gap-4 shrink-0">
        <button
          onClick={() => router.push("/")}
          className="group flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
          title="返回工作台"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">智能抠图</h1>
          <p className="text-sm text-slate-500 mt-1">精准提取商品主体，支持多尺寸与底色切换</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 pb-4">
        {/* Main Canvas Area */}
        <div className="flex-1 relative rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <div className="h-20 w-20 rounded-full bg-white shadow-sm flex items-center justify-center mb-6 text-indigo-600">
                  <UploadCloud className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-semibold text-slate-700 mb-2">点击或拖拽商品图片至此</h3>
                <p className="text-slate-400 text-sm">支持 JPG, PNG 格式，最大 10MB</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  accept="image/*"
                  className="hidden"
                />
              </motion.div>
            )}

            {status === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-slate-900/10 backdrop-blur-sm z-10"
              >
                {image && (
                  <img src={image} alt="Original" className="absolute inset-0 w-full h-full object-contain opacity-30" />
                )}
                <motion.div
                  className="absolute left-0 right-0 h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]"
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                <div className="relative z-20 bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-indigo-600 animate-spin" />
                  <span className="font-medium text-slate-800">正在精准提取商品主体...</span>
                </div>
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex items-center justify-center p-8 bg-slate-200/50"
              >
                <div className={cn(
                  "relative w-full max-w-full max-h-full flex items-center justify-center shadow-sm transition-all duration-300 overflow-hidden rounded-xl",
                  aspectRatioClass,
                  bgColorClass
                )}>
                  <img src={image!} alt="Cutout result" className="w-full h-full object-contain drop-shadow-xl" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Control Panel */}
        <div className={cn(
          "w-full lg:w-80 flex flex-col gap-4 transition-opacity duration-300 shrink-0",
          status === "success" ? "opacity-100" : "opacity-30 pointer-events-none"
        )}>
          <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-200 shrink-0">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">尺寸预设</h3>
            <div className="grid grid-cols-4 gap-2">
              {SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setAspectRatio(preset.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-xl transition-all border-2",
                    aspectRatio === preset.id
                      ? "border-indigo-600 bg-indigo-50 text-indigo-600 shadow-sm"
                      : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <div className="h-6 flex items-center justify-center">{preset.icon}</div>
                  <span className="text-[10px] font-medium leading-tight text-center">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-200 shrink-0">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">背景底色</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setBgColor("transparent")}
                className={cn(
                  "h-12 rounded-xl border-2 transition-all bg-grid-pattern",
                  bgColor === "transparent" ? "border-indigo-600 ring-2 ring-indigo-600/20" : "border-transparent hover:border-slate-300"
                )}
                title="透明网格"
              />
              <button
                onClick={() => setBgColor("white")}
                className={cn(
                  "h-12 rounded-xl border-2 transition-all bg-white shadow-sm",
                  bgColor === "white" ? "border-indigo-600 ring-2 ring-indigo-600/20" : "border-slate-200 hover:border-slate-300"
                )}
                title="纯白"
              />
              <button
                onClick={() => setBgColor("black")}
                className={cn(
                  "h-12 rounded-xl border-2 transition-all bg-black",
                  bgColor === "black" ? "border-indigo-600 ring-2 ring-indigo-600/20" : "border-transparent hover:border-slate-700"
                )}
                title="纯黑"
              />
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-3 shrink-0 pt-2">
            <button
              onClick={download}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/20"
            >
              <Download className="h-6 w-6" />
              下载高清原图
            </button>
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 bg-white text-slate-700 py-3 rounded-2xl font-medium hover:bg-slate-50 active:scale-[0.98] transition-all ring-1 ring-slate-200"
            >
              <RefreshCw className="h-4 w-4" />
              上传新图片
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
