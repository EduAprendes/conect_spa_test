import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

let google: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getModel() {
  if (!google) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY no está configurado");
    google = createGoogleGenerativeAI({ apiKey });
  }
  return google("gemini-3.8-flash");
}

const SYSTEM_PROMPT =
  "Sos el asistente de atención al cliente de Conect Spa por Instagram. " +
  "Respondé de forma breve, cordial y directa. Si no sabés algo, decilo con honestidad " +
  "en vez de inventar información.";

export async function generateReply(userMessage: string): Promise<string> {
  const { text } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    prompt: userMessage,
  });

  return text;
}
