"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
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
  secondImageSrc?: string | null;
  /** Geräte-Galerie / Datei */
  onSecondImageSelected?: (file: File) => void;
  /** z. B. In-App-Galerie — ersetzt den Datei-Dialog für Bild 2 */
  onSecondImagePick?: () => void;
  secondImagePickerLabel?: string;
  onCropComplete: (primaryBlob: Blob, secondBlob?: Blob | null) => void;
  onCancel: () => void;
  /** z. B. `1` für quadratischen Avatar */
  aspectRatio?: number;
  outputWidth?: number;
  outputHeight?: number;
  /** Bild 1: Standard 90 % — `maximize` = maximaler Rahmen (z. B. Remix vom fertigen Meme). */
  primaryInitialCrop?: "default" | "maximize";
}

/** Größtmöglicher, zentrierter Zuschnitt mit festem Seitenverhältnis (ganzes Bild sichtbar). */
function cropToPixelCrop(crop: Crop, width: number, height: number): PixelCrop {
  if (crop.unit === "px") {
    return crop as PixelCrop;
  }
  return {
    unit: "px",
    x: ((crop.x ?? 0) / 100) * width,
    y: ((crop.y ?? 0) / 100) * height,
    width: ((crop.width ?? 0) / 100) * width,
    height: ((crop.height ?? 0) / 100) * height,
  };
}

/** Sichtbare Bildfläche bei `object-fit: contain` (Letterboxing in der Img-Box). */
function getObjectContainRenderedRect(image: HTMLImageElement) {
  const boxW = image.clientWidth || image.width;
  const boxH = image.clientHeight || image.height;
  const naturalW = image.naturalWidth;
  const naturalH = image.naturalHeight;

  if (!boxW || !boxH || !naturalW || !naturalH) {
    return { offsetX: 0, offsetY: 0, width: boxW, height: boxH };
  }

  const boxAspect = boxW / boxH;
  const imageAspect = naturalW / naturalH;

  if (imageAspect > boxAspect) {
    const height = boxW / imageAspect;
    return { offsetX: 0, offsetY: (boxH - height) / 2, width: boxW, height };
  }

  const width = boxH * imageAspect;
  return { offsetX: (boxW - width) / 2, offsetY: 0, width, height: boxH };
}

function maximizeAspectCrop(
  aspectRatio: number,
  width: number,
  height: number,
): Crop {
  const imgAspect = width / height;
  if (imgAspect > aspectRatio) {
    return centerCrop(
      makeAspectCrop({ unit: "%", height: 100 }, aspectRatio, width, height),
      width,
      height,
    );
  }
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 100 }, aspectRatio, width, height),
    width,
    height,
  );
}

async function getCroppedBlob(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  outputWidth: number,
  outputHeight: number,
): Promise<Blob> {
  const rendered = getObjectContainRenderedRect(image);
  if (
    !rendered.width ||
    !rendered.height ||
    !image.naturalWidth ||
    !image.naturalHeight
  ) {
    throw new Error("Bildmaße nicht verfügbar");
  }

  const scaleX = image.naturalWidth / rendered.width;
  const scaleY = image.naturalHeight / rendered.height;

  const sx = (pixelCrop.x - rendered.offsetX) * scaleX;
  const sy = (pixelCrop.y - rendered.offsetY) * scaleY;
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

interface CropPaneProps {
  imageSrc: string;
  label: string;
  aspectRatio: number;
  initialCrop?: "default" | "maximize";
  onReady: (image: HTMLImageElement | null, crop: PixelCrop | undefined) => void;
}

function CropPane({
  imageSrc,
  label,
  aspectRatio,
  initialCrop = "default",
  onReady,
}: CropPaneProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const rendered = getObjectContainRenderedRect(img);
      const width = rendered.width || img.naturalWidth;
      const height = rendered.height || img.naturalHeight;
      const nextCrop =
        initialCrop === "maximize"
          ? maximizeAspectCrop(aspectRatio, width, height)
          : centerCrop(
              makeAspectCrop(
                { unit: "%", width: 90 },
                aspectRatio,
                width,
                height,
              ),
              width,
              height,
            );
      setCrop(nextCrop);
    },
    [aspectRatio, initialCrop],
  );

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img || !crop?.width || !crop?.height) return;
    const { width: w, height: h } = getObjectContainRenderedRect(img);
    if (!w || !h) return;
    onReady(img, cropToPixelCrop(crop, w, h));
  }, [crop, onReady]);

  return (
    <section className="flex w-full flex-col gap-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <div className="flex min-h-0 w-full justify-center p-1 sm:p-2">
        <ReactCrop
          className="mx-auto max-w-full"
          crop={crop}
          onChange={(nextCrop) => setCrop(nextCrop)}
          onComplete={(pixelCrop) => onReady(imgRef.current, pixelCrop)}
          aspect={aspectRatio}
          minWidth={60}
          keepSelection
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt={label}
            className="mx-auto block h-auto w-full max-w-full"
            style={{
              maxHeight: "min(68dvh, calc(100svh - 14rem))",
            }}
            onLoad={onImageLoad}
          />
        </ReactCrop>
      </div>
    </section>
  );
}

export function ImageCropper({
  imageSrc,
  secondImageSrc = null,
  onSecondImageSelected,
  onSecondImagePick,
  secondImagePickerLabel = "Zweites Bild hinzufügen",
  onCropComplete,
  onCancel,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  outputWidth = DEFAULT_OUTPUT_WIDTH,
  outputHeight = DEFAULT_OUTPUT_HEIGHT,
  primaryInitialCrop = "default",
}: ImageCropperProps) {
  const secondFileInputRef = useRef<HTMLInputElement>(null);
  const primaryCropRef = useRef<{
    image: HTMLImageElement | null;
    crop: PixelCrop | undefined;
  }>({ image: null, crop: undefined });
  const secondCropRef = useRef<{
    image: HTMLImageElement | null;
    crop: PixelCrop | undefined;
  }>({ image: null, crop: undefined });
  const [primaryCropComplete, setPrimaryCropComplete] = useState<PixelCrop>();
  const [secondCropComplete, setSecondCropComplete] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePrimaryReady = useCallback(
    (image: HTMLImageElement | null, crop: PixelCrop | undefined) => {
      primaryCropRef.current = { image, crop };
      setPrimaryCropComplete(crop);
    },
    [],
  );

  const handleSecondReady = useCallback(
    (image: HTMLImageElement | null, crop: PixelCrop | undefined) => {
      secondCropRef.current = { image, crop };
      setSecondCropComplete(crop);
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    const primary = primaryCropRef.current;
    if (!primary.image || !primary.crop) return;

    if (secondImageSrc) {
      const secondary = secondCropRef.current;
      if (!secondary.image || !secondary.crop) return;
    }

    setIsProcessing(true);

    try {
      const primaryBlob = await getCroppedBlob(
        primary.image,
        primary.crop,
        outputWidth,
        outputHeight,
      );

      if (secondImageSrc) {
        const secondary = secondCropRef.current;
        const secondBlob = await getCroppedBlob(
          secondary.image!,
          secondary.crop!,
          outputWidth,
          outputHeight,
        );
        onCropComplete(primaryBlob, secondBlob);
        return;
      }

      onCropComplete(primaryBlob);
    } catch (err) {
      console.error("Crop fehlgeschlagen:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [onCropComplete, outputWidth, outputHeight, secondImageSrc]);

  const canConfirm =
    !isProcessing &&
    Boolean(primaryCropComplete) &&
    (!secondImageSrc || Boolean(secondCropComplete));

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="meme-crop-viewport min-h-0 w-full max-h-[min(78dvh,calc(100svh-10rem))] overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-xl border border-zinc-800 [-webkit-overflow-scrolling:touch]">
        <div className="flex flex-col gap-4 py-1 sm:py-2">
          <CropPane
            imageSrc={imageSrc}
            label="Bild 1"
            aspectRatio={aspectRatio}
            initialCrop={primaryInitialCrop}
            onReady={handlePrimaryReady}
          />

          {secondImageSrc ? (
            <CropPane
              imageSrc={secondImageSrc}
              label="Bild 2"
              aspectRatio={aspectRatio}
              onReady={handleSecondReady}
            />
          ) : null}
        </div>
      </div>

      {(onSecondImageSelected || onSecondImagePick) && !secondImageSrc ? (
        <>
          {onSecondImageSelected && !onSecondImagePick ? (
            <input
              ref={secondFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                const input = e.target;
                input.value = "";
                if (file) onSecondImageSelected(file);
              }}
            />
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (onSecondImagePick) onSecondImagePick();
              else secondFileInputRef.current?.click();
            }}
            className="flex items-center justify-center gap-2 rounded-full border border-zinc-700 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
          >
            <ImagePlus className="h-4 w-4 shrink-0 text-orange-400" />
            {secondImagePickerLabel}
          </button>
        </>
      ) : null}

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
          disabled={!canConfirm}
          className="flex-1 rounded-full bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? "Verarbeite..." : "Zuschnitt übernehmen"}
        </button>
      </div>
    </div>
  );
}
