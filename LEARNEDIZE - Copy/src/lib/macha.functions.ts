import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(8000),
});

const SYSTEM_PROMPT =
  "You are Macha, an erudite archival research assistant for the learnedize human-scholarship archive. Respond with the calm precision of a senior librarian: concise, sourced where possible, formal but warm. Use plain prose; no markdown headers.";

export const askMacha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        messages: z.array(MessageSchema).min(1).max(40),
      })
      .parse(data),
  )
.handler(async ({ data }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");


  const systemTexts: string[] = [SYSTEM_PROMPT];

  const convo = data.messages.filter((m) => {
    if (m.role === "system") {
      systemTexts.push(m.content);
      return false;
    }
    return true;
  });

  const contents = convo.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  async function callGemini(model: string) {
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemTexts.join("\n\n") }],
          },
          contents,
        }),
      }
    );
  }

  let res = await callGemini("gemini-2.5-flash");


  if (!res.ok) {
    const text = await res.text();

    if (res.status === 429) {
      throw new Error(`429 ERROR: ${text}`);
    }

    throw new Error(`Macha error: ${text.slice(0, 500)}`);
  }

  const json = await res.json();

  const content =
    json?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("") ?? "";

  return { content };
});

