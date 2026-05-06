import { NextResponse } from "next/server";
import { classifyWithProvider, generateRequestWithProvider } from "@/lib/ai/providerRouter";
import { redactCaseInput } from "@/lib/ai/redaction";
import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import type { CaseInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { task?: "classify" | "draft_request"; input?: CaseInput };
    if (!body.input) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }

    const redacted = redactCaseInput(body.input);

    if (body.task === "draft_request") {
      const classification = classifyCase(body.input);
      const result = await generateRequestWithProvider({ ...redacted, classification });
      return NextResponse.json({ ok: true, result });
    }

    const result = await classifyWithProvider(redacted);
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json(
      {
        ok: true,
        result: {
          ok: true,
          provider: "rule",
          data: null,
          redacted: true,
          fallbackUsed: true,
          safeMessage: "기본 모드로 안내했습니다.",
        },
      },
      { status: 200 },
    );
  }
}

export function localFallback(input: CaseInput) {
  const classification = classifyCase(input);
  return {
    classification,
    draft: generateRequestDraft(input, classification),
  };
}
