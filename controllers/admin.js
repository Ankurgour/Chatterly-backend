import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
import jwt from 'jsonwebtoken'
import { cookieOptions } from "../utils/features.js";
const adminLogin = async (req, res, next) => {
  try {
    const { secretKey } = req.body;
    const ScretKey = process.env.ADMIN_KEY || "asdfghjghjnm";
    const isMatch = secretKey === ScretKey;

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid Admin Key" });
    }

    const token = jwt.sign({ key: secretKey }, process.env.JWT_SECRET);
    return res.status(200).cookie("Chatterly-admin-token", token, { ...cookieOptions, maxAge: 1000 * 60 * 15 }).json({ success: true, message: "Authenticated successfully, Welcome Boss!" });
  } catch (error) {
    console.error(error); 
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};
const adminLogout = async (req, res, next) => {
  try {
    return res.status(200).cookie("Chatterly-admin-token", "", { ...cookieOptions, maxAge: 0}).json({ success: true, message: "Logged Out Successfully" });
  } catch (error) {
    console.error(error); 
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

const getAdminData = async(req,res,next)=>{
try {
  return res.status(200).json({ admin:true});
} catch (error) {
  return res.status(500).json({ admin:false});
}
}

const allUsers = async (req, res, next) => {
  try {
    const users = await User.find({});
    const transformUsers = await Promise.all(
      users.map(async ({ name, username, avatar, _id }) => {
        const [groups, friends] = await Promise.all([
          Chat.countDocuments({ groupChat: true, members: _id }),
          Chat.countDocuments({ groupChat: false, members: _id }),
        ]);
        return {
          name,
          username,
          avatar: avatar.url,
          _id,
          groups,
          friends,
        };
      })
    );
    return res.status(200).json({
      status: "success",
      users: transformUsers,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const allChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({})
      .populate("members", "name avatar")
      .populate("creator", "name avatar");

    const transformedChats = await Promise.all(
      chats.map(async (chat) => {
        const { name, members, _id, groupChat, creator } = chat;
        //   console.log("chat:",chat);
        const totalMessages = await Message.countDocuments({ chat: _id });

        return {
          _id,
          groupChat,
          name,
          avatar: members.slice(0, 3).map((member) => member.avatar?.url || ""),
          members: members.map(({ _id, name, avatar }) => ({
            _id,
            name,
            avatar: avatar?.url || "",
          })),
          creator: {
            name: creator?.name || "None",
            avatar: creator?.avatar?.url || "",
          },
          totalMembers: members.length,
          totalMessages,
        };
      })
    );

    return res.status(200).json({
      status: "success",
      chats: transformedChats,
    });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error",
        errors: err.Message,
      });
  }
};

const allMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({})
      .populate("sender", "name avatar")
      .populate("chat", "groupChat");

    const transformedMessages = messages.map(
      ({ content, sender, attachments, _id, createdAt, chat }) => ({
        _id, attachments, content, createdAt,chat:chat._id,groupChat:chat.groupChat,sender:{
            _id:sender._id,
            name:sender.name,
            avatar:sender.avatar.url
        }
      })
    );
    return res.status(200).json({
      status: "success",
      messages:transformedMessages,
    });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error",
        errors: err.Message,
      });
  }
};

const MyDashboardStats = async (req, res, next) => {
    try {
      const [groupsCount,UsersCount,MessagesCount,TotalChatCount] = await Promise.all([
        Chat.countDocuments({groupChat:true}),
        User.countDocuments(),
        Message.countDocuments(),
        Chat.countDocuments(),
      ]);
      const today  = new Date();
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate()-7);
      const last7DaysMessages = await Message.find({
        createdAt:{
            $gte:last7Days,
            $lte:today,
        }
      }).select("createdAt");
      const messages = new Array(7).fill(0);
      last7DaysMessages.forEach(message=>{
        const index = Math.floor((today.getTime()-message.createdAt.getTime())/(1000*60*60*24));

        messages[6-index]++;
      })

      const stats = {
        groupsCount,
        UsersCount,
        MessagesCount,
        TotalChatCount,
        messagesChart:messages
      }



      return res.status(200).json({
        status: "success",
        stats,
      });
    } catch (err) {
      res
        .status(500)
        .json({
          success: false,
          message: "Internal server error",
          errors: err.Message,
        });
    }
  };

 
export { allUsers, allChats, allMessages,MyDashboardStats,adminLogin,adminLogout ,getAdminData};
