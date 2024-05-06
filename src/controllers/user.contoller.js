import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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
      userName: userName.toLowerCase(),
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
    if (!email && !userName) {
      throw new ApiError(400, "User Name or Email is required");
    }

    const user = await User.findOne({ $or: [{ email }, { userName }] });
    if (!user) {
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
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id).select("-password");

    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is expired");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    const options = { httpsOnly: true, secure: true };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed "
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const userId = req.user._id;

    const user = await User.findById(userId);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
      throw new ApiError(500, "Invalid Password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(new ApiResponse(200, "Password Reset Successfully"));
  } catch (error) {}
});

const getCurrentuser = asyncHandler(async (req, res) => {
  try {
    return res.status(200).json(new ApiResponse(200, req.user, "Current User"));
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  try {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
      new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { fullName, email } },
      { new: true }
    ).select("-password");

    return res
      .status(200)
      .json(new ApiResponse(200, user, "Account Details Updated Successfully"));
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  try {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is missing");
    }

    const avatarCloudinaryUrl = await uploadOnCloudinary(avatarLocalPath);

    if (!avatarCloudinaryUrl.url) {
      throw new ApiError(400, "failed uploading avatar file");
    }

    const user1 = await User.findById(req.user._id);

    const deleteImgResponse = await deleteFromCloudinary(user1.avatar);
    console.log("deleteImgResponse", deleteImgResponse);

    if (!deleteImgResponse) {
      throw new ApiError(400, "failed deleting avatar file on cloudinary");
    }

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: { avatar: avatarCloudinaryUrl.url },
      },
      { new: true }
    ).select("-password");

    return res
      .status(200)
      .json(new ApiResponse(200, user, "User's avatar updated successfully"));
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const updateUserCoverImg = asyncHandler(async (req, res) => {
  try {
    const coverImgLocalPath = req.file.path;

    if (!coverImgLocalPath) {
      throw new ApiError(400, "cover img is missing");
    }

    const coverImgCloudinaryUrl = await uploadOnCloudinary(coverImgLocalPath);

    if (!coverImgCloudinaryUrl.url) {
      throw new ApiError(400, "failed uploading cover img file");
    }

    const user1 = await User.findById(req.user._id);

    const deleteImgResponse = await deleteFromCloudinary(user1.coverImg);
    console.log("deleteImgResponse", deleteImgResponse);

    if (!deleteImgResponse) {
      throw new ApiError(400, "failed deleting cover Image file on cloudinary");
    }

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: { coverImg: coverImgCloudinaryUrl.url },
      },
      { new: true }
    );

    return res
      .status(200)
      .json(
        new ApiResponse(200, user, "User's Cover Img updated successfully")
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const getUserChannleProfile = asyncHandler(async (req, res) => {
  try {
    const { userName } = req.params;
    if (!userName?.trim()) {
      throw new ApiError(400, "User Name is missing");
    }
    const channel = await User.aggregate([
      {
        $match: {
          userName: userName?.toLowerCase(),
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "channel",
          as: "subscribers",
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "subscriber",
          as: "subscribedTo",
        },
      },
      {
        $addFields: {
          subscriberCount: {
            // added "$" bcoz, it is a field
            $size: "$subscribers",
          },
          channelsSubscribedToCount: {
            $size: "$subscribedTo",
          },
          isSubscribed: {
            $cond: {
              // $in: inside present or not, used in array & obj
              if: { $in: [req.user?._id, "$subscribers.subscriber"] },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $project: {
          fullName: 1,
          userName: 1,
          subscriberCount: 1,
          channelsSubscribedToCount: 1,
          isSubscribed: 1,
          avatat: 1,
          coverImg: 1,
          email: 1,
        },
      },
    ]);

    console.log(channel);
    if (!channel?.length) {
      throw new ApiError(400, "Channel does not exist");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, channel[0], "User Channel fetched successfully")
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const getWatchHistory = asyncHandler(async (req, res) => {
  try {
    const user = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.body._id),
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "watchHistory",
          foreignField: "_id",
          as: "watchHistory",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                  {
                    $project: {
                      fullName: 1,
                      userName: 1,
                      avatar: 1,
                    },
                  },
                ],
              },
            },
            {
              $addFields: {
                owner: {
                  $first: "$owner",
                },
              },
            },
          ],
        },
      },
    ]);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          user[0].watchHistory,
          "Watch history fetch successfull"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentuser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImg,
  getUserChannleProfile,
  getWatchHistory,
};
