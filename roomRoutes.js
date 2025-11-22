import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import { 
  createRoom, 
  getOwnerRooms, 
  getRooms, 
  checkRoomAvailability,
  adminGetRooms,
  adminAddRoom,
  adminUpdateRoom,
  adminDeleteRoom,
  adminGetGroupedRooms,
  adminGetRoomTypes  // ADD THIS IMPORT
} from "../controllers/roomController.js";

const roomRouter = express.Router();

roomRouter.route("/")
  .post(protect, upload.array("images", 4), createRoom)
  .get(getRooms);

roomRouter.route("/owner").get(protect, getOwnerRooms);
roomRouter.get("/check/:room_number", checkRoomAvailability);

// =================== ADMIN ROUTES ===================
roomRouter.get("/admin/getRooms", adminGetRooms);
roomRouter.get("/admin/getRoomTypes", adminGetRoomTypes);  // ADD THIS ROUTE
roomRouter.post("/admin/addRoom", adminAddRoom);
roomRouter.post("/admin/updateRoom", adminUpdateRoom);
roomRouter.post("/admin/deleteRoom", adminDeleteRoom);
roomRouter.get("/admin/grouped", adminGetGroupedRooms);

export default roomRouter;