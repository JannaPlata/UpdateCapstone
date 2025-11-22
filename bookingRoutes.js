import express from "express";
import { 
  checkAvailabilityAPI, 
  createBooking, 
  getHotelBookings, 
  getUserBookings,
  getAllBookings,        
  updateBookingStatus,
  getBookingLogs,
  exportBookingLogs,
  adminGetCalendarBookings,
} from "../controllers/bookingController.js";
import { protect } from "../middleware/authMiddleware.js";

const bookingRouter = express.Router();

bookingRouter.post('/check-availability', checkAvailabilityAPI);
bookingRouter.post('/book', protect, createBooking);
bookingRouter.get('/user', protect, getUserBookings);
bookingRouter.get('/hotel', protect, getHotelBookings);

// Admin routes
bookingRouter.get('/admin/all', getAllBookings);
bookingRouter.post('/admin/update-status', updateBookingStatus);
bookingRouter.get('/admin/logs', getBookingLogs);
bookingRouter.get('/admin/logs/export', exportBookingLogs);
bookingRouter.get('/admin/calendar', adminGetCalendarBookings);



export default bookingRouter;