import { Router } from "express";
import { register, login, getMe, logout, getTechnicians } from "../controllers/auth.controller";
import { validate } from "../middleware/validate.middleware";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware";
import { authLimiter } from "../middleware/rate-limit.middleware";
import { registerSchema, loginSchema } from "../validators/auth.validator";

const router = Router();

router.post("/register", authLimiter, optionalAuth, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.get("/me", requireAuth, getMe);
router.get("/technicians", requireAuth, getTechnicians);
router.post("/logout", requireAuth, logout);

export default router;
