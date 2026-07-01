const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const {
  searchUsers, sendRequest, acceptRequest, declineRequest,
  removeFriend, blockUser, unblockUser, getFriends, getMessages
} = require("../controllers/socialController");

router.use(requireAuth);

router.get("/search", searchUsers);
router.get("/friends", getFriends);
router.get("/messages/:id", getMessages);
router.post("/request/:id", sendRequest);
router.post("/accept/:id", acceptRequest);
router.post("/decline/:id", declineRequest);
router.post("/remove/:id", removeFriend);
router.post("/block/:id", blockUser);
router.post("/unblock/:id", unblockUser);

module.exports = router;
