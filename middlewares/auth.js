import jwt from "jsonwebtoken";
import { User } from "../models/user.js";
import { ErrorHandler } from "../utils/utility.js";
const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies["chatterly-token"];
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "Please login to access this route" });
    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedData._id;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const isAdminAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies["Chatterly-admin-token"];
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "Only admin can access this route" });

    const secretKey = jwt.verify(token, process.env.JWT_SECRET);
    const ScretKey = process.env.ADMIN_KEY;
    const isMatch = secretKey.key === ScretKey;
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid Admin Key" });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const socketAuthenticator = async (err, socket, next) => {
  try {
    if (err) return next(err);

    const authToken = socket.request.cookies["chatterly-token"];

    if (!authToken)
      return next(new ErrorHandler("Please login to access this route", 401));

    const decodedData = jwt.verify(authToken, process.env.JWT_SECRET);
    const user = await User.findById(decodedData._id);
    if (!user)
      return next(new ErrorHandler("Please login to access this route", 401));

    socket.user = user;
    return next();

  } catch (error) {
    console.log(error);
    return next(new ErrorHandler("Please login to access this route", 401));
  }
};

export { isAuthenticated, isAdminAuthenticated,socketAuthenticator };
