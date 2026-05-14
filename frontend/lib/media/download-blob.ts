import { saveAs } from "file-saver";

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  saveAs(blob, filename);
}
