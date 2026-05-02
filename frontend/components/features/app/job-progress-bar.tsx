"use client";

import { useEffect, useRef, useState } from "react";
import { useJobContext } from "@/components/features/app/job-context";
import { useJobPolling } from "@/hooks/use-job-polling";
import type { JobStatusResponse } from "@/app/api/meme/job-status/[jobId]/route";

// Simulierter Fortschritt solange der Job läuft (0–90%, nie 100% bevor fertig)
function useProgressSimulation(isActive: boolean) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      return;
    }

    // Schnell auf 30%, dann langsam auf 85%
    setProgress(5);
    const steps = [
      { target: 30, delay: 500 },
      { target: 55, delay: 2000 },
      { target: 70, delay: 4000 },
      { target: 82, delay: 8000 },
      { target: 87, delay: 15000 },
    ];

    steps.forEach(({ target, delay }) => {
      rafRef.current = setTimeout(() => setProgress(target), delay);
    });

    return () => {
      if (rafRef.current) clearTimeout(rafRef.current);
    };
  }, [isActive]);

  return progress;
}

function GlobalProgressBar() {
  const { activeJob, markJobCompleted } = useJobContext();
  const [visible, setVisible] = useState(false);
  const [completed, setCompleted] = useState(false);

  const isActive = !!activeJob;
  const progress = useProgressSimulation(isActive);

  const handleCompleted = (data: JobStatusResponse) => {
    setCompleted(true);
    markJobCompleted(data);
    // Bar kurz auf 100% zeigen, dann ausblenden
    setTimeout(() => setVisible(false), 600);
    setTimeout(() => setCompleted(false), 700);
  };

  useJobPolling({
    jobId: activeJob?.jobId ?? null,
    onCompleted: handleCompleted,
  });

  useEffect(() => {
    if (isActive) {
      setVisible(true);
      setCompleted(false);
    }
  }, [isActive]);

  if (!visible) return null;

  const displayProgress = completed ? 100 : progress;

  return (
    <div className="fixed left-0 right-0 top-0 z-50 h-1">
      <div
        className="h-full bg-orange-500 transition-all duration-500 ease-out"
        style={{ width: `${displayProgress}%` }}
      />
    </div>
  );
}

export { GlobalProgressBar };
