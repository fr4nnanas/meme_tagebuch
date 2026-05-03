"use client";

import { useCallback, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import "./image-cropper.css";

// Standard: 2:3 (Portrait) – Meme-Upload / OpenAI 1024×1536
const DEFAULT_ASPECT_RATIO = 2 / 3;
const DEFAULT_OUTPUT_WIDTH = 1024;
const DEFAULT_OUTPUT_HEIGHT = 1536;

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (blob: Blob) => void;
  onCancel: () => void;
  /** z. B. `1` für quadratischen Avatar */
  aspectRatio?: number;
  outputWidth?: number;
  outputHeight?: number;
}

async function getCroppedBlob(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  outputWidth: number,
  outputHeight: number,
): Promise<Blob> {
  // react-image-crop: PixelCrop bezieht sich auf die angezeigte Größe (clientWidth/Height).
  // drawImage erwartet Koordinaten in natürlichen Bildpixeln — sonst nur ein kleiner
  // Ausschnitt der Quelle → „stark reingezoomt“ bei Handy-Fotos.
  const displayW = image.clientWidth || image.width;
  const displayH = image.clientHeight || image.height;
  if (!displayW || !displayH || !image.naturalWidth || !image.naturalHeight) {
    throw new Error("Bildmaße nicht verfügbar");
  }
  const scaleX = image.naturalWidth / displayW;
  const scaleY = image.naturalHeight / displayH;

  const sx = pixelCrop.x * scaleX;
  const sy = pixelCrop.y * scaleY;
  const sWidth = pixelCrop.width * scaleX;
  const sHeight = pixelCrop.height * scaleY;

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context nicht verfügbar");

  ctx.drawImage(
    image,
    sx,
    sy,
    sWidth,
    sHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas konnte nicht als Blob exportiert werden"));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function ImageCropper({
  imageSrc,
  onCropComplete,
  onCancel,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  outputWidth = DEFAULT_OUTPUT_WIDTH,
  outputHeight = DEFAULT_OUTPUT_HEIGHT,
}: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      const centered = centerCrop(
        makeAspectCrop(
          { unit: "%", width: 90 },
          aspectRatio,
          width,
          height,
        ),
        width,
        height,
      );
      setCrop(centered);
    },
    [aspectRatio],
  );

  const handleConfirm = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;
    setIsProcessing(true);

    try {
      const blob = await getCroppedBlob(
        imgRef.current,
        completedCrop,
        outputWidth,
        outputHeight,
      );
      onCropComplete(blob);
    } catch (err) {
      console.error("Crop fehlgeschlagen:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [completedCrop, onCropComplete, outputWidth, outputHeight]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div
        className="meme-crop-viewport min-h-0 w-full max-h-[min(78dvh,calc(100svh-10rem))] overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-xl border border-zinc-800 [-webkit-overflow-scrolling:touch]"
      >
        <div className="flex min-h-0 w-full justify-center p-1 sm:p-2">
          <ReactCrop
            className="mx-auto max-w-full"
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspectRatio}
            minWidth={60}
            keepSelection
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Zu schneidendes Foto"
              className="mx-auto block h-auto min-h-0 w-full min-w-0 max-w-full object-contain"
              style={{
                maxHeight: "min(68dvh, calc(100svh - 14rem))",
              }}
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-zinc-700 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={!completedCrop || isProcessing}
          className="flex-1 rounded-full bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? "Verarbeite..." : "Zuschnitt übernehmen"}
        </button>
      </div>
    </div>
  );
}
