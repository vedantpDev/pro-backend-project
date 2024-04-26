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

    const existedUser = await User.findOne({ $or: [{ email }, { userName }] });

    if (existedUser) {
      throw new ApiError(409, "User already exists");
    }

    const avatartFilePath =
      req.files && req.files?.avatar ? req.files?.avatar[0]?.path : "";
    const coverImgFilePath =
      req.files && req.files?.coverImg ? req.files?.coverImg[0]?.path : "";

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
    console.log(error);
    res.status(400).send(error);
  }
});

export { registerUser };
