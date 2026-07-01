const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const { createRoom, getRoom, saveSnapshot } = require("../controllers/roomController");

router.use(requireAuth);
router.post("/create", createRoom);
router.get("/:roomId", getRoom);
router.post("/:roomId/snapshot", saveSnapshot);

module.exports = router;
