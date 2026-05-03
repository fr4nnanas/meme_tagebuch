"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  FlaskConical,
  ImagePlus,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  EXPERIMENTAL_AI_MASTER_STYLES,
  ROTATING_EXPERIMENTAL_KEY,
} from "@/lib/meme/ai-meme-master-styles";
import { ImageCropper } from "@/components/features/upload/image-cropper";
import { useJobContext } from "@/components/features/app/job-context";
import {
  startMemeJob,
  getDailyAiQuota,
  getMemeRetryDraftAction,
  retryMemeJobFromDraftAction,
} from "@/lib/actions/upload";
import { useActiveProject } from "@/components/features/app/project-context";

type Step = "select" | "crop" | "chooseMode" | "configure" | "submitting";

/** Nutzer-Varianten vor dem Detail-Schirm (vierter Modus = experimenteller KI-Stil). */
type PostingMode = "ai_full" | "ai_experiment" | "text_overlay" | "fully_manual";

type MemeType = "ai_generated" | "canvas_overlay";
type Pipeline = "direct" | "assisted" | "manual";

function toMemeType(mode: PostingMode): MemeType {
  return mode === "ai_full" || mode === "ai_experiment"
    ? "ai_generated"
    : "canvas_overlay";
}

function toPipeline(mode: PostingMode, selectedIdea: string | null): Pipeline {
  if (mode === "fully_manual") return "manual";
  if (selectedIdea?.trim()) return "assisted";
  return "direct";
}

/** Zurück aus DB-Feldern (Retry). */
function postingModeFromDb(memeType: MemeType, pipeline: Pipeline): PostingMode {
  if (memeType === "ai_generated") return "ai_full";
  if (pipeline === "manual") return "fully_manual";
  return "text_overlay";
}

interface GpsCoords {
  lat: number;
  lng: number;
}

async function extractGps(file: File): Promise<GpsCoords | null> {
  try {
    const exifr = await import("exifr");
    const gps = await exifr.default.gps(file);
    if (gps?.latitude && gps?.longitude) {
      return { lat: gps.latitude, lng: gps.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const MODE_LABEL: Record<PostingMode, string> = {
  ai_full: "Neues Meme von der KI",
  ai_experiment: "KI experimentell (Master-Prompts)",
  text_overlay: "Text auf mein Foto",
  fully_manual: "Alles selbst",
};

/** History-State für den Upload-Assistenten – Browser-Zurück = Wizard zurück statt Seite verlassen */
type UploadHistoryStep = Exclude<Step, "select">;

function pushUploadHistoryStep(step: UploadHistoryStep) {
  if (typeof window === "undefined") return;
  window.history.pushState({ uploadStep: step }, "", window.location.href);
}

export function UploadFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeProjectId, setActiveProjectId } = useActiveProject();
  const { startJob } = useJobContext();

  const [retryPostId, setRetryPostId] = useState<string | null>(null);
  const [retryBootstrapError, setRetryBootstrapError] = useState<string | null>(
    null,
  );
  const [isRetryLoading, setIsRetryLoading] = useState(false);

  const [step, setStep] = useState<Step>("select");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [gps, setGps] = useState<GpsCoords | null>(null);

  const [postingMode, setPostingMode] = useState<PostingMode | null>(null);
  const [experimentMasterChoice, setExperimentMasterChoice] = useState(
    ROTATING_EXPERIMENTAL_KEY,
  );

  const [userText, setUserText] = useState("");
  const [captions, setCaptions] = useState<string[]>([]);
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null);
  const [isLoadingCaptions, setIsLoadingCaptions] = useState(false);
  const [dailyUsed, setDailyUsed] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const retrySessionDoneRef = useRef<string | null>(null);

  useEffect(() => {
    const rid = searchParams.get("retry");
    if (!rid || retrySessionDoneRef.current === rid) return;

    let cancelled = false;
    setIsRetryLoading(true);
    setRetryBootstrapError(null);

    void (async () => {
      const draft = await getMemeRetryDraftAction(rid);
      if (cancelled) return;
      if (!draft.ok) {
        setRetryBootstrapError(draft.error);
        toast.error(draft.error);
        setIsRetryLoading(false);
        return;
      }

      try {
        const res = await fetch(draft.originalSignedUrl);
        if (!res.ok) throw new Error("Bild konnte nicht geladen werden");
        const blob = await res.blob();
        if (cancelled) return;
        setImageSrc(URL.createObjectURL(blob));
        setCroppedBlob(blob);
        setPostingMode(postingModeFromDb(draft.memeType, draft.pipeline));
        const text = draft.pipelineInputText ?? "";
        if (draft.pipeline === "assisted") {
          setUserText("");
          setSelectedCaption(text.trim() ? text : null);
        } else {
          setUserText(text);
          setSelectedCaption(null);
        }
        setCaptions([]);
        setGps(
          draft.lat != null && draft.lng != null
            ? { lat: draft.lat, lng: draft.lng }
            : null,
        );
        setActiveProjectId(draft.projectId);
        setRetryPostId(draft.postId);
        retrySessionDoneRef.current = rid;
        setStep("configure");
        router.replace("/upload", { scroll: false });
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Retry konnte nicht geladen werden";
        setRetryBootstrapError(msg);
        toast.error(msg);
      } finally {
        if (!cancelled) setIsRetryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router, setActiveProjectId]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const uploadStep = event.state?.uploadStep as UploadHistoryStep | undefined;

      if (uploadStep === "crop") {
        setStep("crop");
        return;
      }
      if (uploadStep === "chooseMode") {
        setStep("chooseMode");
        return;
      }
      if (uploadStep === "configure") {
        setStep("configure");
        return;
      }
      if (uploadStep === "submitting") {
        setStep("submitting");
        return;
      }

      setStep("select");
      setImageSrc(null);
      setCroppedBlob(null);
      setPostingMode(null);
      setUserText("");
      setCaptions([]);
      setSelectedCaption(null);
      setRetryPostId(null);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!activeProjectId) return;
    if (step !== "chooseMode") return;

    let cancelled = false;
    void getDailyAiQuota().then((res) => {
      if (cancelled) return;
      if ("error" in res) return;
      setDailyLimit(res.limit);
      setDailyUsed(res.used);
    });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, step]);

  const handleFileSelect = useCallback(async (file: File) => {
    setRetryPostId(null);
    retrySessionDoneRef.current = null;
    const coords = await extractGps(file);
    setGps(coords);
    const dataUrl = await fileToDataUrl(file);
    setImageSrc(dataUrl);
    setStep("crop");
    pushUploadHistoryStep("crop");
  }, []);

  const handleCropComplete = useCallback((blob: Blob) => {
    setCroppedBlob(blob);
    setPostingMode(null);
    setUserText("");
    setCaptions([]);
    setSelectedCaption(null);
    setStep("chooseMode");
    pushUploadHistoryStep("chooseMode");
  }, []);

  const selectPostingMode = useCallback((mode: PostingMode) => {
    setPostingMode((prev) => {
      if (prev !== null && prev !== mode) {
        setUserText("");
        setCaptions([]);
        setSelectedCaption(null);
        setExperimentMasterChoice(ROTATING_EXPERIMENTAL_KEY);
      }
      return mode;
    });
    setStep("configure");
    pushUploadHistoryStep("configure");
  }, []);

  const handleGenerateCaptions = useCallback(async () => {
    if (!croppedBlob || !activeProjectId) {
      toast.error("Bitte wähle zuerst ein Projekt aus.");
      return;
    }
    if (selectedCaption !== null) {
      return;
    }
    setIsLoadingCaptions(true);

    try {
      const base64 = await blobToBase64(croppedBlob);
      const hints = userText.trim();
      const res = await fetch("/api/meme/generate-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProjectId,
          imageBase64: base64,
          ...(hints ? { hints } : {}),
        }),
      });

      const data = (await res.json()) as { ideas?: string[]; error?: string };

      if (data.error) {
        toast.error(`Ideen konnten nicht geladen werden: ${data.error}`);
        return;
      }

      setCaptions(data.ideas ?? []);
      setSelectedCaption(null);
    } catch {
      toast.error("Netzwerkfehler beim Laden der Ideen");
    } finally {
      setIsLoadingCaptions(false);
    }
  }, [croppedBlob, userText, activeProjectId, selectedCaption]);

  const handleSubmit = useCallback(async () => {
    if (!croppedBlob || !activeProjectId || !postingMode) {
      toast.error("Bitte wähle zuerst ein Projekt und eine Variante aus");
      return;
    }

    const memeType = toMemeType(postingMode);
    const pipeline = toPipeline(postingMode, selectedCaption);

    setStep("submitting");
    pushUploadHistoryStep("submitting");

    const formData = new FormData();
    formData.append(
      "croppedImage",
      new File([croppedBlob], "crop.jpg", { type: "image/jpeg" }),
    );
    formData.append("memeType", memeType);
    formData.append("pipeline", pipeline);
    formData.append("projectId", activeProjectId);

    const hints = userText.trim();
    const idea = selectedCaption?.trim() ?? "";
    let effectiveText = "";

    if (pipeline === "manual") {
      effectiveText = userText.trim();
    } else if (pipeline === "assisted") {
      effectiveText = idea;
    } else {
      effectiveText = hints;
    }

    if (pipeline === "manual") {
      formData.append("userText", userText);
    } else if (effectiveText) {
      formData.append("userText", effectiveText);
    }
    if (gps) {
      formData.append("lat", String(gps.lat));
      formData.append("lng", String(gps.lng));
    }

    if (postingMode === "ai_experiment") {
      formData.append("aiMasterStyle", experimentMasterChoice);
    }

    if (retryPostId) {
      formData.append("postId", retryPostId);
    }

    const result = retryPostId
      ? await retryMemeJobFromDraftAction(formData)
      : await startMemeJob(formData);

    if (result.error) {
      toast.error(result.error);
      window.history.back();
      return;
    }

    startJob(result.jobId!, result.postId!);

    toast.info("Meme wird erstellt – du kannst weiter navigieren!");
    router.push("/feed");
  }, [
    croppedBlob,
    activeProjectId,
    postingMode,
    selectedCaption,
    userText,
    gps,
    experimentMasterChoice,
    startJob,
    router,
    retryPostId,
  ]);

  if (!activeProjectId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-zinc-400">
          Kein aktives Projekt ausgewählt.
          <br />
          Gehe zum Profil und wähle ein Projekt.
        </p>
      </div>
    );
  }

  if (isRetryLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-9 w-9 animate-spin text-orange-500" />
        <p className="text-sm text-zinc-400">Entwurf wird geladen…</p>
      </div>
    );
  }

  if (retryBootstrapError && step === "select" && !retryPostId) {
    return (
      <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
        {retryBootstrapError}
      </div>
    );
  }

  if (step === "select") {
    return (
      <div className="flex flex-col gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const input = e.target;
            input.removeAttribute("capture");
            const file = input.files?.[0];
            if (file) void handleFileSelect(file);
          }}
        />

        <button
          type="button"
          onClick={() => {
            const input = fileInputRef.current;
            if (!input) return;
            input.removeAttribute("capture");
            input.click();
          }}
          className="flex aspect-[2/3] flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-800 transition-colors hover:border-orange-500 hover:bg-zinc-800/50"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
            <ImagePlus className="h-8 w-8 text-orange-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-zinc-200">
              Foto auswählen
            </p>
            <p className="mt-1 text-sm text-zinc-500">Galerie oder Kamera</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.capture = "environment";
              fileInputRef.current.click();
            }
          }}
          className="flex items-center justify-center gap-2 rounded-full border border-zinc-700 py-3.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
        >
          <Camera className="h-5 w-5" />
          Kamera öffnen
        </button>
      </div>
    );
  }

  if (step === "crop" && imageSrc) {
    return (
      <ImageCropper
        imageSrc={imageSrc}
        onCropComplete={handleCropComplete}
        onCancel={() => {
          window.history.back();
        }}
      />
    );
  }

  const remainingAi =
    dailyLimit != null && dailyUsed != null
      ? dailyLimit - dailyUsed
      : null;
  const isAiLimitReached =
    dailyUsed != null && dailyLimit != null && dailyUsed >= dailyLimit;

  // Schritt: 3 große Varianten
  if (step === "chooseMode") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-zinc-300">
          Du hast ein Bild ausgewählt. Jetzt entscheidest du: Soll die App ein
          neues Bild erzeugen, nur Text darauf legen – oder machst du alles
          selbst?
        </p>

        <button
          type="button"
          onClick={() => selectPostingMode("ai_full")}
          disabled={isAiLimitReached}
          className={`flex flex-col items-start gap-3 rounded-2xl border-2 p-5 text-left transition-all ${
            isAiLimitReached
              ? "cursor-not-allowed border-zinc-700/80 bg-zinc-900/50 opacity-60"
              : "border-emerald-600/55 bg-emerald-950/35 hover:border-emerald-500 hover:bg-emerald-950/55"
          }`}
        >
          <div className="flex w-full gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                isAiLimitReached ? "bg-zinc-800" : "bg-emerald-500/20"
              }`}
            >
              <Sparkles
                className={`h-6 w-6 ${
                  isAiLimitReached ? "text-zinc-500" : "text-emerald-400"
                }`}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-base font-semibold text-zinc-100">
                Neues Meme von der KI
              </p>
              <p className="text-sm leading-relaxed text-zinc-400">
                Die KI generiert ein komplett neues Meme-Bild passend zu deiner
                Idee.
              </p>
            </div>
          </div>
          {isAiLimitReached ? (
            <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400">
              Tageslimit erreicht
            </span>
          ) : remainingAi !== null && dailyLimit !== null ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300/90">
              Heute noch {remainingAi} KI-Bilder frei (von {dailyLimit})
            </span>
          ) : (
            <span className="rounded-full bg-emerald-950/60 px-2.5 py-1 text-xs text-emerald-400/80">
              Kontingent wird geladen…
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => selectPostingMode("text_overlay")}
          className="flex flex-col items-start gap-3 rounded-2xl border-2 border-orange-600/55 bg-orange-950/35 p-5 text-left transition-all hover:border-orange-500 hover:bg-orange-950/55"
        >
          <div className="flex w-full gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/20">
              <Wand2 className="h-6 w-6 text-orange-400" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-base font-semibold text-zinc-100">
                Text auf mein Foto
              </p>
              <p className="text-sm leading-relaxed text-zinc-400">
                Dein Foto bleibt erhalten. Die KI erstellt Schrift und platziert
                diese auf dem Bild.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-orange-500/20 px-2.5 py-1 text-xs font-medium text-orange-300">
            Unlimitiert
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectPostingMode("fully_manual")}
          className="flex flex-col items-start gap-3 rounded-2xl border-2 border-red-600/55 bg-red-950/35 p-5 text-left transition-all hover:border-red-500 hover:bg-red-950/55"
        >
          <div className="flex w-full gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/20">
              <PenLine className="h-6 w-6 text-red-400" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-base font-semibold text-zinc-100">
                Alles selbst
              </p>
              <p className="text-sm leading-relaxed text-zinc-400">
                Du schreibst den Text selbst und legst ihn auf das Bild – ohne
                KI.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300">
            Unlimitiert
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectPostingMode("ai_experiment")}
          disabled={isAiLimitReached}
          className={`flex flex-col items-start gap-2 rounded-xl border-2 p-3.5 text-left transition-all ${
            isAiLimitReached
              ? "cursor-not-allowed border-zinc-700/80 bg-zinc-900/50 opacity-60"
              : "border-cyan-600/55 bg-cyan-950/35 hover:border-cyan-500 hover:bg-cyan-950/55"
          }`}
        >
          <div className="flex w-full gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isAiLimitReached ? "bg-zinc-800" : "bg-cyan-500/20"
              }`}
            >
              <FlaskConical
                className={`h-5 w-5 ${
                  isAiLimitReached ? "text-zinc-500" : "text-cyan-400"
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-100">
                KI experimentell
              </p>
              <p className="mt-0.5 text-xs leading-snug text-zinc-400">
                Hier experimentiert Franz mit dem Meme-Engine herum.
              </p>
            </div>
          </div>
          {isAiLimitReached ? (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-400">
              Tageslimit erreicht
            </span>
          ) : remainingAi !== null && dailyLimit !== null ? (
            <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] text-cyan-300/90">
              Wie KI-Vollbild: {remainingAi} von {dailyLimit} frei
            </span>
          ) : (
            <span className="rounded-full bg-cyan-950/60 px-2 py-0.5 text-[11px] text-cyan-400/80">
              Kontingent wird geladen…
            </span>
          )}
        </button>
      </div>
    );
  }

  // Details: Text, optional Ideen, Absenden
  if (step === "configure" && postingMode) {
    const pipeline = toPipeline(postingMode, selectedCaption);
    const showIdeasSection = postingMode !== "fully_manual";
    const hintsLocked = selectedCaption !== null;
    return (
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Andere Variante wählen
        </button>

        {retryPostId && (
          <p className="rounded-xl border border-amber-500/35 bg-amber-950/45 px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
            Entwurf erneut starten: Passe Text, Modus oder Zuschnitt an – der
            Lauf ersetzt den bisherigen Status dieses Posts.
          </p>
        )}

        {imageSrc && (
          <div className="relative overflow-hidden rounded-xl border border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="Dein Foto"
              className="aspect-[2/3] w-full object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setRetryPostId(null);
                retrySessionDoneRef.current = null;
                window.history.go(-3);
              }}
              className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-zinc-200 backdrop-blur-sm hover:bg-black/80"
            >
              Neu auswählen
            </button>
          </div>
        )}

        {gps && (
          <div className="flex items-center gap-2 rounded-xl bg-zinc-800/60 px-3 py-2 text-xs text-zinc-400">
            <span className="text-orange-500">📍</span>
            GPS-Koordinaten erkannt ({gps.lat.toFixed(4)}, {gps.lng.toFixed(4)})
          </div>
        )}

        <div className="rounded-xl border border-zinc-800 bg-zinc-800/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Gewählt
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-200">
            {MODE_LABEL[postingMode]}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {postingMode === "fully_manual"
              ? "Dein Meme-Text"
              : "Idee / Stichworte (optional)"}
          </p>
          {postingMode === "fully_manual" ? (
            <>
              <p className="mb-2 text-xs text-zinc-500">
                Wird unverändert aufs Bild gelegt. Eine Zeile = nur unten. Ab dem
                ersten Zeilenumbruch: Text oben / Text unten.
              </p>
              <textarea
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                rows={5}
                placeholder={
                  "Nur unten: einfach hier tippen\n\nOder:\nZeile oben\nZeile(n) unten"
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
              />
            </>
          ) : (
            <>
              <p className={`mb-2 text-xs ${hintsLocked ? "text-zinc-600" : "text-zinc-500"}`}>
                {hintsLocked
                  ? "Stichworte werden nach Auswahl einer Idee nicht mehr verwendet. Es gilt nur die ausgewählte Idee."
                  : "Optional: Stichworte helfen beim Generieren weiterer Ideen und fließen in die automatische Ausarbeitung ein, solange du noch keine Konkret-Idee angeklickt hast."}
              </p>
              <input
                type="text"
                value={userText}
                disabled={hintsLocked}
                readOnly={hintsLocked}
                onChange={(e) => setUserText(e.target.value)}
                placeholder="z. B. Stichwörter für Stimmung & Kontext oder Insider-Witze"
                className={`w-full rounded-xl border border-zinc-800 bg-zinc-800 px-4 py-3 text-sm outline-none placeholder-zinc-500 ${
                  hintsLocked
                    ? "cursor-not-allowed opacity-55 text-zinc-500 border-zinc-800/80"
                    : "text-zinc-100 focus:border-orange-500"
                }`}
              />
            </>
          )}
        </div>

        {showIdeasSection && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void handleGenerateCaptions()}
              disabled={isLoadingCaptions || hintsLocked}
              className="flex flex-col items-center justify-center gap-0.5 rounded-full bg-zinc-800 px-4 py-3 text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isLoadingCaptions ? (
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  KI denkt nach...
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <RefreshCw className="h-4 w-4 shrink-0" />
                    {captions.length > 0 ? "Neue Ideen generieren" : "Ideen generieren"}
                  </span>
                  <span className="text-[11px] font-normal leading-tight text-zinc-500">
                    optional als Inspiration
                  </span>
                </>
              )}
            </button>

            {captions.length > 0 && (
              <div className="flex flex-col gap-2">
                {captions.map((idea, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setSelectedCaption(selectedCaption === idea ? null : idea)
                    }
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      selectedCaption === idea
                        ? "border-orange-500 bg-orange-500/10 text-zinc-100"
                        : hintsLocked && selectedCaption !== idea
                          ? "border-zinc-800/70 bg-zinc-800/50 text-zinc-600 opacity-75 hover:border-zinc-600 hover:text-zinc-400"
                          : "border-zinc-800 bg-zinc-800 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    {idea}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {postingMode === "ai_experiment" && (
          <div className="rounded-xl border border-cyan-600/35 bg-cyan-950/30 px-3 py-2.5">
            <p className="mb-2 text-xs leading-snug text-zinc-400">
              Hier experimentiert Franz mit dem Meme-Engine herum.
            </p>
            <label className="sr-only" htmlFor="experiment-master-style">
              Master-Prompt-Stil
            </label>
            <select
              id="experiment-master-style"
              value={experimentMasterChoice}
              onChange={(e) => setExperimentMasterChoice(e.target.value)}
              className="w-full rounded-lg border border-cyan-800/50 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
            >
              <option value={ROTATING_EXPERIMENTAL_KEY}>
                Automatisch wechseln (Rotation je Meme)
              </option>
              {Object.entries(EXPERIMENTAL_AI_MASTER_STYLES).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={
            ((postingMode === "ai_full" || postingMode === "ai_experiment") &&
              isAiLimitReached) ||
            (pipeline === "assisted" &&
              captions.length > 0 &&
              !selectedCaption) ||
            (postingMode === "fully_manual" && !userText.trim())
          }
          className="rounded-full bg-orange-500 py-4 text-base font-semibold text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Meme erstellen ✨
        </button>
      </div>
    );
  }

  if (step === "submitting") {
    return (
      <div className="flex aspect-[2/3] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        <p className="text-sm font-medium text-zinc-300">
          Foto wird hochgeladen...
        </p>
        <p className="text-xs text-zinc-500">Gleich geht&apos;s weiter!</p>
      </div>
    );
  }

  return null;
}
