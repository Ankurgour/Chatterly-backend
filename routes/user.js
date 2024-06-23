import express from 'express';
import { AcceptFriendRequest, GetMyFriends, getAllNotifications, getMyProfile, login, logout, newUser, searchUser, sendFriendRequest } from '../controllers/user.js';
import { multerUploads, singleAvatar } from '../middlewares/multer.js';
import { isAuthenticated } from '../middlewares/auth.js';
import { ValidateAcceptRequest, ValidateSendRequest, registerValidator, validate, validateLogin } from '../lib/validators.js';

const app= express.Router();
// https:localhost:3000/user/
app.post('/new',singleAvatar,registerValidator(),validate,newUser);
app.post('/login',validateLogin(),validate, login);


// now below routes will be accessed after the user logged in successfully
app.use(isAuthenticated);

app.get("/profile",isAuthenticated,getMyProfile);
app.get("/logout",logout);

app.get("/search",searchUser);
app.put("/sendRequest",ValidateSendRequest(),validate,sendFriendRequest);
app.put("/acceptRequest",ValidateAcceptRequest(),validate,AcceptFriendRequest);

app.get("/notification",getAllNotifications)
app.get("/friends",GetMyFriends);






export default app;