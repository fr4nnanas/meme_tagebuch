"use client";

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import type { JobStatusResponse } from "@/app/api/meme/job-status/[jobId]/route";

const POLL_INTERVAL_MS = 3000;

interface UseJobPollingOptions {
  jobId: string | null;
  onCompleted: (data: JobStatusResponse) => void;
  onFailed?: (errorMsg: string) => void;
}

export function useJobPolling({
  jobId,
  onCompleted,
  onFailed,
}: UseJobPollingOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isRunningRef.current = false;
  }, []);

  const poll = useCallback(async () => {
    if (!jobId || isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      const res = await fetch(`/api/meme/job-status/${jobId}`);
      if (!res.ok) {
        isRunningRef.current = false;
        return;
      }

      const data = (await res.json()) as JobStatusResponse;

      if (data.status === "completed") {
        stopPolling();
        toast.success("Dein Meme ist fertig! 🎉");
        onCompleted(data);
      } else if (data.status === "failed") {
        stopPolling();
        const errorMsg = data.errorMsg ?? "KI-Verarbeitung fehlgeschlagen";
        toast.error(`Fehler: ${errorMsg}`);
        onFailed?.(errorMsg);
      }
    } catch {
      // Netzwerkfehler ignorieren – beim nächsten Intervall erneut versuchen
    } finally {
      isRunningRef.current = false;
    }
  }, [jobId, onCompleted, onFailed, stopPolling]);

  useEffect(() => {
    if (!jobId) return;

    // Sofortiger erster Poll, dann alle 3 Sekunden
    void poll();
    intervalRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [jobId, poll, stopPolling]);

  return { stopPolling };
}
