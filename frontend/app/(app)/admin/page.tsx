import { redirect } from "next/navigation";

/** Alte URL: weiter zur einheitlichen Einstellungsseite (Admin-Reiter). */
export default function AdminPage() {
  redirect("/settings?tab=admin");
}
