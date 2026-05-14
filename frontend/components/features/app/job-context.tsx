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

interface SecondVariantTrack {
  jobId: string;
}

interface JobContextValue {
  activeJob: ActiveJob | null;
  completedJobData: JobStatusResponse | null;
  completionUiOpen: boolean;
  jobFailure: string | null;
  secondVariantTrack: SecondVariantTrack | null;
  startJob: (jobId: string, postId: string) => void;
  markJobCompleted: (data: JobStatusResponse) => void;
  openCompletionUi: () => void;
  closeCompletionUi: () => void;
  reportJobFailure: (message: string) => void;
  startSecondVariantTrack: (jobId: string) => void;
  clearSecondVariantTrack: () => void;
  clearJob: () => void;
}

const JobContext = createContext<JobContextValue | null>(null);

export function JobProvider({ children }: { children: React.ReactNode }) {
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [completedJobData, setCompletedJobData] =
    useState<JobStatusResponse | null>(null);
  const [completionUiOpen, setCompletionUiOpen] = useState(false);
  const [jobFailure, setJobFailure] = useState<string | null>(null);
  const [secondVariantTrack, setSecondVariantTrack] =
    useState<SecondVariantTrack | null>(null);

  const startJob = useCallback((jobId: string, postId: string) => {
    setActiveJob({ jobId, postId });
    setCompletedJobData(null);
    setCompletionUiOpen(false);
    setJobFailure(null);
    setSecondVariantTrack(null);
  }, []);

  const markJobCompleted = useCallback((data: JobStatusResponse) => {
    setActiveJob(null);
    setJobFailure(null);
    setCompletedJobData(data);
    setCompletionUiOpen((open) => open);
    if ((data.variantSignedUrls?.length ?? 0) >= 2) {
      setSecondVariantTrack(null);
    }
  }, []);

  const openCompletionUi = useCallback(() => {
    setCompletionUiOpen(true);
  }, []);

  const closeCompletionUi = useCallback(() => {
    setCompletionUiOpen(false);
  }, []);

  const reportJobFailure = useCallback((message: string) => {
    setActiveJob(null);
    setJobFailure(message);
  }, []);

  const startSecondVariantTrack = useCallback((jobId: string) => {
    setSecondVariantTrack({ jobId });
    setCompletionUiOpen(false);
  }, []);

  const clearSecondVariantTrack = useCallback(() => {
    setSecondVariantTrack(null);
  }, []);

  const clearJob = useCallback(() => {
    setActiveJob(null);
    setCompletedJobData(null);
    setCompletionUiOpen(false);
    setJobFailure(null);
    setSecondVariantTrack(null);
  }, []);

  const value = useMemo<JobContextValue>(
    () => ({
      activeJob,
      completedJobData,
      completionUiOpen,
      jobFailure,
      secondVariantTrack,
      startJob,
      markJobCompleted,
      openCompletionUi,
      closeCompletionUi,
      reportJobFailure,
      startSecondVariantTrack,
      clearSecondVariantTrack,
      clearJob,
    }),
    [
      activeJob,
      completedJobData,
      completionUiOpen,
      jobFailure,
      secondVariantTrack,
      startJob,
      markJobCompleted,
      openCompletionUi,
      closeCompletionUi,
      reportJobFailure,
      startSecondVariantTrack,
      clearSecondVariantTrack,
      clearJob,
    ],
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
