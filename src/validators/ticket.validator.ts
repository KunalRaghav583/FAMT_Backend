import { z } from "zod";
import { TicketPriority, TicketStatus } from "@prisma/client";

export const ticketStatusSchema = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "In progress" || trimmed === "In_progress") {
        return TicketStatus.In_progress;
      }
      return trimmed;
    }
    return val;
  },
  z.nativeEnum(TicketStatus, {
    errorMap: () => ({
      message: "Status must be one of: 'Open', 'In progress', 'Resolved', 'Closed'",
    }),
  }),
);

export const ticketPrioritySchema = z.nativeEnum(TicketPriority, {
  errorMap: () => ({
    message: "Priority must be one of: 'Low', 'Medium', 'High', 'Critical'",
  }),
});

export const listTicketsQuerySchema = z.object({
  query: z
    .object({
      status: ticketStatusSchema.optional(),
      priority: ticketPrioritySchema.optional(),
      assigneeId: z
        .string()
        .uuid("Invalid assignee ID format: must be a valid UUID")
        .optional(),
      assetId: z
        .string()
        .uuid("Invalid asset ID format: must be a valid UUID")
        .optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    })
    .strict(),
});

export const createTicketSchema = z.object({
  body: z
    .object({
      title: z.string().min(2, "Title must be at least 2 characters").max(150),
      description: z.string().min(2, "Description must be at least 2 characters"),
      priority: ticketPrioritySchema,
      dueDate: z.coerce.date({
        errorMap: () => ({ message: "Due date must be a valid ISO date" }),
      }),
      assetId: z.string().uuid("Invalid asset ID format: must be a valid UUID"),
      assigneeId: z
        .string()
        .uuid("Invalid assignee ID format: must be a valid UUID")
        .nullable()
        .optional(),
      status: ticketStatusSchema
        .refine((val) => val === TicketStatus.Open, {
          message: "New tickets must always start with 'Open' status",
        })
        .optional(),
    })
    .strict(),
});

export const updateTicketSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid ticket ID format: must be a valid UUID"),
  }),
  body: z
    .object({
      title: z.string().min(2, "Title must be at least 2 characters").max(150).optional(),
      description: z
        .string()
        .min(2, "Description must be at least 2 characters")
        .optional(),
      priority: ticketPrioritySchema.optional(),
      dueDate: z.coerce
        .date({ errorMap: () => ({ message: "Due date must be a valid ISO date" }) })
        .optional(),
      assetId: z
        .string()
        .uuid("Invalid asset ID format: must be a valid UUID")
        .optional(),
      assigneeId: z
        .string()
        .uuid("Invalid assignee ID format: must be a valid UUID")
        .nullable()
        .optional(),
      status: ticketStatusSchema.optional(),
    })
    .strict()
    .refine(
      (data) => Object.keys(data).length > 0,
      "At least one field must be provided for update",
    ),
});

export const updateTicketStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid ticket ID format: must be a valid UUID"),
  }),
  body: z
    .object({
      status: ticketStatusSchema,
    })
    .strict(),
});

export const ticketIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid ticket ID format: must be a valid UUID"),
  }),
});
