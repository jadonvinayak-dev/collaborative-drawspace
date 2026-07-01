const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const { updateSettings, deleteAccount } = require("../controllers/settingsController");

router.use(requireAuth);
router.patch("/", updateSettings);
router.delete("/account", deleteAccount);

module.exports = router;
