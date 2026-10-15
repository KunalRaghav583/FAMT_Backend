import { z } from "zod";

export const createCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid ticket ID format: must be a valid UUID"),
  }),
  body: z
    .object({
      body: z
        .string()
        .min(1, "Comment body cannot be empty")
        .max(2000, "Comment cannot exceed 2000 characters"),
    })
    .strict(),
});

export const listCommentsSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid ticket ID format: must be a valid UUID"),
  }),
});
