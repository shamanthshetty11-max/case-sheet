import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ExtractSchema = z.object({
  name: z.string().nullable(),
  category: z.string().nullable(),
  patient_ref: z.string().nullable(),
  indication: z.string().nullable(),
  site: z.string().nullable(),
  surgeon: z.string().nullable(),
  assistant_surgeon: z.string().nullable(),
  role: z.string().nullable(),
  difficulty: z.string().nullable(),
  outcome: z.string().nullable(),
  complications: z.string().nullable(),
  lessons: z.string().nullable(),
  notes: z.string().nullable(),
});

export type ExtractedProcedure = z.infer<typeof ExtractSchema>;

export const extractProcedureFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imageDataUrl: string }) => {
    if (!input?.imageDataUrl?.startsWith("data:image/")) throw new Error("Invalid image data");
    return input;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI is not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3.6-flash");

    const system = [
      "You extract clinical procedure details from a photo (handwritten notes, a form, or a whiteboard) for a physician assistant's procedure logbook.",
      "Return null for any field not clearly present. Do NOT invent values.",
      "Fields:",
      "- name: short procedure name (e.g. 'Peripheral IV placement', 'Laceration repair').",
      "- category: one of Airway, Vascular access, Suturing, Incision & drainage, Lumbar puncture, Splinting/Casting, Joint injection, Skin biopsy, Cardiac, Ultrasound, Endoscopy, Other. Use Other if unsure.",
      "- patient_ref: MRN, initials, or patient identifier only. No full names.",
      "- indication: clinical reason for the procedure.",
      "- site: anatomical site or room/location.",
      "- surgeon: primary surgeon's name if written.",
      "- assistant_surgeon: assistant surgeon's name if written.",
      "- role: one of observed, assisted, performed, supervised.",
      "- difficulty: '1' to '5' as a string, or null.",
      "- outcome: short outcome (e.g. 'successful', 'aborted').",
      "- complications: any noted complications, else null.",
      "- lessons: learning points or reflection.",
      "- notes: any remaining relevant free text.",
    ].join("\n");

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: ExtractSchema }),
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the procedure details from this image." },
              { type: "image", image: data.imageDataUrl },
            ],
          },
        ],
      });
      return output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try { return ExtractSchema.parse(JSON.parse(error.text ?? "{}")); } catch { /* ignore */ }
      }
      throw error;
    }
  });