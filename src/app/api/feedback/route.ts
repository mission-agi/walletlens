import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";
import { checkRateLimit, safeError } from "@/lib/security";
import { getInstallId } from "@/lib/install-id";
import { prisma } from "@/lib/db";

const GOOGLE_FORM_ID = "1FAIpQLSf_aqj_cLk0wfGV41k5osuLfP4Z_pcQ-SA7ApzdDQj-nviQ5w";
const FORM_FIELDS = {
  description: "entry.1578104676",
  installId: "entry.1193686228",
  pageUrl: "entry.2110467078",
  userAgent: "entry.688108414",
  consoleLogs: "entry.823830068",
};

async function submitToGoogleForm(data: Record<string, string>): Promise<boolean> {
  const params = new URLSearchParams();
  for (const [key, entryId] of Object.entries(FORM_FIELDS)) {
    if (data[key]) {
      params.set(entryId, data[key]);
    }
  }

  try {
    const res = await fetch(
      `https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/formResponse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }
    );
    // Google Forms returns 200 on success (even for invalid entries)
    return res.ok;
  } catch {
    // Don't fail the whole request if Google Form submission fails
    // The feedback is already saved locally
    return false;
  }
}

async function handler(req: Request) {
  const rateLimitResult = checkRateLimit(req, "feedback", 10, 60_000);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await req.json();
    const { description, consoleLogs, pageUrl, userAgent } = body as {
      description?: string;
      consoleLogs?: string;
      pageUrl?: string;
      userAgent?: string;
    };

    if (!description || !description.trim()) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }

    const installId = await getInstallId();

    // Save feedback locally (temporary, until Google Form submission succeeds)
    const feedback = await prisma.feedback.create({
      data: {
        installId,
        description: description.trim(),
        pageUrl: pageUrl || null,
        userAgent: userAgent || null,
        consoleLogs: consoleLogs || null,
      },
    });

    // Submit to Google Form in the background (server-side, no popup)
    const googleFormSubmitted = await submitToGoogleForm({
      description: description.trim(),
      installId,
      pageUrl: pageUrl || "",
      userAgent: userAgent || "",
      consoleLogs: (consoleLogs || "").slice(0, 2000),
    });

    // If Google Form submission succeeded, delete the local copy
    // No need to store data locally once it's been delivered
    if (googleFormSubmitted) {
      await prisma.feedback.delete({ where: { id: feedback.id } }).catch(() => {
        // Non-critical — local cleanup failure shouldn't affect the response
      });
    }

    return NextResponse.json({ success: true, googleFormSubmitted });
  } catch (err) {
    return safeError("Failed to submit feedback", 500, err);
  }
}

export const POST = withLogging(handler);
