import { Router } from "express";
import {
  changeCurrentPassword,
  getCurrentuser,
  getUserChannleProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImg,
} from "../controllers/user.contoller.js";
import { upload } from "../middlerwares/multer.middleware.js";
import { verifyJWT } from "../middlerwares/auth.middlerware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    {
      name: "coverImg",
      maxCount: 1,
    },
  ]),
  registerUser
);
router.route("/login").post(loginUser);

// Secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentuser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);
router
  .route("/avatar")
  .patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
router
  .route("/cover-img")
  .patch(verifyJWT, upload.single("coverImg"), updateUserCoverImg);
router.route("/c/:userName").get(verifyJWT, getUserChannleProfile);
router.route("/history").get(verifyJWT, getWatchHistory);

export default router;
