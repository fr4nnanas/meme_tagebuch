"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { JobStatusResponse } from "@/app/api/meme/job-status/[jobId]/route";

interface ActiveJob {
  jobId: string;
  postId: string;
}

interface CompletedJobData extends JobStatusResponse {
  handled: boolean;
}

interface JobContextValue {
  activeJob: ActiveJob | null;
  completedJobData: CompletedJobData | null;
  startJob: (jobId: string, postId: string) => void;
  markJobCompleted: (data: JobStatusResponse) => void;
  markJobHandled: () => void;
  clearJob: () => void;
}

const JobContext = createContext<JobContextValue | null>(null);

export function JobProvider({ children }: { children: React.ReactNode }) {
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [completedJobData, setCompletedJobData] =
    useState<CompletedJobData | null>(null);

  const startJob = useCallback((jobId: string, postId: string) => {
    setActiveJob({ jobId, postId });
    setCompletedJobData(null);
  }, []);

  const markJobCompleted = useCallback((data: JobStatusResponse) => {
    setActiveJob(null);
    setCompletedJobData({ ...data, handled: false });
  }, []);

  const markJobHandled = useCallback(() => {
    setCompletedJobData((prev) => (prev ? { ...prev, handled: true } : null));
  }, []);

  const clearJob = useCallback(() => {
    setActiveJob(null);
    setCompletedJobData(null);
  }, []);

  const value = useMemo<JobContextValue>(
    () => ({
      activeJob,
      completedJobData,
      startJob,
      markJobCompleted,
      markJobHandled,
      clearJob,
    }),
    [activeJob, completedJobData, startJob, markJobCompleted, markJobHandled, clearJob],
  );

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
}

export function useJobContext(): JobContextValue {
  const ctx = useContext(JobContext);
  if (!ctx) {
    throw new Error(
      "useJobContext muss innerhalb von JobProvider verwendet werden.",
    );
  }
  return ctx;
}
