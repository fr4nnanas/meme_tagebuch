"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  encodeExperimentalMasterChoice,
  encodeExperimentalMemeArtChoice,
  encodeExperimentalStylizationChoice,
  ROTATING_EXPERIMENTAL_KEY,
} from "@/lib/meme/ai-meme-master-styles";
import { ImageCropper } from "@/components/features/upload/image-cropper";
import { MemeCreationModePicker } from "@/components/features/meme-creation/meme-creation-mode-picker";
import { MemeCreationConfigurePanel } from "@/components/features/meme-creation/meme-creation-configure-panel";
import { useJobContext } from "@/components/features/app/job-context";
import { useActiveProject } from "@/components/features/app/project-context";
import { getRemixSourceAction } from "@/lib/actions/remix";
import { getDailyAiQuota, startMemeJob } from "@/lib/actions/upload";
import { fetchRemoteImageBlob } from "@/lib/media/fetch-remote-image";
import {
  applySourcePipelineText,
  toMemeType,
  toPipeline,
  type PostingMode,
} from "@/lib/meme/meme-creation-types";
import {
  blobToBase64,
  pushMemeWizardHistoryStep,
  type MemeWizardHistoryState,
} from "@/lib/meme/meme-creation-utils";

type RemixStep =
  | "loading"
  | "chooseBase"
  | "crop"
  | "chooseMode"
  | "configure"
  | "submitting";

type RemixBase = "original" | "meme";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function RemixFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourcePostId = searchParams.get("source");
  const { activeProjectId } = useActiveProject();
  const { startJob } = useJobContext();

  const [step, setStep] = useState<RemixStep>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceUsername, setSourceUsername] = useState("");
  const [sourcePipeline, setSourcePipeline] = useState<
    "direct" | "assisted" | "manual"
  >("direct");
  const [sourcePrompt, setSourcePrompt] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [memeUrl, setMemeUrl] = useState<string | null>(null);

  const [remixBase, setRemixBase] = useState<RemixBase>("original");
  /** Basis beim Wechsel in den Zuschnitt (Original vs. Meme). */
  const [cropSourceBase, setCropSourceBase] = useState<RemixBase>("original");
  const [adoptPrompt, setAdoptPrompt] = useState(true);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [secondImageSrc, setSecondImageSrc] = useState<string | null>(null);
  const [cropSecondHistory, setCropSecondHistory] = useState(false);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [secondCroppedBlob, setSecondCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(
    null,
  );
  const [secondCroppedPreviewUrl, setSecondCroppedPreviewUrl] = useState<
    string | null
  >(null);
  const [postingMode, setPostingMode] = useState<PostingMode | null>(null);
  const [experimentMemeArtKey, setExperimentMemeArtKey] = useState("");
  const [experimentMasterChoice, setExperimentMasterChoice] = useState(
    ROTATING_EXPERIMENTAL_KEY,
  );
  const [experimentStylizationKey, setExperimentStylizationKey] = useState("");
  const [experimentMinimalLayout, setExperimentMinimalLayout] = useState(false);
  const [userText, setUserText] = useState("");
  const [captions, setCaptions] = useState<string[]>([]);
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null);
  const [isLoadingCaptions, setIsLoadingCaptions] = useState(false);
  const [aiQuota, setAiQuota] = useState<{
    globalLimit: number;
    globalUsed: number;
    projectLimit: number;
    projectUsed: number;
    remainingEffective: number;
  } | null>(null);

  const bootstrapDoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sourcePostId || bootstrapDoneRef.current === sourcePostId) return;
    let cancelled = false;
    setStep("loading");
    setLoadError(null);

    void (async () => {
      const res = await getRemixSourceAction(sourcePostId);
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(res.error);
        toast.error(res.error);
        setStep("loading");
        return;
      }
      bootstrapDoneRef.current = sourcePostId;
      setSourceUsername(res.sourceUsername);
      setSourcePipeline(res.pipeline);
      setSourcePrompt(res.pipelineInputText);
      setOriginalUrl(res.originalSignedUrl);
      setMemeUrl(res.memeSignedUrl);
      setAdoptPrompt(Boolean(res.pipelineInputText?.trim()));
      setRemixBase(res.memeSignedUrl ? "meme" : "original");
      setStep("chooseBase");
    })();

    return () => {
      cancelled = true;
    };
  }, [sourcePostId]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const historyState = event.state as MemeWizardHistoryState | null;
      const wizardStep = historyState?.memeWizardStep;

      if (wizardStep === "crop") {
        setStep("crop");
        setCropSecondHistory(Boolean(historyState?.cropSecond));
        return;
      }
      if (wizardStep === "chooseMode") {
        setStep("chooseMode");
        return;
      }
      if (wizardStep === "configure") {
        setStep("configure");
        return;
      }
      if (wizardStep === "submitting") {
        setStep("submitting");
        return;
      }

      if (step === "chooseBase") {
        router.back();
        return;
      }
      setStep("chooseBase");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [step, router]);

  useLayoutEffect(() => {
    if (!croppedBlob) {
      setCroppedPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(croppedBlob);
    setCroppedPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [croppedBlob]);

  useLayoutEffect(() => {
    if (!secondCroppedBlob) {
      setSecondCroppedPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(secondCroppedBlob);
    setSecondCroppedPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [secondCroppedBlob]);

  useEffect(() => {
    if (!activeProjectId || step !== "chooseMode") return;
    let cancelled = false;
    void getDailyAiQuota(activeProjectId).then((res) => {
      if (cancelled || "error" in res) return;
      setAiQuota(res);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, step]);

  const applyPromptToForm = useCallback(() => {
    if (!adoptPrompt || !sourcePrompt?.trim()) {
      setUserText("");
      setSelectedCaption(null);
      return;
    }
    const applied = applySourcePipelineText(sourcePipeline, sourcePrompt);
    setUserText(applied.userText);
    setSelectedCaption(applied.selectedCaption);
  }, [adoptPrompt, sourcePrompt, sourcePipeline]);

  const loadBaseImage = useCallback(
    async (base: RemixBase) => {
      const url = base === "meme" ? memeUrl : originalUrl;
      if (!url) {
        toast.error("Diese Variante ist nicht verfügbar");
        return false;
      }
      const fetched = await fetchRemoteImageBlob(url);
      if (!fetched.ok) {
        toast.error(fetched.message);
        return false;
      }
      setImageSrc(URL.createObjectURL(fetched.blob));
      setSecondImageSrc(null);
      setSecondCroppedBlob(null);
      setCropSecondHistory(false);
      return true;
    },
    [memeUrl, originalUrl],
  );

  const handleContinueFromBase = useCallback(async () => {
    const ok = await loadBaseImage(remixBase);
    if (!ok) return;
    setCropSourceBase(remixBase);
    applyPromptToForm();
    setStep("crop");
    pushMemeWizardHistoryStep("crop", { cropSecond: false });
  }, [remixBase, loadBaseImage, applyPromptToForm]);

  const handleSecondImageSelect = useCallback(async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    setSecondImageSrc(dataUrl);
    setCropSecondHistory(true);
    pushMemeWizardHistoryStep("crop", { cropSecond: true });
  }, []);

  const handleCropComplete = useCallback(
    (blob: Blob, secondBlob?: Blob | null) => {
      setCroppedBlob(blob);
      setSecondCroppedBlob(secondBlob ?? null);
      setPostingMode(null);
      setCaptions([]);
      if (!adoptPrompt) {
        setUserText("");
        setSelectedCaption(null);
      } else {
        applyPromptToForm();
      }
      setStep("chooseMode");
      pushMemeWizardHistoryStep("chooseMode");
    },
    [adoptPrompt, applyPromptToForm],
  );

  const selectPostingMode = useCallback((mode: PostingMode) => {
    setPostingMode((prev) => {
      if (prev !== null && prev !== mode) {
        setCaptions([]);
        if (!adoptPrompt) {
          setUserText("");
          setSelectedCaption(null);
        }
        setExperimentMasterChoice(ROTATING_EXPERIMENTAL_KEY);
        setExperimentMinimalLayout(false);
      }
      return mode;
    });
    setStep("configure");
    pushMemeWizardHistoryStep("configure");
  }, [adoptPrompt]);

  const handleGenerateCaptions = useCallback(async () => {
    if (!croppedBlob || !activeProjectId || selectedCaption !== null) return;
    setIsLoadingCaptions(true);
    try {
      const base64 = await blobToBase64(croppedBlob);
      const secondBase64 = secondCroppedBlob
        ? await blobToBase64(secondCroppedBlob)
        : null;
      const hints = userText.trim();
      const res = await fetch("/api/meme/generate-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProjectId,
          imageBase64: base64,
          ...(secondBase64 ? { secondImageBase64: secondBase64 } : {}),
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
  }, [
    croppedBlob,
    secondCroppedBlob,
    userText,
    activeProjectId,
    selectedCaption,
  ]);

  const handleSubmit = useCallback(async () => {
    if (!croppedBlob || !activeProjectId || !postingMode || !sourcePostId) {
      toast.error("Bitte wähle zuerst ein Projekt und eine Variante aus");
      return;
    }

    const memeType = toMemeType(postingMode);
    const pipeline = toPipeline(postingMode, selectedCaption);
    setStep("submitting");
    pushMemeWizardHistoryStep("submitting");

    const formData = new FormData();
    formData.append(
      "croppedImage",
      new File([croppedBlob], "crop.jpg", { type: "image/jpeg" }),
    );
    if (secondCroppedBlob) {
      formData.append(
        "croppedImage2",
        new File([secondCroppedBlob], "crop2.jpg", { type: "image/jpeg" }),
      );
    }
    formData.append("memeType", memeType);
    formData.append("pipeline", pipeline);
    formData.append("projectId", activeProjectId);
    formData.append("remixedFromPostId", sourcePostId);

    const hints = userText.trim();
    const idea = selectedCaption?.trim() ?? "";
    let effectiveText = "";
    if (pipeline === "manual") effectiveText = userText.trim();
    else if (pipeline === "assisted") effectiveText = idea;
    else effectiveText = hints;

    if (pipeline === "manual") formData.append("userText", userText);
    else if (effectiveText) formData.append("userText", effectiveText);

    if (postingMode === "ai_experiment") {
      formData.append(
        "aiMasterStyle",
        experimentMemeArtKey
          ? encodeExperimentalMemeArtChoice(experimentMemeArtKey)
          : encodeExperimentalMasterChoice(experimentMasterChoice),
      );
      if (experimentMinimalLayout) {
        formData.append("aiExperimentalMinimal", "1");
      }
      if (experimentStylizationKey) {
        formData.append(
          "aiStylization",
          encodeExperimentalStylizationChoice(experimentStylizationKey),
        );
      }
    }

    const result = await startMemeJob(formData);
    if (result.error) {
      toast.error(result.error);
      window.history.back();
      return;
    }

    startJob(result.jobId!, result.postId!);
    toast.info("Remix wird erstellt – du kannst weiter navigieren!");
    router.push("/feed");
  }, [
    croppedBlob,
    secondCroppedBlob,
    activeProjectId,
    postingMode,
    selectedCaption,
    userText,
    experimentMemeArtKey,
    experimentMasterChoice,
    experimentStylizationKey,
    experimentMinimalLayout,
    sourcePostId,
    startJob,
    router,
  ]);

  if (!sourcePostId) {
    return (
      <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
        Kein Quell-Post angegeben. Wähle „Remixen“ an einem Bild in der App.
      </p>
    );
  }

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

  if (loadError) {
    return (
      <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
        {loadError}
      </p>
    );
  }

  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-9 w-9 animate-spin text-orange-500" />
        <p className="text-sm text-zinc-400">Quelle wird geladen…</p>
      </div>
    );
  }

  if (step === "chooseBase") {
    const hasPrompt = Boolean(sourcePrompt?.trim());
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-zinc-400">
          Remix von{" "}
          <span className="font-medium text-zinc-200">@{sourceUsername}</span>
        </p>

        <p className="text-sm leading-relaxed text-zinc-300">
          Was soll als Ausgangsbild dienen?
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setRemixBase("original")}
            className={`overflow-hidden rounded-xl border-2 text-left transition-all ${
              remixBase === "original"
                ? "border-orange-500 ring-2 ring-orange-500/30"
                : "border-zinc-700 hover:border-zinc-500"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={originalUrl ?? ""}
              alt="Original"
              className="aspect-[2/3] w-full bg-zinc-950 object-contain"
            />
            <p className="px-3 py-2 text-sm font-medium text-zinc-100">
              Originalfoto
            </p>
          </button>

          <button
            type="button"
            disabled={!memeUrl}
            onClick={() => memeUrl && setRemixBase("meme")}
            className={`overflow-hidden rounded-xl border-2 text-left transition-all ${
              !memeUrl
                ? "cursor-not-allowed opacity-50"
                : remixBase === "meme"
                  ? "border-orange-500 ring-2 ring-orange-500/30"
                  : "border-zinc-700 hover:border-zinc-500"
            }`}
          >
            {memeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={memeUrl}
                alt="Meme"
                className="aspect-[2/3] w-full bg-zinc-950 object-contain"
              />
            ) : (
              <MemeUnavailablePlaceholder />
            )}
            <p className="px-3 py-2 text-sm font-medium text-zinc-100">
              Fertiges Meme
            </p>
          </button>
        </div>

        {hasPrompt && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-800/60 px-4 py-3">
            <input
              type="checkbox"
              checked={adoptPrompt}
              onChange={(e) => setAdoptPrompt(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm leading-snug text-zinc-300">
              Original-Prompt übernehmen
              <span className="mt-1 block text-xs text-zinc-500 line-clamp-2">
                „{sourcePrompt!.trim()}“
              </span>
            </span>
          </label>
        )}

        <button
          type="button"
          onClick={() => void handleContinueFromBase()}
          className="rounded-full bg-orange-500 py-4 text-base font-semibold text-white transition-colors hover:bg-orange-400"
        >
          Weiter zum Zuschnitt
        </button>
      </div>
    );
  }

  if (step === "crop" && imageSrc) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-zinc-500">
          {cropSourceBase === "meme"
            ? "Das ganze Meme ist vorausgewählt. Du kannst den Rahmen bei Bedarf noch anpassen."
            : "Das gesamte Originalfoto ist vorausgewählt. Du kannst den Rahmen bei Bedarf noch anpassen."}
        </p>
        <ImageCropper
          imageSrc={imageSrc}
          secondImageSrc={cropSecondHistory ? secondImageSrc : null}
          onSecondImageSelected={(file) => void handleSecondImageSelect(file)}
          onCropComplete={handleCropComplete}
          onCancel={() => window.history.back()}
          primaryInitialCrop="maximize"
        />
      </div>
    );
  }

  const isAiLimitReached =
    aiQuota != null && aiQuota.remainingEffective <= 0;

  if (step === "chooseMode") {
    return (
      <MemeCreationModePicker
        introText="Wie soll dein Remix entstehen? Dieselben Optionen wie beim neuen Meme."
        aiQuota={aiQuota}
        onSelectMode={selectPostingMode}
      />
    );
  }

  if (step === "configure" && postingMode) {
    const previewSlides = [
      {
        key: "preview-1",
        src: croppedPreviewUrl ?? imageSrc!,
        alt: "Remix-Basis",
        label: "Bild 1",
      },
      ...((secondCroppedPreviewUrl ?? secondImageSrc)
        ? [
            {
              key: "preview-2",
              src: secondCroppedPreviewUrl ?? secondImageSrc!,
              alt: "Zweites Bild",
              label: "Bild 2",
            },
          ]
        : []),
    ];

    return (
      <MemeCreationConfigurePanel
        postingMode={postingMode}
        previewSlides={previewSlides}
        banner={
          <p className="rounded-xl border border-orange-500/35 bg-orange-950/45 px-3 py-2.5 text-xs leading-relaxed text-orange-100/90">
            Remix von @{sourceUsername} — es entsteht ein neuer Post in deinem
            aktiven Projekt.
          </p>
        }
        onBack={() => window.history.back()}
        userText={userText}
        onUserTextChange={setUserText}
        selectedCaption={selectedCaption}
        onToggleCaption={(idea) =>
          setSelectedCaption(selectedCaption === idea ? null : idea)
        }
        captions={captions}
        isLoadingCaptions={isLoadingCaptions}
        onGenerateCaptions={() => void handleGenerateCaptions()}
        experimentMemeArtKey={experimentMemeArtKey}
        onExperimentMemeArtKeyChange={setExperimentMemeArtKey}
        experimentMasterChoice={experimentMasterChoice}
        onExperimentMasterChoiceChange={setExperimentMasterChoice}
        experimentStylizationKey={experimentStylizationKey}
        onExperimentStylizationKeyChange={setExperimentStylizationKey}
        experimentMinimalLayout={experimentMinimalLayout}
        onExperimentMinimalLayoutChange={setExperimentMinimalLayout}
        isAiLimitReached={isAiLimitReached}
        submitLabel="Remix erstellen ✨"
        onSubmit={() => void handleSubmit()}
      />
    );
  }

  if (step === "submitting") {
    return (
      <div className="flex aspect-[2/3] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        <p className="text-sm font-medium text-zinc-300">Remix wird hochgeladen…</p>
      </div>
    );
  }

  return null;
}

function MemeUnavailablePlaceholder() {
  return (
    <div className="flex aspect-[2/3] items-center justify-center bg-zinc-800 text-xs text-zinc-500">
      Noch kein Meme
    </div>
  );
}
