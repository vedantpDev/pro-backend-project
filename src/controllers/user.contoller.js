import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.refreshAccessToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating Access & Refresh Token"
    );
  }
};

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

const loginUser = asyncHandler(async (req, res) => {
  try {
    const { email, userName, password } = req.body;
    if (!email || !userName) {
      throw new ApiError(400, "User Name or Email is required");
    }

    const user = await User.findOne({ $or: [{ email }, { userName }] });
    if (!findUser) {
      throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) throw new ApiError(401, "Password Incorrect");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    const loggedInUser = await User.findById(user._id).select(
      "-paasword -refreshToken"
    );

    const options = { httpsOnly: true, secure: true };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { user: loggedInUser, accessToken, refreshToken },
          "User logged in successfully"
        )
      );
  } catch (error) {
    console.log(error);
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: { refreshToken: undefined },
      },
      { new: true }
    );

    const options = { httpsOnly: true, secure: true };

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User Logged Out successfully"));
  } catch (error) {
    throw new ApiError(500, error);
  }
});

export { registerUser, loginUser, logoutUser };
