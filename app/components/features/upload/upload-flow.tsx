"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { ImageCropper } from "@/components/features/upload/image-cropper";
import { useJobContext } from "@/components/features/app/job-context";
import { startMemeJob, getDailyAiQuota } from "@/lib/actions/upload";
import { useActiveProject } from "@/components/features/app/project-context";

type Step = "select" | "crop" | "chooseMode" | "configure" | "submitting";

/** Die drei Nutzer-Varianten (vor Detailschirm). */
type PostingMode = "ai_full" | "text_overlay" | "fully_manual";

type MemeType = "ai_generated" | "canvas_overlay";
type Pipeline = "direct" | "assisted" | "manual";

function toMemeType(mode: PostingMode): MemeType {
  return mode === "ai_full" ? "ai_generated" : "canvas_overlay";
}

function toPipeline(mode: PostingMode, selectedIdea: string | null): Pipeline {
  if (mode === "fully_manual") return "manual";
  if (selectedIdea?.trim()) return "assisted";
  return "direct";
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
  ai_full: "KI-Vollbild",
  text_overlay: "Text-Overlay",
  fully_manual: "Komplett manuell",
};

export function UploadFlow() {
  const router = useRouter();
  const { activeProjectId } = useActiveProject();
  const { startJob } = useJobContext();

  const [step, setStep] = useState<Step>("select");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [gps, setGps] = useState<GpsCoords | null>(null);

  const [postingMode, setPostingMode] = useState<PostingMode | null>(null);

  const [userText, setUserText] = useState("");
  const [captions, setCaptions] = useState<string[]>([]);
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null);
  const [isLoadingCaptions, setIsLoadingCaptions] = useState(false);
  const [dailyUsed, setDailyUsed] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const coords = await extractGps(file);
    setGps(coords);
    const dataUrl = await fileToDataUrl(file);
    setImageSrc(dataUrl);
    setStep("crop");
  }, []);

  const handleCropComplete = useCallback((blob: Blob) => {
    setCroppedBlob(blob);
    setPostingMode(null);
    setUserText("");
    setCaptions([]);
    setSelectedCaption(null);
    setStep("chooseMode");
  }, []);

  const selectPostingMode = useCallback((mode: PostingMode) => {
    setPostingMode((prev) => {
      if (prev !== null && prev !== mode) {
        setUserText("");
        setCaptions([]);
        setSelectedCaption(null);
      }
      return mode;
    });
    setStep("configure");
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

    const result = await startMemeJob(formData);

    if (result.error) {
      toast.error(result.error);
      setStep("configure");
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
    startJob,
    router,
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

  if (step === "select") {
    return (
      <div className="flex flex-col gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelect(file);
          }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex aspect-[2/3] flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900 transition-colors hover:border-orange-500 hover:bg-zinc-800/50"
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
          setImageSrc(null);
          setStep("select");
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
        <p className="text-sm font-medium text-zinc-300">
          Wie soll dein Meme entstehen?
        </p>

        <button
          type="button"
          onClick={() => selectPostingMode("ai_full")}
          disabled={isAiLimitReached}
          className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-5 text-left transition-all ${
            isAiLimitReached
              ? "cursor-not-allowed border-zinc-800 bg-zinc-900/50 opacity-60"
              : "border-zinc-700 bg-zinc-900 hover:border-orange-500/80 hover:bg-zinc-800/80"
          }`}
        >
          <div className="flex w-full items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
              <Sparkles className="h-6 w-6 text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-zinc-100">
                KI-Vollbild
              </p>
              <p className="text-sm text-zinc-400">
                Neues Meme-Bild mit gpt-image-2
              </p>
            </div>
          </div>
          {isAiLimitReached ? (
            <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400">
              Tageslimit erreicht
            </span>
          ) : remainingAi !== null && dailyLimit !== null ? (
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
              Noch {remainingAi} von {dailyLimit} heute
            </span>
          ) : (
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-500">
              Kontingent wird geladen…
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => selectPostingMode("text_overlay")}
          className="flex flex-col items-start gap-2 rounded-2xl border-2 border-zinc-700 bg-zinc-900 p-5 text-left transition-all hover:border-orange-500/80 hover:bg-zinc-800/80"
        >
          <div className="flex w-full items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
              <Wand2 className="h-6 w-6 text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-zinc-100">
                Text-Overlay
              </p>
              <p className="text-sm text-zinc-400">
                KI setzt Text auf dein Foto
              </p>
            </div>
          </div>
          <span className="rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
            Unlimitiert
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectPostingMode("fully_manual")}
          className="flex flex-col items-start gap-2 rounded-2xl border-2 border-zinc-700 bg-zinc-900 p-5 text-left transition-all hover:border-orange-500/80 hover:bg-zinc-800/80"
        >
          <div className="flex w-full items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
              <PenLine className="h-6 w-6 text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-zinc-100">
                Komplett manuell
              </p>
              <p className="text-sm text-zinc-400">
                Eigenen Text 1:1 aufs Bild – ohne KI
              </p>
            </div>
          </div>
          <span className="rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
            Unlimitiert
          </span>
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
          onClick={() => setStep("chooseMode")}
          className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Andere Variante wählen
        </button>

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
                setImageSrc(null);
                setCroppedBlob(null);
                setPostingMode(null);
                setStep("select");
              }}
              className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-zinc-200 backdrop-blur-sm hover:bg-black/80"
            >
              Neu auswählen
            </button>
          </div>
        )}

        {gps && (
          <div className="flex items-center gap-2 rounded-xl bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
            <span className="text-orange-500">📍</span>
            GPS-Koordinaten erkannt ({gps.lat.toFixed(4)}, {gps.lng.toFixed(4)})
          </div>
        )}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3">
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
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
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
                placeholder="z.B. Strand, zu heiß, Senkung des Meeresspiegels"
                className={`w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none placeholder-zinc-500 ${
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
              className="flex items-center justify-center gap-2 rounded-full bg-zinc-800 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isLoadingCaptions ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  KI denkt nach...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  {captions.length > 0 ? "Neue Ideen generieren" : "Ideen generieren"}
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
                          ? "border-zinc-800/70 bg-zinc-950/50 text-zinc-600 opacity-75 hover:border-zinc-600 hover:text-zinc-400"
                          : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    {idea}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={
            (postingMode === "ai_full" && isAiLimitReached) ||
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
