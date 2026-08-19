import { z } from "zod";

export const searchEventSelectionSchema = z.object({
  eventId: z.uuid(),
  productId: z.number().int().positive(),
  position: z.number().int().positive(),
});

export type SearchEventSelectionInput = z.infer<typeof searchEventSelectionSchema>;
