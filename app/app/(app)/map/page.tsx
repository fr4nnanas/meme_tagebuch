import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MapContent } from "@/components/features/map/map-content";

export default async function MapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    // pb-24 vom Layout-Main kompensieren – Karte füllt den gesamten sichtbaren Bereich
    <div className="flex h-[calc(100dvh-6rem)] flex-col">
      <MapContent />
    </div>
  );
}
