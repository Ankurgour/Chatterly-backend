import express, { urlencoded } from "express";
import { connectDB } from "./utils/features.js";
import dotenv from "dotenv";
import errorMiddleware from "./middlewares/error.js";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import userRoutes from "../server/routes/user.js";
import chatRoutes from "../server/routes/chats.js";
import { createServer } from "http";
import { v4 as uuid } from "uuid";
import adminRoute from "../server/routes/admin.js";
import { CHAT_JOINED, CHAT_LEAVED, NEW_MESSAGE, NEW_MESSAGE_ALERT, ONLINE_USERS, START_TYPING, STOP_TYPING } from "./constants/events.js";
import { getSockets } from "./lib/helper.js";
import { Message } from "./models/message.js";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import { socketAuthenticator } from "./middlewares/auth.js";

dotenv.config({
  path: "./.env",
});
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});
app.set("io",io);


const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: true }));

connectDB(process.env.MONGO_URL);
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/admin", adminRoute);

app.get("/", (req, res) => {
  res.send("Hello World");
});

io.use((socket, next) => {
  cookieParser()(socket.request, socket.request.res, async (err) =>
    await socketAuthenticator(err,socket,next)
  );
});
const userSocketIDs = new Map();
const onlineUsers = new Set();
io.on("connection", (socket) => {
  const user = socket.user;
  userSocketIDs.set(user._id.toString(), socket.id);
  socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
    const messageForRealTime = {
      content: message,
      _id: uuid(),
      sender: {
        _id: user._id,
        name: user.name,
      },
      chat: chatId,
      createdAt: new Date().toISOString(),
    };
    const messageForDB = {
      content: message,
      sender: user._id,
      chat: chatId,
    };
    const usersSocket = getSockets(members);
    io.to(usersSocket).emit(NEW_MESSAGE, {
      chatId,
      message: messageForRealTime,
    });
    io.to(usersSocket).emit(NEW_MESSAGE_ALERT, { chatId });

    try {
      await Message.create(messageForDB);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on(START_TYPING,({members,chatId}) => {
    const userSockets = getSockets(members);
    socket.to(userSockets).emit(START_TYPING,{chatId});
  })
  socket.on(STOP_TYPING,({members,chatId}) => {
    const userSockets = getSockets(members);
    socket.to(userSockets).emit(STOP_TYPING,{chatId});
  })
  socket.on(CHAT_JOINED,({userId,members}) => {
    onlineUsers.add(userId?.toString());
    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(ONLINE_USERS,Array.from(onlineUsers));
  })
  socket.on(CHAT_LEAVED,({userId,members}) => {
    onlineUsers.delete(userId?.toString());
    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(ONLINE_USERS,Array.from(onlineUsers));

  })
  socket.on("disconnect", () => {
    userSocketIDs.delete(user._id.toString());
    onlineUsers.delete(user._id.toString());
    socket.broadcast.emit(ONLINE_USERS,Array.from(onlineUsers));

  });


});
app.use(errorMiddleware);
server.listen(port, () => {
  console.log(`server is running on ${port} in ${process.env.NODE_ENV}Mode`);
});

export { userSocketIDs };
