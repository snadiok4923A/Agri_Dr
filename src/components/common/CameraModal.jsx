import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
    X,
    Camera,
    CameraOff,
    AlertTriangle,
    RotateCcw,
    RefreshCcw,
    ScanLine,
} from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import { analyzeCropImage } from "../../services/cropAnalysisService";
import "./CameraModal.css";

/**
 * CameraModal — the Crop Diagnosis floating workflow, driven by the
 * parent's ONE workflow state (closed | camera | photo-preview | analysis
 * — no boolean soup, §22). Nothing here ever touches the dashboard card:
 * after a capture or an upload the image stays inside floating windows
 * (§2/§26).
 *
 * Browser-native only (GitHub Pages safe): getUserMedia + canvas. The
 * camera/device-selection logic is UNTOUCHED — rear camera preferred on
 * mobile (`facingMode: { ideal: "environment" }` degrades gracefully,
 * §9/§27), plain-video retry for OverconstrainedError, mapped friendly
 * error states.
 *
 * Stages (§23):
 *   camera        live <video> preview → Capture → video → canvas → Blob →
 *                 File → onCapture(file) → the parent flips the workflow to
 *                 photo-preview. The camera stream stops immediately.
 *   photo-preview the captured/uploaded photo + Retake (camera origin) or
 *                 Choose Another (upload origin) + Analyze.
 *   analysis      analyzeCropImage(file) → "Model not connected" today;
 *                 a future real model renders through the same window
 *                 (§16/§19) — no fake disease data is ever shown (§14/§31).
 *
 * Lifecycle (§13/§24/§25): every stream track stops on Capture, Close,
 * Escape, leaving the camera stage and unmount; the photo's object URL is
 * owned by the parent and revoked on replace/close.
 */

/* Map getUserMedia errors to i18n keys (§27 — never expose raw errors) */
const errorKey = (name) => {
    switch (name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
            return "dashboard.cameraDenied";
        case "NotFoundError":
        case "DevicesNotFoundError":
            return "dashboard.cameraNotFound";
        case "NotReadableError":
        case "TrackStartError":
            return "dashboard.cameraInUse";
        case "SecurityError":
            return "dashboard.cameraSecurity";
        default:
            return "dashboard.cameraUnavailable";
    }
};

export default function CameraModal({
    open,
    flow, // "camera" | "photo-preview" | "analysis"
    photo, // { file, url, source: "camera" | "upload" } | null
    onClose, // parent decides: analysis → preview, otherwise → closed
    onCapture, // (file) => parent stores the photo + moves to photo-preview
    onRetake, // photo-preview → camera (§7)
    onChooseAnother, // photo-preview → file picker (upload origin, §8)
    onAnalyze, // photo-preview → analysis (§17)
}) {
    const { t } = useLanguage();

    /* Camera-internal stage: "starting" → "live" | "error".
       Reset on every entry into the camera stage (open-effect). */
    const [camStage, setCamStage] = useState("starting");
    const [errorKeyState, setErrorKeyState] = useState(null);
    /* The active stream lives in state: a NEW stream object on every open
       guarantees the attach-effect below re-runs, even when React batches
       away the stage transitions (e.g. Retake re-entering with a stale
       "live" stage and an instantly-resolving getUserMedia). */
    const [camStream, setCamStream] = useState(null);

    /* Analysis result — rendered only when the service returns one. Today
       that is always the explicit "not connected" state (§15/§20). */
    const [analysis, setAnalysis] = useState(null);
    const analysisReqRef = useRef(0);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const aliveRef = useRef(false); // guards async results after close

    /* Stop every active track — the single source of camera shutdown. */
    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    /* Request the camera. Loose constraints: `ideal` facingMode so a missing
       rear camera degrades to whatever exists instead of failing (§9), and
       a plain-video retry for OverconstrainedError devices (§25). */
    const startCamera = useCallback(async () => {
        // Feature detection first (§25) — old/unsupported browsers never crash.
        if (!navigator.mediaDevices?.getUserMedia) {
            setErrorKeyState("dashboard.cameraUnavailable");
            setCamStage("error");
            return;
        }
        setCamStage("starting");
        setErrorKeyState(null);
        const constraints = {
            video: {
                facingMode: { ideal: "environment" }, // rear camera for crops
                width: { ideal: 1280 },
                height: { ideal: 720 },
            },
            audio: false,
        };
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (!aliveRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return; // stage left while the permission dialog was open
            }
            streamRef.current = stream;
            setCamStream(stream);
            setCamStage("live");
        } catch (err) {
            if (!aliveRef.current) return;
            // Overly specific constraints (rare) → one plain-video retry (§10)
            if (err?.name === "OverconstrainedError") {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false,
                    });
                    if (!aliveRef.current) {
                        stream.getTracks().forEach((track) => track.stop());
                        return;
                    }
                    streamRef.current = stream;
                    setCamStream(stream);
                    setCamStage("live");
                    return;
                } catch (retryErr) {
                    err = retryErr;
                }
            }
            setErrorKeyState(errorKey(err?.name));
            setCamStream(null);
            setCamStage("error");
        }
    }, []);

    /* Attach the stream to the <video> once it mounts. The element only
       renders when camStage is "live", but getUserMedia resolves while
       camStage is still "starting". Keyed on the STREAM OBJECT — a fresh
       stream always re-attaches, regardless of stage-transition batching. */
    useEffect(() => {
        const video = videoRef.current;
        if (
            camStage === "live" &&
            video &&
            camStream &&
            video.srcObject !== camStream
        ) {
            video.srcObject = camStream;
            video.play().catch(() => {});
        }
    }, [camStage, camStream]);

    /* Camera stage lifecycle: start on entry, stop on exit (§13/§24) —
       leaving to photo-preview via Capture, Retake-return, Close or
       unmount all pass through this cleanup. The stage/stream state also
       resets so the next entry starts clean. */
    useEffect(() => {
        if (!open || flow !== "camera") return;
        aliveRef.current = true;
        startCamera();
        return () => {
            aliveRef.current = false;
            stopStream();
            setCamStream(null);
            setCamStage("starting");
            setErrorKeyState(null);
        };
    }, [open, flow, startCamera, stopStream]);

    /* Analysis (§17): call the service when the stage opens. No artificial
       delay (§20) — the stub resolves immediately to "not connected". */
    useEffect(() => {
        if (!open || flow !== "analysis") {
            setAnalysis(null);
            return;
        }
        const req = ++analysisReqRef.current;
        let alive = true;
        analyzeCropImage(photo?.file).then((result) => {
            if (alive && analysisReqRef.current === req) setAnalysis(result);
        });
        return () => {
            alive = false;
        };
    }, [open, flow, photo?.file]);

    /* Window-level: Escape closes any stage; page scroll locked while open */
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    /* Capture: video → canvas → JPEG Blob → File (§6, §15). The frame is
       drawn at the video's native size, so orientation matches exactly what
       the preview showed (§16). JPEG quality 0.9 — diagnosis-friendly size.
       The stream stops immediately; onCapture flips the parent's workflow
       to photo-preview (§5) — the photo never enters the dashboard card. */
    const capture = () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
            (blob) => {
                if (!blob) return;
                stopStream(); // §13/§24 — camera off the moment a shot exists
                onCapture?.(new File([blob], "crop-photo.jpg", { type: "image/jpeg" }));
            },
            "image/jpeg",
            0.9,
        );
    };

    if (!open || !flow || flow === "closed") return null;

    /* Portal to <body>: a transformed ancestor (.page-container's motion
       transform) would otherwise hijack position:fixed and break the
       overlay's viewport anchoring — spec §12 (mobile safety). */
    return createPortal(
        <div
            className="camodal__overlay"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={flow === "analysis" ? t("dashboard.cropAnalysis") : t("dashboard.cropDiagnosis")}
        >
            <div className="camodal" onClick={(e) => e.stopPropagation()}>
                {/* ===== Header: stage title · Close ===== */}
                <header className="camodal__head">
                    <span className="camodal__title">
                        {flow === "analysis"
                            ? t("dashboard.cropAnalysis")
                            : t("dashboard.cropDiagnosis")}
                    </span>
                    <button className="camodal__close" onClick={onClose} aria-label={t("common.close")}>
                        <X size={16} />
                    </button>
                </header>

                {/* ==================== CAMERA ==================== */}
                {flow === "camera" && (
                    <>
                        <div className="camodal__viewport">
                            {camStage === "starting" && (
                                <div className="camodal__state">
                                    <Camera className="camodal__state-ico camodal__state-ico--pulse" size={34} />
                                    <span>{t("dashboard.cameraStarting")}</span>
                                </div>
                            )}

                            {camStage === "live" && <video ref={videoRef} className="camodal__video" autoPlay playsInline muted />}

                            {camStage === "error" && (
                                <div className="camodal__state">
                                    <CameraOff className="camodal__state-ico" size={34} />
                                    <span className="camodal__state-text">{t(errorKeyState)}</span>
                                    <div className="camodal__state-actions">
                                        {/* Denied/in-use → retry; missing camera → upload only */}
                                        {errorKeyState !== "dashboard.cameraNotFound" &&
                                            errorKeyState !== "dashboard.cameraUnavailable" && (
                                                <button className="camodal__btn camodal__btn--primary" onClick={startCamera}>
                                                    <RotateCcw size={15} />
                                                    {t("dashboard.cameraTryAgain")}
                                                </button>
                                            )}
                                        <button className="camodal__btn" onClick={onClose}>
                                            {t("common.close")}
                                        </button>
                                    </div>
                                    <span className="camodal__state-hint">
                                        <AlertTriangle size={12} />
                                        {t("dashboard.uploadPhoto")}
                                    </span>
                                </div>
                            )}
                        </div>

                        {camStage === "live" && (
                            <div className="camodal__controls">
                                <button className="camodal__cancel" onClick={onClose}>
                                    {t("common.close")}
                                </button>
                                <button
                                    className="camodal__shutter"
                                    onClick={capture}
                                    aria-label={t("dashboard.cameraCapture")}
                                >
                                    <Camera size={20} />
                                </button>
                                <span className="camodal__controls-spacer" />
                            </div>
                        )}
                    </>
                )}

                {/* ==================== PHOTO PREVIEW ==================== */}
                {/* Captured/uploaded photo — object-fit: contain (§11), the
                    only image the workflow shows before analysis. */}
                {flow === "photo-preview" && photo && (
                    <>
                        <div className="camodal__photo-frame">
                            <img className="camodal__photo" src={photo.url} alt={t("dashboard.cropDiagnosis")} />
                        </div>
                        <div className="camodal__actions">
                            {photo.source === "camera" ? (
                                <button className="camodal__btn" onClick={onRetake}>
                                    <RotateCcw size={15} />
                                    {t("dashboard.retake")}
                                </button>
                            ) : (
                                <button className="camodal__btn" onClick={onChooseAnother}>
                                    <RefreshCcw size={15} />
                                    {t("dashboard.chooseAnother")}
                                </button>
                            )}
                            <button className="camodal__btn camodal__btn--primary" onClick={onAnalyze}>
                                <ScanLine size={16} />
                                {t("dashboard.analyze")}
                            </button>
                        </div>
                    </>
                )}

                {/* ==================== ANALYSIS ==================== */}
                {/* Today: explicit "model not connected" — never a fake
                    diagnosis (§14/§15/§31). A future real model renders its
                    fields through the same window (§19). */}
                {flow === "analysis" && photo && (
                    <div className="camodal__analysis">
                        <div className="camodal__thumb-frame">
                            <img className="camodal__thumb" src={photo.url} alt="" />
                        </div>

                        {analysis?.status === "ok" ? (
                            /* Future-proof result block — renders ONLY when a
                               real model returns data; nothing is faked now. */
                            <div className="camodal__analysis-body">
                                {analysis.disease && (
                                    <span className="camodal__analysis-disease">{analysis.disease}</span>
                                )}
                                {typeof analysis.confidence === "number" && (
                                    <span className="camodal__status">
                                        <span className="camodal__status-dot" />
                                        {Math.round(analysis.confidence * 100)}%
                                    </span>
                                )}
                                {analysis.treatment && (
                                    <span className="camodal__analysis-msg">{analysis.treatment}</span>
                                )}
                            </div>
                        ) : (
                            <div className="camodal__analysis-body">
                                <span className="camodal__status">
                                    <span className="camodal__status-dot" />
                                    {t("dashboard.modelNotConnected")}
                                </span>
                                <span className="camodal__analysis-msg">
                                    {t("dashboard.analysisNotReady")}
                                </span>
                            </div>
                        )}

                        <button className="camodal__btn" onClick={onClose}>
                            {t("common.close")}
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
