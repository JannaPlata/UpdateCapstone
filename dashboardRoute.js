import express from "express";
import {
  getDashboardStats,
  getRecentBookings,
  getBookingTrends,
  getRevenueSummary,
  getRevenueTrends,
  getRevenueDetails,
  getRoomTypes
} from "../controllers/dashboardController.js";

const router = express.Router();

// Original dashboard routes
router.get("/stats", getDashboardStats);
router.get("/recent-bookings", getRecentBookings);
router.get("/trends", getBookingTrends);

// New revenue analytics routes
router.get("/revenue-summary", getRevenueSummary);
router.get("/revenue-trends", getRevenueTrends);
router.get("/revenue-details", getRevenueDetails);
router.get("/room-types", getRoomTypes);

export default router;