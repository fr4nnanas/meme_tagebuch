"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getFeedNotificationSettingsAction,
  saveFeedNotificationSettingsAction,
} from "@/lib/actions/feed-notifications";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerPushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    toast.error("Push wird in diesem Browser nicht unterstützt.");
    return false;
  }

  const vapidRes = await fetch("/api/push/vapid-public-key");
  const vapidJson = (await vapidRes.json()) as { publicKey: string | null };
  if (!vapidJson.publicKey) {
    toast.error("Push ist auf dem Server nicht konfiguriert (VAPID).");
    return false;
  }

  const reg = await navigator.serviceWorker.register("/sw.js");
  await reg.update();

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    toast.message("Benachrichtigungen wurden nicht erlaubt.");
    return false;
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidJson.publicKey),
  });

  const json = sub.toJSON();
  const saveRes = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

  if (!saveRes.ok) {
    const err = (await saveRes.json()) as { error?: string };
    toast.error(err.error ?? "Push-Anmeldung fehlgeschlagen");
    try {
      await sub.unsubscribe();
    } catch {
      /* ignore */
    }
    return false;
  }

  return true;
}

async function unregisterPushSubscription(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const json = sub.toJSON();
  if (json.endpoint) {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint }),
    });
  }
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
}

export function FeedNotificationSettings() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [includeOwn, setIncludeOwn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await getFeedNotificationSettingsAction();
      if (res.error && res.error !== "Nicht angemeldet") {
        toast.error(res.error);
      }
      setPushEnabled(res.settings.push_enabled);
      setIncludeOwn(res.settings.include_own_posts);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleMasterToggle(next: boolean) {
    startTransition(async () => {
      if (next) {
        const ok = await registerPushSubscription();
        if (!ok) {
          await saveFeedNotificationSettingsAction({ push_enabled: false });
          setPushEnabled(false);
          return;
        }
        const err = await saveFeedNotificationSettingsAction({ push_enabled: true });
        if (err.error) {
          toast.error(err.error);
          return;
        }
        setPushEnabled(true);
        toast.success("Push-Benachrichtigungen aktiviert.");
        return;
      }

      await unregisterPushSubscription();
      const err = await saveFeedNotificationSettingsAction({ push_enabled: false });
      if (err.error) {
        toast.error(err.error);
        return;
      }
      setPushEnabled(false);
      toast.success("Push-Benachrichtigungen ausgeschaltet.");
    });
  }

  function handleIncludeOwn(next: boolean) {
    startTransition(async () => {
      const err = await saveFeedNotificationSettingsAction({
        include_own_posts: next,
      });
      if (err.error) {
        toast.error(err.error);
        return;
      }
      setIncludeOwn(next);
    });
  }

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Lädt…
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-zinc-400">Feed & Push</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Bei neuen Memes im Projekt-Feed benachrichtigen (Browser-Push). Funktioniert
          am zuverlässigsten, wenn die App als Lesezeichen oder installierte Web-App
          genutzt wird.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-800/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {pushEnabled ? (
              <Bell className="h-4 w-4 text-orange-400" aria-hidden />
            ) : (
              <BellOff className="h-4 w-4 text-zinc-500" aria-hidden />
            )}
            <span className="text-sm font-medium text-zinc-200">
              Push bei neuen Memes
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pushEnabled}
            disabled={isPending}
            onClick={() => handleMasterToggle(!pushEnabled)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              pushEnabled ? "bg-orange-500" : "bg-zinc-700"
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                pushEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={includeOwn}
            disabled={isPending || !pushEnabled}
            onChange={(e) => handleIncludeOwn(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500 disabled:opacity-40"
          />
          <span>
            Auch bei eigenen Veröffentlichungen benachrichtigen (z.B. zweites Gerät).
            Standard ist nur bei anderen Mitgliedern.
          </span>
        </label>
      </div>
    </section>
  );
}
