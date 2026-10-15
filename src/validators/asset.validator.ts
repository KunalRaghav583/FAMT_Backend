import { z } from "zod";
import { AssetStatus } from "@prisma/client";

export const assetStatusSchema = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "Under maintenance" || trimmed === "Under_maintenance") {
        return AssetStatus.Under_maintenance;
      }
      return trimmed;
    }
    return val;
  },
  z.nativeEnum(AssetStatus, {
    errorMap: () => ({
      message: "Status must be one of: 'Active', 'Under maintenance', or 'Retired'",
    }),
  }),
);

export const listAssetsQuerySchema = z.object({
  query: z
    .object({
      search: z.string().optional(),
      siteId: z.string().uuid("Invalid site ID format: must be a valid UUID").optional(),
      status: assetStatusSchema.optional(),
      page: z.coerce
        .number()
        .int()
        .min(1, "Page must be an integer greater than or equal to 1")
        .default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    })
    .strict(),
});

export const createAssetSchema = z.object({
  body: z
    .object({
      name: z.string().min(2, "Asset name must be at least 2 characters").max(100),
      type: z.string().min(2, "Asset type must be at least 2 characters").max(50),
      serialNo: z.string().min(2, "Serial number must be at least 2 characters").max(50),
      status: assetStatusSchema.default(AssetStatus.Active),
      siteId: z.string().uuid("Invalid site ID format: must be a valid UUID"),
    })
    .strict(),
});

export const updateAssetSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid asset ID format: must be a valid UUID"),
  }),
  body: z
    .object({
      name: z
        .string()
        .min(2, "Asset name must be at least 2 characters")
        .max(100)
        .optional(),
      type: z
        .string()
        .min(2, "Asset type must be at least 2 characters")
        .max(50)
        .optional(),
      serialNo: z
        .string()
        .min(2, "Serial number must be at least 2 characters")
        .max(50)
        .optional(),
      status: assetStatusSchema.optional(),
      siteId: z.string().uuid("Invalid site ID format: must be a valid UUID").optional(),
    })
    .strict()
    .refine(
      (data) => Object.keys(data).length > 0,
      "At least one field must be provided for update",
    ),
});

export const assetIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid asset ID format: must be a valid UUID"),
  }),
});
