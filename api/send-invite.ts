import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";

interface InviteBody {
  emails: string[];
  ref?: string;
}

const resendApiKey = process.env.RESEND_API_KEY || "";
const fromAddress = process.env.RESEND_FROM_ADDRESS || "noreply@linkpaddy.samsontobi.tech";

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Allow requests from the Chrome extension
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!resendApiKey) {
    return res
      .status(500)
      .json({ error: "Email service is not configured (missing RESEND_API_KEY)." });
  }

  const { emails, ref } = req.body as InviteBody;

  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: "At least one email is required." });
  }

  if (emails.length > 10) {
    return res
      .status(400)
      .json({ error: "Maximum of 10 email addresses per request." });
  }

  const invalidEmails = emails.filter((e) => !isValidEmail(e));
  if (invalidEmails.length > 0) {
    return res
      .status(400)
      .json({ error: `Invalid email(s): ${invalidEmails.join(", ")}` });
  }

  const resend = new Resend(resendApiKey);

  const extensionLink = "https://linkpaddy.vercel.app";
  const inviterRef = ref
    ? `Your friend @${ref.replace(/^@/, "")} wants to share links with you on LinkPaddy.`
    : "A friend invited you to LinkPaddy!";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="font-size: 24px; margin-bottom: 8px;">You're invited to <span style="color: #6C5CE7;">LinkPaddy</span></h1>
      <p style="font-size: 16px; color: #4a4a4a; margin-bottom: 24px;">${inviterRef}</p>

      <p style="font-size: 14px; color: #666;">Get the browser extension and start sharing links instantly with your inner circle.</p>

      <div style="margin: 28px 0;">
        <a href="${extensionLink}" target="_blank" style="display: inline-block; padding: 14px 32px; background: #6C5CE7; color: #fff; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 15px;">Get the Extension</a>
      </div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

      <p style="font-size: 12px; color: #999;">
        LinkPaddy — The easiest way to share links with your inner circle.
        <br/>
        <a href="${extensionLink}/privacy.html" style="color: #6C5CE7;">Privacy Policy</a>
      </p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: `LinkPaddy <${fromAddress}>`,
      to: emails,
      subject: ref
        ? `@${ref.replace(/^@/, "")} invited you to LinkPaddy`
        : "You're invited to LinkPaddy",
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({
        error: error.message || "Failed to send invites. Check your Resend configuration.",
        detail: JSON.stringify(error),
      });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
    console.error("Email send error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to send invites.",
    });
  }
}
