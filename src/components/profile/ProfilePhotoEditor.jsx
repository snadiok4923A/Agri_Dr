import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { decodeOriented } from "../../lib/profileService";
import { Minus, Plus } from "lucide-react";
import "./ProfilePhotoEditor.css";

/**
 * ProfilePhotoEditor — WhatsApp-style circular avatar editor (step 2 of
 * the avatar flow: select → EDIT → Use Photo → compress once → upload).
 *
 * PRESENTATION ONLY: it hands the RAW CROPPED square file back through
 * onConfirm; the existing compressImage() in profileService.js runs AFTER
 * the crop (crop first, compress ONCE — the upload pipeline is unchanged).
 *
 * The preview is a <canvas> painted with the SAME transforms the final
 * crop uses (cover-scale × zoom, pan offset, DPR-aware) — what the user
 * sees inside the circle is pixel-for-pixel what gets generated.
 *
 * Interaction: drag to pan (pointer events, mouse + touch), zoom slider,
 * −/+ buttons, pinch-zoom on touch, wheel-zoom on desktop. Everything
 * outside the circular crop is dimmed so the visible result is obvious.
 */
export default function ProfilePhotoEditor({ file, onConfirm, onCancel }) {
    const { t } = useLanguage();
    const [src, setSrc] = useState(null); // oriented ImageBitmap | HTMLImageElement
    const [zoom, setZoom] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 }); // pan offset, CSS px
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const stageRef = useRef(null);
    const canvasRef = useRef(null);
    const dragRef = useRef(null);
    const pinchRef = useRef(null);

    /* Decode ONCE with EXIF orientation applied (same decode the pipeline
     * used — the bitmap is reused for both preview and final crop). */
    useEffect(() => {
        let alive = true;
        let bitmap = null;
        decodeOriented(file)
            .then((img) => {
                bitmap = img;
                if (alive) setSrc(img);
                else bitmap?.close?.();
            })
            .catch(() => alive && setFailed(true));
        return () => {
            alive = false;
            bitmap?.close?.();
        };
    }, [file]);

    /* Stage size (the circular crop is the inscribed circle). */
    const [stage, setStage] = useState(0);
    useEffect(() => {
        const el = stageRef.current;
        if (!el) return undefined;
        const measure = () => setStage(el.clientWidth);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [failed]);

    const imageW = src?.width || src?.naturalWidth || 0;
    const imageH = src?.height || src?.naturalHeight || 0;

    /* Zoom range: 1 = image exactly covers the circle (no gaps), up to 5×. */
    const baseScale = useMemo(
        () => (stage && imageW && imageH ? (2 * stage) / (imageW + imageH) : 1),
        [stage, imageW, imageH],
    );
    const MIN_ZOOM = 1;
    const MAX_ZOOM = 5;

    /* Clamp pan so the crop circle always stays covered by the image. */
    const clampPos = (p, z) => {
        if (!stage) return p;
        const s = baseScale * z;
        const half = Math.max((imageW * s) / 2, (imageH * s) / 2);
        const lim = Math.max(0, half - stage / 2);
        return {
            x: Math.max(-lim, Math.min(lim, p.x)),
            y: Math.max(-lim, Math.min(lim, p.y)),
        };
    };

    useEffect(() => {
        setPos((p) => clampPos(p, zoom));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stage, zoom, baseScale]);

    /* ------------- live preview painting (same math as the crop) ---------- */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !src || !stage) return undefined;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const size = Math.max(1, Math.round(stage * dpr));
        if (canvas.width !== size) {
            canvas.width = size;
            canvas.height = size;
        }
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        const s = baseScale * zoom * dpr;
        const w = imageW * s;
        const h = imageH * s;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(src, size / 2 + pos.x * dpr - w / 2, size / 2 + pos.y * dpr - h / 2, w, h);
        return undefined;
    }, [src, stage, zoom, pos, baseScale, imageW, imageH]);

    /* ------------- pointer pan ------------- */
    const onPointerDown = (e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
        setDragging(true);
    };
    const onPointerMove = (e) => {
        if (!dragRef.current) return;
        const d = dragRef.current;
        setPos(clampPos({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) }, zoom));
    };
    const onPointerUp = () => {
        dragRef.current = null;
        setDragging(false);
    };

    /* ------------- touch pinch-zoom ------------- */
    const onTouchStart = (e) => {
        if (e.touches.length === 2) {
            const [a, b] = e.touches;
            pinchRef.current = {
                dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
                zoom,
            };
        }
    };
    const onTouchMove = (e) => {
        if (e.touches.length === 2 && pinchRef.current) {
            const [a, b] = e.touches;
            const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchRef.current.zoom * (dist / pinchRef.current.dist)));
            setZoom(z);
        }
    };
    const onTouchEnd = () => {
        pinchRef.current = null;
    };

    /* ------------- wheel zoom (desktop) ------------- */
    const onWheel = (e) => {
        e.preventDefault();
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))));
    };

    /**
     * Generate the final square crop as a JPEG Blob. Uses the IDENTICAL
     * transform math as the preview (cover × zoom, pan) — the circle is
     * always fully covered, so JPEG (no alpha) matches the storage format.
     *
     * Resolution is decoupled from the on-screen stage (WhatsApp-style):
     * the output is at least 1024px regardless of the preview size, so
     * the stored avatar stays sharp on any device. Encoding at 0.95 keeps
     * this lossless-feeling; the single quality step happens later in
     * compressImage() (which passes ≤5MB/≤1600px images through untouched).
     */
    const MIN_CROP_PX = 1024;
    const generateCrop = () =>
        new Promise((resolve, reject) => {
            if (!src || !stage) {
                reject(new Error("crop failed"));
                return;
            }
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const size = Math.max(Math.round(stage * dpr), MIN_CROP_PX);
            const unit = size / stage; // output px per CSS px
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            const s = baseScale * zoom * unit;
            const w = imageW * s;
            const h = imageH * s;
            ctx.drawImage(src, size / 2 + pos.x * unit - w / 2, size / 2 + pos.y * unit - h / 2, w, h);
            canvas.toBlob(
                (b) => {
                    canvas.width = 0;
                    canvas.height = 0;
                    if (b) resolve(b);
                    else reject(new Error("crop failed"));
                },
                "image/jpeg",
                0.95,
            );
        });

    /* Use Photo → hand the CROPPED file to the caller. Compression and
     * upload happen in Header with the EXISTING pipeline (once, unchanged). */
    const handleUse = async () => {
        setBusy(true);
        try {
            const blob = await generateCrop();
            onConfirm(new File([blob], "avatar.jpg", { type: "image/jpeg" }), file);
        } catch {
            setFailed(true);
        } finally {
            setBusy(false);
        }
    };

    if (failed) {
        return createPortal(
            <div className="ppe__portal">
                <div className="ppe__backdrop" />
                <div className="ppe__overlay">
                    <div className="ppe__card ppe__card--error" role="alertdialog" aria-modal="true">
                        <p>{t("common.profile.photoInvalid")}</p>
                        <button className="ppe__btn ppe__btn--primary" onClick={onCancel}>
                            {t("common.close")}
                        </button>
                    </div>
                </div>
            </div>,
            document.body,
        );
    }

    return createPortal(
        <div className="ppe__portal">
            <div className="ppe__backdrop" />
            <div className="ppe__overlay" role="dialog" aria-modal="true" aria-label={t("common.profile.editPhoto")}>
                <div className="ppe__card">
                    <h3 className="ppe__title">{t("common.profile.editPhoto")}</h3>

                    {/* Crop stage — the live preview IS the crop area; the
                        circular frame + outer dim live in CSS (::before ring,
                        box-shadow wash outside the circle). */}
                    <div
                        ref={stageRef}
                        className={`ppe__stage${dragging ? " ppe__stage--drag" : ""}`}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        onWheel={onWheel}
                    >
                        <canvas ref={canvasRef} className="ppe__canvas" aria-label={t("common.profile.editPhoto")} />
                    </div>

                    {/* Zoom controls: − slider + */}
                    <div className="ppe__zoom">
                        <button
                            type="button"
                            className="ppe__zoom-btn"
                            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))}
                            aria-label={t("common.profile.zoomOut")}
                            disabled={busy || zoom <= MIN_ZOOM}
                        >
                            <Minus size={16} />
                        </button>
                        <input
                            type="range"
                            className="ppe__zoom-slider"
                            min={MIN_ZOOM}
                            max={MAX_ZOOM}
                            step="0.01"
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            disabled={busy}
                        />
                        <button
                            type="button"
                            className="ppe__zoom-btn"
                            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))}
                            aria-label={t("common.profile.zoomIn")}
                            disabled={busy || zoom >= MAX_ZOOM}
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="ppe__actions">
                        <button className="ppe__btn ppe__btn--ghost" onClick={onCancel} disabled={busy}>
                            {t("common.profile.cancel")}
                        </button>
                        <button className="ppe__btn ppe__btn--primary" onClick={handleUse} disabled={busy || !src}>
                            {busy ? "…" : t("common.profile.usePhoto")}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
