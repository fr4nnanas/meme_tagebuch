export function blobToBase64(blob: Blob): Promise<string> {
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

export type MemeWizardHistoryStep =
  | "crop"
  | "chooseMode"
  | "configure"
  | "submitting";

export type MemeWizardHistoryState = {
  memeWizardStep: MemeWizardHistoryStep;
  cropSecond?: boolean;
};

export function pushMemeWizardHistoryStep(
  step: MemeWizardHistoryStep,
  options?: { cropSecond?: boolean },
) {
  if (typeof window === "undefined") return;
  const state: MemeWizardHistoryState = { memeWizardStep: step };
  if (step === "crop") {
    state.cropSecond = Boolean(options?.cropSecond);
  }
  window.history.pushState(state, "", window.location.href);
}
