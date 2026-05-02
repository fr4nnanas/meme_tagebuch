import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildJobStatusResponse } from "@/lib/meme/build-job-status-response";

export type { JobStatusResponse } from "@/lib/meme/job-status-types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const { data: job, error } = await supabase
      .from("jobs")
      .select("id, status, post_id, error_msg")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !job) {
      return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
    }

    const payload = await buildJobStatusResponse(supabase, job);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[job-status]", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}
