"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Maximize, Minimize, ZoomIn, ZoomOut, ExternalLink } from "lucide-react";

interface ImageLightboxProps {
    src: string;
    alt?: string;
    isOpen: boolean;
    onClose: () => void;
}

export function ImageLightbox({ src, alt = "Report Evidence", isOpen, onClose }: ImageLightboxProps) {
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setZoom(1);
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                } else {
                    onClose();
                }
            }
        };

        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };

        window.addEventListener("keydown", handleKeyDown);
        document.addEventListener("fullscreenchange", handleFullscreenChange);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, [isOpen, onClose]);

    if (!isOpen || typeof document === "undefined") return null;

    const toggleBrowserFullscreen = async () => {
        if (!containerRef.current) return;
        try {
            if (!document.fullscreenElement) {
                await containerRef.current.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch {
            // ignore fallback
        }
    };

    const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 4));
    const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 0.5));
    const handleResetZoom = () => setZoom(1);

    return createPortal(
        <div
            ref={containerRef}
            className="fixed inset-0 z-[100000] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between select-none animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Top Toolbar */}
            <div className="w-full px-4 py-3 flex items-center justify-between bg-black/60 border-b border-white/10 z-10 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white/90 max-w-xs sm:max-w-md truncate">
                        {alt}
                    </span>
                    <span className="text-[10px] text-white/40 hidden sm:inline">
                        (Press Esc to exit)
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Zoom controls */}
                    <div className="hidden sm:flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10">
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            disabled={zoom <= 0.5}
                            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors disabled:opacity-30"
                            title="Zoom out"
                        >
                            <ZoomOut className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handleResetZoom}
                            className="px-2 py-1 text-[11px] font-mono text-white/80 hover:text-white"
                            title="Reset zoom"
                        >
                            {Math.round(zoom * 100)}%
                        </button>
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            disabled={zoom >= 4}
                            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors disabled:opacity-30"
                            title="Zoom in"
                        >
                            <ZoomIn className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Browser Native Fullscreen Toggle */}
                    <button
                        type="button"
                        onClick={toggleBrowserFullscreen}
                        className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        title={isFullscreen ? "Exit full screen" : "Toggle full screen"}
                    >
                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </button>

                    {/* Open in new tab */}
                    <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        title="Open image in new tab"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </a>

                    {/* Close Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        title="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Image Center Viewport */}
            <div
                className="flex-1 w-full flex items-center justify-center p-4 overflow-auto"
                onClick={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={src}
                    alt={alt}
                    style={{ transform: `scale(${zoom})` }}
                    className="max-h-[85vh] max-w-[92vw] object-contain rounded-lg shadow-2xl transition-transform duration-150 cursor-pointer"
                    onClick={() => setZoom((prev) => (prev === 1 ? 2 : 1))}
                    title="Click to toggle 2x zoom"
                />
            </div>

            {/* Bottom Caption / Hint */}
            <div className="w-full py-2 text-center text-[11px] text-white/40 bg-black/40 border-t border-white/5 shrink-0">
                Tip: Click image to toggle 2x zoom • Click Fullscreen to expand across your display
            </div>
        </div>,
        document.body
    );
}
