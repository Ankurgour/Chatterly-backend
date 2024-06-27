import {
  ALERT,
  NEW_ATTACHMENT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  REFETCH_CHATS,
} from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
import { attachmentsMulter } from "../middlewares/multer.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";

import { User } from "../models/user.js";
import {
  deleteFilesCloudinary,
  emitEvent,
  uploadFileToCloudinary,
} from "../utils/features.js";
const newGroupChat = async (req, res, next) => {
  try {
    const { name, members } = req.body;
    // if (members.length < 2) {
    //   return res
    //     .status(400)
    //     .json({ message: "Group Chat must have at least 3 members" });
    // }

    const allMembers = [...members, req.user];

    await Chat.create({
      name,
      groupChat: true,
      creator: req.user,
      members: allMembers,
    });
    emitEvent(req, ALERT, allMembers, `Welcome to ${name} group`);
    emitEvent(req, REFETCH_CHATS, members);

    return res.status(201).json({
      success: true,
      message: "Group chat created successfully",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

const getMyChat = async (req, res, next) => {
  try {
    const chats = await Chat.find({ members: req.user }).populate(
      "members",
      "name avatar"
    );
    // console.log(chats); 
    const transformedChats = chats.map(({ _id, name, members, groupChat }) => {
      const otherMember = getOtherMember(members, req.user);
      // console.log("othermember",otherMember)
      return {
        _id,
        groupChat,
        avatar: groupChat
          ? members.slice(0, 3).map(({ avatar }) => avatar.url)
          : [otherMember.avatar.url],
        name: groupChat ? name : otherMember.name,
        members: members.reduce((prev, curr) => {
          if (curr._id.toString() !== req.user.toString()) {
            prev.push(curr._id);
          }
          return prev;
        }, []),
      };
    });
    // console.log(transformedChats);

    return res.status(200).json({
      success: true,
      chats: transformedChats,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

const getMyGroups = async (req, res, next) => {
  try {
    const chats = await Chat.find({
      members: req.user,
      groupChat: true,
      creator: req.user,
    }).populate("members", "name avatar");

    const groups = chats.map(({ members, _id, groupChat, name }) => ({
      _id,
      groupChat,
      name,
      avatar: members.slice(0, 3).map(({ avatar }) => avatar.url),
    }));

    return res.status(200).json({
      success: true,
      groups,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addMembers = async (req, res, next) => {
  try {
    const { chatId, members } = req.body;
    if (!members || members.length < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide members" });
    }
    const chat = await Chat.findById(chatId);
    if (!chat)
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });
    if (!chat.groupChat)
      return res
        .status(404)
        .json({ success: false, message: "Group Chat not found" });
    if (chat.creator.toString() !== req.user.toString())
      return res.status(403).json({
        success: false,
        message: "You are not allowed to add the member to this group",
      });

    const allNewMembersPromise = members.map((i) => User.findById(i, "name"));

    const allNewMembers = await Promise.all(allNewMembersPromise);
    const validMembers = allNewMembers
      .filter((i) => i && !chat.members.includes(i._id.toString()))
      .map((i) => i._id);

    if (validMembers.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid new members to add" });
    }

    chat.members.push(...validMembers);
    await chat.save();
    // const allUserName = allNewMembers.map(i=>i.name).join("");
    const allUserName = allNewMembers
      .filter((i) => validMembers.includes(i._id))
      .map((i) => i.name)
      .join(", ");

    emitEvent(
      req,
      ALERT,
      chat.members,
      `${allUserName} has been added to ${chat.name}`
    );

    emitEvent(req, REFETCH_CHATS, chat.members);
    return res.status(200).json({
      success: true,
      message: "Members added successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const removeMembers = async (req, res, next) => {
  try {
    const { userId, chatId } = req.body;
    const [chat, removeUser] = await Promise.all([
      Chat.findById(chatId),
      User.findById(userId, "name"),
    ]);
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    if (!chat.groupChat)
      return res
        .status(400)
        .json({ success: false, message: "This is not a group chat" });
    if (chat.creator.toString() !== req.user.toString())
      return res.status(403).json({
        success: false,
        message: "You are not allowed to add the member to this group",
      });

    if (chat.members.length <= 3)
      return res.status(400).json({
        success: false,
        message: "Group must have at least 3 members",
      });
const allChatMembers = chat.members.map((i)=>i.toString());
    chat.members = chat.members.filter(
      (member) => member.toString() !== userId.toString()
    );

    await chat.save();
    emitEvent(
      req,
      ALERT,
      chat.members,
     {message:`${removeUser.name} has been removed from the group`,chatId}
    );

    emitEvent(req, REFETCH_CHATS, allChatMembers);
    return res.status(200).json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const leaveGroup = async (req, res, next) => {
  try {
    const chatId = req.params.id;
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    if (!chat.groupChat)
      return res
        .status(400)
        .json({ success: false, message: "This is not a group chat" });

    const remainingMembers = chat.members.filter(
      (member) => member.toString() !== req.user.toString()
    );
    if (remainingMembers.length < 3)
      return res.status(400).json({ message: "Group must at least 3 members" });
    if (chat.creator.toString() === req.user.toString()) {
      const randomNumber = Math.floor(Math.random() * remainingMembers.length);
      const newCreator = remainingMembers[randomNumber];
      chat.creator = newCreator;
    }

    chat.members = remainingMembers;
    const [user] = await Promise.all([
      User.findById(req.user, "name"),
      chat.save(),
    ]);
    emitEvent(req, ALERT, chat.members, {chatId,message:`${user.name} has left the group`});

    emitEvent(req, REFETCH_CHATS, chat.members);
    return res.status(200).json({
      success: true,
      message: "left the group successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const sendAttachments = async (req, res, next) => {
  try {
    const { chatId } = req.body;
    const files = req.files || [];
    if (files.length < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide attachments" });
    }
    if (files.length > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Files can't be more than 5" });
    }
    const [chat, user] = await Promise.all([
      Chat.findById(chatId),
      User.findById(req.user, "name"),
    ]);
    // console.log(chat, user);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    const attachments = await uploadFileToCloudinary(files);

    const messageForDB = {
      content: "",
      attachments,
      sender: user._id,
      chat: chatId,
    };

    const messageForRealTime = {
      ...messageForDB,
      sender: { _id: user._id, name: user.name },
    };
    const message = await Message.create(messageForDB);
    emitEvent(req, NEW_MESSAGE, chat.members, {
      message: messageForRealTime,
      chatId,
    });

    emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });
    return res.status(200).json({ success: true, message });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getChatDetails = async (req, res) => {
  try {
    // const chatId = req.params.id;
    // console.log("hi1",chatId);
    if (req.query.populate === "true") {
      const chat = await Chat.findById(req.params.id)
        .populate("members", "name avatar")
        .lean();
      if (!chat) return res.status(404).json({ message: "Chat not found" });
      chat.members = chat.members.map(({ _id, name, avatar }) => ({
        _id,
        name,
        avatar: avatar.url,
      }));
      return res.status(200).json({ success: true, chat });
    } 
    
    else {
      // console.log(chatId);
      const chat = await Chat.findById(req.params.id);
      if (!chat) return res.status(404).json({ message: "Chat not found" });
      return res.status(200).json({ success: true, chat });
    }
  } catch (err) {
    if (err.name === "CastError") {
      const path = err.path;
      const message = `Invalid format of ${path}`;
      const status = 400;
      const mode = process.env.NODE_ENV.trim();
      return res
        .status(status)
        .json({
          success: false,
          message: mode === "DEVELOPMENT" ? err : message,
        });
    }
    res.status(500).json({ message: err.message });
  }
};

const renameGroup = async (req, res, next) => {
  try {
    const chatId = req.params.id;
    const { name } = req.body;
    // console.log(name);
    const chat = await Chat.findById(chatId);
    if (!chat)
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });
    if (!chat.groupChat)
      return res
        .status(404)
        .json({ success: false, message: "Group Chat not found" });

    if (chat.creator.toString() !== req.user.toString())
      return res.status(403).json({
        success: false,
        message: "You are not allowed to rename this group",
      });
    //   console.log(chat)
    chat.name = name;
    chat.save();
    emitEvent(req, REFETCH_CHATS, chat.members);
    return res
      .status(200)
      .json({ success: true, message: "Group renamed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteChat = async (req, res) => {
  try {
    const chatId = req.params.id;
    const chat = await Chat.findById(chatId);
    if (!chat)
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });

    const member = chat.members;

    if (chat.groupChat && chat.creator.toString() !== req.user.toString())
      return res.status(404).json({
        success: false,
        message: "You are not allowed to delete this group",
      });

    if (!chat.groupChat && !chat.members.includes(req.user.toString()))
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this group",
      });

    //we have to delete all messageg as well as attachments or files on cloudinary
    const meesagesWithAttachments = await Message.find({
      chat: chatId,
      attachments: { $exists: true, $ne: [] },
    });
    const public_ids = [];
    meesagesWithAttachments.forEach(({attachments}) => {
      attachments.forEach(({ public_id }) => {
        public_ids.push(public_id);
      });
    });
    await Promise.all([
      //delete files from cloudinary
      deleteFilesCloudinary(public_ids),
      chat.deleteOne(),
      Message.deleteMany({ chat: chatId }),
    ]);
    emitEvent(req, REFETCH_CHATS, member);
    //   await chat.deleteOne(chatId);

    return res
      .status(200)
      .json({ success: true, message: "Chat deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const chatId = req.params.id;
    const { page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;
    const chat = await Chat.findById(chatId);
    // console.log("ankur ki chat",chat);
    if(!chat)return res.status(404).json({success:false, message: 'Chat not found'});
    if (!chat.members.includes(req.user.toString()))return res.status(403).json({success:false, message: 'You are not allowed to access this chat'});
    // if(!chat.members.include(req.user.toString()))return res.status(403).json({success:false, message: 'You are not allowed to access this chat'});
    const [messages, messageCount] = await Promise.all([
      Message.find({ chat: chatId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender", "name")
        .lean(),
      Message.countDocuments({ chat: chatId }),
    ]);

    const totalPage = Math.ceil(messageCount / limit) || 0;

    return res.status(200).json({
      success: true,
      message: messages.reverse(),
      totalPage,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export {
  newGroupChat,
  getMyChat,
  getMyGroups,
  addMembers,
  removeMembers,
  leaveGroup,
  sendAttachments,
  getChatDetails,
  renameGroup,
  deleteChat,
  getMessages,
};
