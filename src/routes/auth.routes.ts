import { Router } from "express";
import { register, login, getMe, logout } from "../controllers/auth.controller";
import { validate } from "../middleware/validate.middleware";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware";
import { registerSchema, loginSchema } from "../validators/auth.validator";

const router = Router();

router.post("/register", optionalAuth, validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.get("/me", requireAuth, getMe);
router.post("/logout", logout);

export default router;
