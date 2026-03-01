import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";
import { checkRateLimit, safeError } from "@/lib/security";
import { getInstallId } from "@/lib/install-id";
import { log } from "@/lib/logger";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const FEEDBACK_REPO = process.env.NEXT_PUBLIC_GITHUB_FEEDBACK_REPO ?? "";

async function handler(req: Request) {
  // Rate limit: max 5 feedback submissions per minute per IP
  const rateLimitResult = checkRateLimit(req, "feedback", 5, 60_000);
  if (rateLimitResult) return rateLimitResult;

  if (!GITHUB_TOKEN) {
    return NextResponse.json(
      { error: "Feedback is not configured. Set GITHUB_TOKEN in your environment." },
      { status: 503 }
    );
  }

  if (!FEEDBACK_REPO) {
    return NextResponse.json(
      { error: "Feedback repo is not configured. Set NEXT_PUBLIC_GITHUB_FEEDBACK_REPO." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { description, screenshotBase64, consoleLogs, pageUrl, userAgent } = body as {
      description?: string;
      screenshotBase64?: string;
      consoleLogs?: string;
      pageUrl?: string;
      userAgent?: string;
    };

    if (!description || !description.trim()) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }

    const installId = await getInstallId();
    const timestamp = new Date().toISOString();

    // Upload screenshot to repo if provided
    let screenshotUrl = "";
    if (screenshotBase64) {
      try {
        const screenshotPath = `feedback-screenshots/${installId}-${Date.now()}.png`;
        const uploadRes = await fetch(
          `https://api.github.com/repos/${FEEDBACK_REPO}/contents/${screenshotPath}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: `feedback screenshot from ${installId}`,
              content: screenshotBase64,
            }),
          }
        );

        if (uploadRes.ok) {
          const uploadData = (await uploadRes.json()) as {
            content?: { download_url?: string };
          };
          screenshotUrl = uploadData.content?.download_url ?? "";
        } else {
          log.api.warn("[feedback] Failed to upload screenshot", {
            status: uploadRes.status,
          });
        }
      } catch (uploadErr) {
        log.api.warn("[feedback] Screenshot upload error", {
          error: uploadErr instanceof Error ? uploadErr.message : "unknown",
        });
      }
    }

    // Build issue body
    const screenshotSection = screenshotUrl
      ? `## Screenshot\n![screenshot](${screenshotUrl})`
      : "## Screenshot\n_No screenshot captured._";

    const logsSection = consoleLogs
      ? `## Console Logs\n\`\`\`text\n${consoleLogs.slice(0, 3000)}\n\`\`\``
      : "## Console Logs\n_No logs captured._";

    const issueBody = [
      `## Description`,
      description.trim(),
      "",
      screenshotSection,
      "",
      `## Environment`,
      `- **Install ID**: \`${installId}\``,
      `- **URL**: ${pageUrl || "N/A"}`,
      `- **User Agent**: ${userAgent || "N/A"}`,
      `- **Timestamp**: ${timestamp}`,
      "",
      logsSection,
    ].join("\n");

    // Build title from first line of description
    const firstLine = description.trim().split("\n")[0] || "Feedback";
    const titleCompact = firstLine.replace(/\s+/g, " ").trim();
    const title = titleCompact.length > 80
      ? `[${installId}] ${titleCompact.slice(0, 80)}...`
      : `[${installId}] ${titleCompact}`;

    // Create GitHub issue
    const issueRes = await fetch(
      `https://api.github.com/repos/${FEEDBACK_REPO}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body: issueBody,
          labels: ["bug", "feedback"],
        }),
      }
    );

    if (!issueRes.ok) {
      const errText = await issueRes.text();
      log.api.error("[feedback] GitHub issue creation failed", {
        status: issueRes.status,
        body: errText.slice(0, 500),
      });
      return NextResponse.json(
        { error: "Failed to create feedback issue." },
        { status: 502 }
      );
    }

    const issueData = (await issueRes.json()) as {
      html_url?: string;
      number?: number;
    };

    log.api.info("[feedback] Issue created", {
      installId,
      issue: issueData.number,
      url: issueData.html_url,
    });

    return NextResponse.json({
      success: true,
      issueUrl: issueData.html_url,
      issueNumber: issueData.number,
    });
  } catch (err) {
    return safeError("Failed to submit feedback", 500, err);
  }
}

export const POST = withLogging(handler);
