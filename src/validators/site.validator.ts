import { z } from "zod";

export const createSiteSchema = z.object({
  body: z
    .object({
      name: z.string().min(2, "Site name must be at least 2 characters").max(100),
      location: z.string().min(2, "Location must be at least 2 characters").max(100),
    })
    .strict(),
});

export const updateSiteSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid site ID format: must be a valid UUID"),
  }),
  body: z
    .object({
      name: z
        .string()
        .min(2, "Site name must be at least 2 characters")
        .max(100)
        .optional(),
      location: z
        .string()
        .min(2, "Location must be at least 2 characters")
        .max(100)
        .optional(),
    })
    .strict()
    .refine(
      (data) => Object.keys(data).length > 0,
      "At least one field must be provided for update",
    ),
});

export const siteIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid site ID format: must be a valid UUID"),
  }),
});
