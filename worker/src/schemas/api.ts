import { z } from "zod";
import { apiActionNames } from "../types";

export const ApiActionSchema = z.enum(apiActionNames);

export const ApiRequestSchema = z.object({
  action: ApiActionSchema,
  requestId: z.string().min(1, "requestId must be provided"),
  payload: z.unknown(),
  sessionToken: z.string().optional(),
});

export type ApiRequestInput = z.infer<typeof ApiRequestSchema>;
