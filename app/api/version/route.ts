import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  // Vercel supplies the source commit at both build and runtime. The deployment URL is
  // a useful fallback for manual deployments that do not expose Git system variables.
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_URL ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    "local";

  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
