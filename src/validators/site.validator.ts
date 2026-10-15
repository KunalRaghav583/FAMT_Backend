import { z } from "zod";

export const createSiteSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Site name must be at least 2 characters").max(100),
    location: z.string().min(2, "Location must be at least 2 characters").max(100),
  }),
});

export const updateSiteSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Site ID is required"),
  }),
  body: z.object({
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
  }),
});

export const siteIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Site ID is required"),
  }),
});
