import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ExtractSchema = z.object({
  name: z.string().nullable(),
  category: z.string().nullable(),
  patient_ref: z.string().nullable(),
  ip_number: z.string().nullable(),
  patient_height_cm: z.number().nullable(),
  patient_weight_kg: z.number().nullable(),
  diagnosis: z.string().nullable(),
  surgical_approach: z.string().nullable(),
  surgeon: z.string().nullable(),
  assistant_surgeon: z.string().nullable(),
  pa_names: z.array(z.string()).nullable(),
  closed_by: z.string().nullable(),
  complications: z.string().nullable(),
  notes: z.string().nullable(),
});

export type ExtractedProcedure = z.infer<typeof ExtractSchema>;

export const extractProcedureFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imageDataUrl: string }) => {
    if (!input?.imageDataUrl?.startsWith("data:image/")) throw new Error("Invalid image data");
    if (input.imageDataUrl.length > 4_000_000) throw new Error("Image is too large — try a smaller photo");
    return input;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI is not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3.6-flash");

    const system = [
      "You extract clinical procedure details from a photo (handwritten notes, a form, or a whiteboard) for a medical professional's procedure logbook (CaseSync).",
      "Return null for any field not clearly present. Do NOT invent values.",
      "Fields:",
      "- name: short procedure name (e.g. 'Peripheral IV placement', 'Laceration repair').",
      "- category: one of Cardiac surgery, Airway, Vascular access, Suturing, Incision & drainage, Lumbar puncture, Splinting/Casting, Joint injection, Skin biopsy, Ultrasound, Endoscopy, Other. Use Other if unsure.",
      "- patient_ref: MRN, initials, or patient identifier only. No full names.",
      "- ip_number: inpatient / IP / admission number if written.",
      "- patient_height_cm: patient height in centimetres as a number, else null.",
      "- patient_weight_kg: patient weight in kilograms as a number, else null.",
      "- diagnosis: clinical diagnosis / indication.",
      "- surgical_approach: surgical approach, incision, or anatomical site (e.g. 'median sternotomy', 'right radial').",
      "- surgeon: primary surgeon's name if written. Return just the name without a title.",
      "- assistant_surgeon: assistant surgeon's name if written. Just the name.",
      "- pa_names: array of physician assistant names present on the case, or null.",
      "- closed_by: name of the person who closed the incision, if written.",
      "- complications: any noted complications, else null.",
      "- notes: any remaining relevant free text.",
    ].join("\n");

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: ExtractSchema }),
        instructions: system,
        allowSystemInMessages: true,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the procedure details from this image." },
              {
                type: "file",
                mediaType: data.imageDataUrl.slice(5, data.imageDataUrl.indexOf(";")) || "image/jpeg",
                data: data.imageDataUrl,
              },
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