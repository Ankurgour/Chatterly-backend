import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import {
  addMembers,
  deleteChat,
  getChatDetails,
  getMessages,
  getMyChat,
  getMyGroups,
  leaveGroup,
  newGroupChat,
  removeMembers,
  renameGroup,
  sendAttachments,
} from "../controllers/chat.js";
import { attachmentsMulter } from "../middlewares/multer.js";
import {
  ValidateGetChatDetails,
  ValidateGetMessages,
  ValidateLeaveGroup,
  ValidateRemoveMember,
  ValidateRenameGroup,
  ValidateSendAttachments,
  validate,
  validateAddMember,
  validateNewGroupChat,
} from "../lib/validators.js";

const app = express.Router();

// now below routes will be accessed after the user logged in successfully
app.use(isAuthenticated);

app.post("/new", validateNewGroupChat(), validate, newGroupChat);
app.get("/my", getMyChat);
app.get("/my/groups", getMyGroups);
app.put("/addmembers", validateAddMember(), validate, addMembers);
app.put("/removemember", ValidateRemoveMember(), validate, removeMembers);
app.delete("/leave/:id", ValidateLeaveGroup(), validate, leaveGroup);

//Send attachments
app.post(
  "/message",
  attachmentsMulter,
  ValidateSendAttachments(),
  validate,
  sendAttachments
);

//Get Messages
app.get("/message/:id", ValidateGetMessages(), validate, getMessages);
//Get Chat details,rename,delete
app
  .route("/:id")
  .get(ValidateGetChatDetails(), validate, getChatDetails)
  .put(ValidateRenameGroup(),validate,renameGroup)
  .delete(ValidateGetChatDetails(), validate,deleteChat);

export default app;
