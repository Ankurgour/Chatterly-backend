import multer from "multer";


const multerUploads = multer({limits:{
    fileSize:1024*1024*60,
    
}});
const singleAvatar = multerUploads.single("avatar");

const attachmentsMulter =multerUploads.array("files",5);

export {multerUploads,singleAvatar,attachmentsMulter}

