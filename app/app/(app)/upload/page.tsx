import { UploadFlow } from "@/components/features/upload/upload-flow";

export default function UploadPage() {
  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
        Neues Meme
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        Foto hochladen, KI erstellt daraus ein Meme.
      </p>

      <div className="mt-5">
        <UploadFlow />
      </div>
    </div>
  );
}
