import { User } from "../models/user.js";
import { Chat } from "../models/chat.js";
import { Request } from "../models/request.js";

import bcrypt, { compare, hash } from "bcrypt";
import { cookieOptions, emitEvent, sendToken,uploadFileToCloudinary } from "../utils/features.js";
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
//creating a new user and saving it to the database and saving the cookie

const newUser = async (req, res) => {
  try {
    const { name, username, password, bio } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, message: "Please upload an avatar" });
    }

    if (!name || !username || !password || !bio) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const result = await uploadFileToCloudinary([file]);
    const avatar = {
      public_id: result[0].public_id,
      url: result[0].url,
    };
    const hashedPassword = await hash(password, 10);
    const user = await User.create({
      name,
      bio,
      username,
      password: hashedPassword,
      avatar
    });

    sendToken(res, user, 201, "User Created Successfully");

  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      const errField = Object.keys(error.keyPattern).join(",");
      const errMsg = `Duplicate field: ${errField}`;
      return res.status(400).json({ success: false, message: errMsg });
    }

    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// login of user
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).select("+password");

    if (!user)
      return res.status(404).json({ message: "Invalid username or password" });

    const isMatch = await compare(password, user.password);

    if (!isMatch)
      return res.status(400).json({ message: "Invalid Credentials" });
    const { _id, name, username: userUsername, bio, avatar, createdAt, updatedAt } = user;
    const sanitizedUser = { _id, name, username: userUsername, bio, avatar, createdAt, updatedAt };
    sendToken(res, sanitizedUser, 200, `Welcome ${user.name}`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
    // next(error);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user);
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

const logout = (req, res) => {
  try {
    res
      .status(200)
      .cookie("chatterly-token", "", { ...cookieOptions, maxAge: 0 })
      .json({
        success: true,
        message: "Logged out successfully",
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message,
    });
  }
};

const searchUser = async (req, res) => {
  try {
    const { name = "" } = req.query;
    //finding all my chats
    const myChats = await Chat.find({
      groupChat: false,
      members: req.user,
    });
    // All Users from my chats means friends or people I have chatted with
    const allUsersFromMyChats = myChats.map((chat) => chat.members).flat();
    // findinding all users excpet me and my friends
    const allUsersexceptMeandFriends = await User.find({
      _id: { $nin: allUsersFromMyChats },
      name: { $regex: name, $options: "i" },
    });
    const users = allUsersexceptMeandFriends.map(({ _id, name, avatar }) => ({
      _id,
      name,
      avatar: avatar.url,
    }));

    res.status(200).json({
      success: true,
      message: name,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "No such user",
      error: error.message,
    });
  }
};

const sendFriendRequest = async (req, res, next) => {
  try {
    const { userId } = req.body;
    console.log(userId);
    const request = await Request.findOne({
      $or: [
        { sender: req.user, receiver: userId },
        { sender: userId, receiver: req.user },
      ],
    });

    if (request) {
      return res.status(400).json({ success: false, message: "Request already sent" });
    }

    await Request.create({
      sender: req.user,
      receiver: userId,
    });
    emitEvent(req, NEW_REQUEST, [userId]);
    return res
      .status(200)
      // .cookie("chatterly-token", "", { ...cookieOptions, maxAge: 0 })
      .json({
        success: true,
        message: "Friend request sent",
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "access denied",
    });
  }
};

const AcceptFriendRequest = async (req, res, next) => {
  try {
    const { requestId, accept } = req.body;
    const request = await Request.findById(requestId)
      .populate("sender", "name")
      .populate("receiver", "name");

      // console.log(request);
    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    if (request.receiver._id.toString() !== req.user.toString())
      return res.status(401).json({
        success: false,
        message: "You are not authorized to accept this request",
      });

    if (!accept) {
      await request.deleteOne();
      return res.status(200).json({
        success: true,
        message: "Friend request rejected",
      });
    }

    const members = [request.sender._id, request.receiver._id];
    await Promise.all([
      Chat.create({
        members,
        name: `${request.sender.name}-${request.receiver.name}`,
      }),
      request.deleteOne(),
    ]);
    emitEvent(req, REFETCH_CHATS, members);
    res.status(200).json({
      success: true,
      message: "Friend request accepted",
      senderId: request.sender._id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getAllNotifications = async (req, res, next) => {
  try {
    const requests = await Request.find({ receiver: req.user }).populate(
      "sender",
      "name avatar"
    );

    const allRequests = requests.map(({ _id, sender }) => ({
      _id,
      sender: {
        _id: sender._id,
        name: sender.name,
        avatar: sender.avatar.url,
      },
    }));
    console.log(allRequests);
    return res.status(200).json({
      success: true,
      allRequests:allRequests,
    });
  } catch (error) {
    res.status(404).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const GetMyFriends = async (req, res, next) => {
  try {
    const chatId = req.query.chatId;
    // console.log(chatId); 
    const chats = await Chat.find({
      members: req.user,
      groupChat: false,
    }).populate("members", "name avatar");
   
    const friends = chats.map(({ members }) => {
      const otherUser = getOtherMember(members, req.user);
      
      if (!otherUser) {
        console.error("No other user found in members:", members);
        return null;
      }

      return {
        _id: otherUser._id,
        name: otherUser.name,
        avatar: otherUser.avatar.url,
      };
    }).filter(friend => friend !== null);
    // console.log(friends);
    if (chatId) {
      const chat = await Chat.findById(chatId);

      const availableFriends = friends.filter(
        (friend) => !chat.members.includes(friend._id)
      );
      return res.status(200).json({
        success: true,
        friends: availableFriends,
      });
    } else {
      return res.status(200).json({
        success: true,
        friends,
      });
    }
  } catch (error) {const friends = chats.map(({ members }) => {
      const otherUser = getOtherMember(members, req.user);
      
      if (!otherUser) {
        console.error("No other user found in members:", members);
        return null; // Skip this chat if no other user is found
      }

      return {
        _id: otherUser._id,
        name: otherUser.name,
        avatar: otherUser.avatar.url,
      };
    }).filter(friend => friend !== null);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};
export {
  login,
  newUser,
  getMyProfile,
  logout,
  searchUser,
  sendFriendRequest,
  AcceptFriendRequest,
  getAllNotifications,
  GetMyFriends,
};
