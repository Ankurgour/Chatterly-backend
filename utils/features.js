import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
export const cookieOptions = {
  maxAge: 15 * 24 * 60 * 60 * 1000,
  sameSite: "none",
  httpOnly: true,
  secure: true,
};
import { v4 as uuid } from "uuid";
import { getBase64, getSockets } from "../lib/helper.js";
const connectDB = async (url) => {
  try {
    const data = await mongoose.connect(url, { dbName: "Chatterly" });
    // console.log(`Connected to DB: ${data.connection.host}`);
  } catch (err) {
    console.error(`Error connecting to DB: ${err.message}`);
    process.exit(1);
  }
};
const sendToken = (res, user, code, message) => {
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

  return res.status(code).cookie("chatterly-token", token, cookieOptions).json({
    success: true,
    message,
    user,
  });
};

const emitEvent = (req, event, users, data) => {
  const io = req.app.get("io");
  const userSockets = getSockets(users);
  io.to(userSockets).emit(event, data);
  // console.log(users);
};
const uploadFileToCloudinary = async (files = []) => {
  const uploadPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        getBase64(file),
        {
          resource_type: "auto",
          public_id: uuid(),
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
    });
  });

  try {
    const results = await Promise.all(uploadPromises);
    const formattedResult = results.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));
    return formattedResult;
  } catch (error) {
    throw new Error(`Error uploading files to cloudinary: ${error.message}`);
  }
};

const deleteFilesCloudinary = async (public_ids) => {};
export {
  connectDB,
  sendToken,
  emitEvent,
  deleteFilesCloudinary,
  uploadFileToCloudinary,
};
