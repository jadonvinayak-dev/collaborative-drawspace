const router = require("express").Router();
const { register, login, logout, me, getStats, getCaptcha } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

router.get("/stats", getStats);
router.get("/captcha", getCaptcha);
router.post("/register", register);
router.post("/login", login);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, me);

module.exports = router;
