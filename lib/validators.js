import { body, param, validationResult } from "express-validator";

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const errorMessages = errors
    .array()
    .map((error) => error.msg)
    .join(", ");

  return res.status(400).json({ success: false, message: errorMessages });
};

const registerValidator = () => [
  body("name").notEmpty().withMessage("Please Enter Name"),
  body("username").notEmpty().withMessage("Please Enter Username"),
  body("bio").notEmpty().withMessage("Please Enter Bio"),
  body("password").notEmpty().withMessage("Please Enter Password"),
];

const validateLogin = () => [
  body("username").notEmpty().withMessage("Please Enter Username"),
  body("password").notEmpty().withMessage("Please Enter Password"),
];

const validateNewGroupChat = () => [
  body("name").notEmpty().withMessage("Please Enter Name"),
  body("members")
    .notEmpty()
    .withMessage("Please Enter Members")
    .isArray({ min: 2, max: 50 })
    .withMessage("Members should be between 2-50"),
];

const validateAddMember = () => [
  body("chatId").notEmpty().withMessage("Please Enter ChatId"),
  body("members")
    .notEmpty()
    .withMessage("Please Enter Members")
    .isArray({ min: 1, max: 47 })
    .withMessage("Members should be between 1-47"),
];

const ValidateRemoveMember = () => [
  // body("ChatId").notEmpty().withMessage("Please Enter ChatId"),
  // body("members")
  //   .notEmpty()
  //   .withMessage("Please Enter Members")
  //   .isArray({ min: 2, max: 47 })
  //   .withMessage("Members should be between 2-47"),
  body("chatId", "Please Enter Chat ID").notEmpty(),
  body("userId", "Please Enter User ID").notEmpty(),
];

const ValidateLeaveGroup = () => [
  param("id").notEmpty().withMessage("Please Enter ChatId"),
];

const ValidateSendAttachments = () => [
  body("chatId").notEmpty().withMessage("Please Enter ChatId"),
  
];
const ValidateGetMessages = () => [
  param("id").notEmpty().withMessage("Please Enter ChatId"),
];

const ValidateGetChatDetails = () => [
  param("id").notEmpty().withMessage("Please Enter ChatId"),
];
const ValidateRenameGroup = () => [
  param("id").notEmpty().withMessage("Please Enter ChatId"),
  body("name").notEmpty().withMessage("Please Enter New Name"),
];

const ValidateSendRequest = () => [
  body("userId").notEmpty().withMessage("Please Enter User ID"),
];

const ValidateAcceptRequest = () => [
  body("requestId").notEmpty().withMessage("Please Enter Request ID"),
  body("accept")
  .notEmpty()
  .withMessage("Please Add Accept")
  .isBoolean()
  .withMessage("Accept must be a boolean"),
];

const ValidateAdmin = ()=>[
  body("secretKey").notEmpty().withMessage("Please enter your secret key")
]
export {
  ValidateAcceptRequest,
  ValidateAdmin, ValidateGetChatDetails, ValidateGetMessages, ValidateLeaveGroup, ValidateRemoveMember, ValidateRenameGroup, ValidateSendAttachments, ValidateSendRequest, registerValidator,
  validate, validateAddMember, validateLogin,
  validateNewGroupChat
};

