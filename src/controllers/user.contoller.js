import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  try {
    const { userName, email, fullName, password } = req.body;

    if (
      [fullName, email, userName, password].some(
        (field) => field?.trim() === ""
      )
    ) {
      throw new ApiError(400, "All Fields are required");
    }

    const existedUser = User.findOne({ $or: [{ email }, { userName }] });
    console.log("=>> existedUser", existedUser);
    if (!existedUser) {
      console.log("isnid");
      throw new ApiError(409, "User already exists");
    }

    const avatartFilePath = req.files?.avatar[0]?.path;
    const coverImgFilePath = req.files?.coverImg[0]?.path;
    console.log("=>> avatartFilePath", avatartFilePath);

    if (!avatartFilePath) {
      throw new ApiError(400, "Avatar file is required");
    }
    const avatarImgOnCloudinary = await uploadOnCloudinary(avatartFilePath);
    const coverImgOnCloudinary = await uploadOnCloudinary(coverImgFilePath);

    if (!avatarImgOnCloudinary) {
      throw new ApiError(400, "Avatar file is required");
    }

    const createdUser = await User.create({
      fullName,
      avatar: avatarImgOnCloudinary.url,
      coverImg: coverImgOnCloudinary?.url || "",
      password,
      email,
      userName: userName.toLowercase(),
    });
    console.log("createdUser", createdUser);

    const user = await User.findById(createdUser._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(
        500,
        "Something went wrong while registering the user"
      );
    }

    return res
      .status(201)
      .json(new ApiResponse(200, user, "User Registered successfully"));
  } catch (error) {
    res.status(400).json({ message: "Error !!" });
  }
});

export { registerUser };
