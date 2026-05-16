import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { RemixFlow } from "@/components/features/remix/remix-flow";

export default function RemixPage() {
  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Remix</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Aus einem bestehenden Meme oder Foto etwas Neues erstellen.
      </p>

      <div className="mt-5">
        <Suspense
          fallback={
            <div className="flex justify-center py-12 text-zinc-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          }
        >
          <RemixFlow />
        </Suspense>
      </div>
    </div>
  );
}
