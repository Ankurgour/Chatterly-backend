import express from 'express';
import { MyDashboardStats, adminLogin, adminLogout, allChats, allMessages, allUsers, getAdminData } from '../controllers/admin.js';
import { ValidateAdmin, validate } from '../lib/validators.js';
import { isAdminAuthenticated } from '../middlewares/auth.js';
const app = express.Router();



app.post("/verify",ValidateAdmin(),validate,adminLogin);
app.get("/logout",adminLogout);

//now we will use middleware so that only Admin can access these routes
app.use(isAdminAuthenticated);
app.get("/",getAdminData);
app.get("/users",allUsers);
app.get("/chats",allChats);
app.get("/messages",allMessages);
app.get("/stats",MyDashboardStats);

export default app;