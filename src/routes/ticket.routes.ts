import { Router } from "express";
import {
  listTickets,
  getTicketById,
  createTicket,
  updateTicket,
  updateTicketStatus,
} from "../controllers/ticket.controller";
import { listComments, createComment } from "../controllers/comment.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  listTicketsQuerySchema,
  createTicketSchema,
  updateTicketSchema,
  updateTicketStatusSchema,
  ticketIdParamSchema,
} from "../validators/ticket.validator";
import { createCommentSchema, listCommentsSchema } from "../validators/comment.validator";

const router = Router();

// Ticket routes
router.get("/", requireAuth, validate(listTicketsQuerySchema), listTickets);
router.post("/", requireAuth, validate(createTicketSchema), createTicket);
router.get("/:id", requireAuth, validate(ticketIdParamSchema), getTicketById);
router.put("/:id", requireAuth, validate(updateTicketSchema), updateTicket);
router.patch(
  "/:id/status",
  requireAuth,
  validate(updateTicketStatusSchema),
  updateTicketStatus,
);

// Comment sub-routes on ticket
router.get("/:id/comments", requireAuth, validate(listCommentsSchema), listComments);
router.post("/:id/comments", requireAuth, validate(createCommentSchema), createComment);

export default router;
