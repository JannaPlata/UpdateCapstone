// server/controllers/bookingController.js
import connectDB from "../configs/db.js";
import { sendReservationEmail } from "../utils/reservationEmail.js";

// ✅ Function to check room availability
const checkAvailability = async ({ checkInDate, checkOutDate, roomId }) => {
  try {
    const pool = await connectDB();

    const [bookings] = await pool.query(
      `SELECT * 
       FROM bookings 
       WHERE room_type_id = ?
       AND (
         (check_in <= ? AND check_out >= ?)
       )`,
      [roomId, checkOutDate, checkInDate]
    );

    // If there are no overlapping bookings, room is available
    return bookings.length === 0;
  } catch (error) {
    console.error("Error checking availability:", error);
    throw error;
  }
};

// ✅ API: Check availability of a room
export const checkAvailabilityAPI = async (req, res) => {
  try {
    const { roomId, checkInDate, checkOutDate } = req.body;
    const isAvailable = await checkAvailability({
      checkInDate,
      checkOutDate,
      roomId,
    });
    res.json({ success: true, isAvailable });
  } catch (error) {
    console.error("Error in checkAvailabilityAPI:", error);
    res.status(500).json({
      success: false,
      message: "Error checking room availability",
    });
  }
};

// API: Create a new booking
// POST /api/bookings/book
export const createBooking = async (req, res) => {
  try {
    const {
      email,
      roomId,
      roomNumber,
      checkInDate,
      checkOutDate,
      guests,
      totalPrice,
      isPaid,
    } = req.body;

    console.log("📥 Received booking data:", req.body);

    const db = await connectDB();

    //  Convert ISO date to MySQL DATE format (YYYY-MM-DD)
    const formatDate = (date) => new Date(date).toISOString().slice(0, 10);
    const formattedCheckIn = formatDate(checkInDate);
    const formattedCheckOut = formatDate(checkOutDate);

    //  Extract adults and children
    const adults = parseInt(guests.adults) || 0;
    const children = parseInt(guests.children) || 0;

    //  Check if the room is already booked within the selected range
    const [existingBookings] = await db.query(
      `SELECT * FROM bookings
       WHERE room_number = ?
       AND (
         (check_in <= ? AND check_out >= ?) OR
         (check_in <= ? AND check_out >= ?) OR
         (? <= check_in AND ? >= check_out)
       )`,
      [
        roomNumber,
        formattedCheckIn,
        formattedCheckIn,
        formattedCheckOut,
        formattedCheckOut,
        formattedCheckIn,
        formattedCheckOut,
      ]
    );

    if (existingBookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: "❌ This room is already booked for the selected dates.",
      });
    }

    //  Insert new booking record
    const [result] = await db.query(
      `INSERT INTO bookings 
        (user_id, room_type_id, room_number, check_in, check_out, adults, children, total_price, payment_status, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.user_id || null,
        roomId,
        roomNumber,
        formattedCheckIn,
        formattedCheckOut,
        adults,
        children,
        totalPrice,
        isPaid ? "paid" : "unpaid",
        "Confirmed",
      ]
    );

    //  Respond to frontend
    res.status(201).json({
      success: true,
      message: "✅ Booking created successfully!",
      booking: {
        booking_id: result.insertId,
        user_id: req.user.user_id || null,
        user_email: req.user.email,
        room_type_id: roomId,
        room_number: roomNumber,
        check_in: formattedCheckIn,
        check_out: formattedCheckOut,
        adults,
        children,
        total_price: totalPrice,
        payment_status: isPaid ? "paid" : "unpaid",
      },
    });

    // Send email to the user
    // const pool = await connectDB();
    const [roomRows] = await db.query(
      `SELECT rt.type_name AS roomName
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.room_type_id
      WHERE r.room_type_id = ?`,
      [roomId]
    );

    const roomName = roomRows[0]?.roomName || "Unknown Room";

    const reservationDetails = {
      bookingId: result.insertId,
      checkInDate: formattedCheckIn,
      checkOutDate: formattedCheckOut,
      roomId,
      roomName, 
      totalPrice,
      guests: {
        adults,
        children,
      },
    };

    await sendReservationEmail(email, reservationDetails);
  } catch (error) {
    console.error("❌ Error creating booking:", error);
    res.status(500).json({
      success: false,
      message: "Error creating booking",
      error: error.message,
    });
  }
};

// API: Get all bookings of a user
// GET /api/bookings/user
export const getUserBookings = async (req, res) => {
  try {
    const pool = await connectDB();
    const userId = req.user.id;

    const [bookings] = await pool.query(
      `SELECT 
          b.booking_id,
          b.check_in AS checkInDate,
          b.check_out AS checkOutDate,
          b.total_price AS totalPrice,
          b.payment_status AS isPaid,
          r.room_type_id,
          r.room_number,
          rt.room_type_id,
          rt.type_name AS roomType,
          rt.capacity_adults,
          rt.capacity_children,
          rt.price_per_night
        FROM bookings b
        JOIN rooms r ON b.room_type_id = r.room_type_id
        JOIN room_types rt ON r.room_type_id = rt.room_type_id
        WHERE b.user_id = ?
        ORDER BY b.booking_id DESC;`,
      [userId]
    );

    res.json({ success: true, bookings });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user bookings",
    });
  }
};

// API: Get dashboard data (for owner/admin)
// GET /api/bookings/hotel
export const getHotelBookings = async (req, res) => {
  try {
    const pool = await connectDB();

    // only admins/owners can view all bookings
    const [bookings] = await pool.query(`
      SELECT 
        b.booking_id,
        b.total_price,
        b.check_in,
        b.check_out,
        r.room_number,
        rt.type_name AS roomType
      FROM bookings b
      JOIN rooms r ON b.room_type_id = r.room_type_id
      JOIN room_types rt ON r.room_type_id = rt.room_type_id
      ORDER BY b.booking_id DESC;
    `);

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce(
      (sum, b) => sum + Number(b.total_price),
      0
    );

    res.json({
      success: true,
      dashboardData: {
        totalBookings,
        totalRevenue,
        bookings,
      },
    });
  } catch (error) {
    console.error("Error fetching hotel bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching hotel bookings",
    });
  }
};

// GET all bookings for ADMIN
export const getAllBookings = async (req, res) => {
  let connection;
  try {
    const pool = await connectDB(); // Get pool first
    connection = await pool.getConnection(); // Then get connection

    // Check if check_in_time and check_out_time columns exist
    let hasCheckInTime = false;
    let hasCheckOutTime = false;

    try {
      const [checkInCol] = await connection.query(
        "SHOW COLUMNS FROM bookings LIKE 'check_in_time'"
      );
      hasCheckInTime = checkInCol.length > 0;

      const [checkOutCol] = await connection.query(
        "SHOW COLUMNS FROM bookings LIKE 'check_out_time'"
      );
      hasCheckOutTime = checkOutCol.length > 0;
    } catch (error) {
      // Columns don't exist, continue without them
    }

    let timeColumns = "";
    if (hasCheckInTime) {
      timeColumns += ", b.check_in_time";
    }
    if (hasCheckOutTime) {
      timeColumns += ", b.check_out_time";
    }

    const sql = `
      SELECT 
        b.booking_id,
        u.full_name AS guest_name,
        u.email,
        rt.type_name AS room_type,
        b.room_number,
        b.check_in,
        b.check_out
        ${timeColumns},
        CONCAT('Adult ', b.adults, ' | Child ', b.children) AS guests,
        b.total_price,
        b.payment_status,
        b.status AS booking_status,
        b.created_at
      FROM bookings b
      JOIN users u ON b.user_id = u.user_id
      JOIN room_types rt ON b.room_type_id = rt.room_type_id
      ORDER BY b.created_at DESC
    `;

    const [bookings] = await connection.query(sql);

    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release(); // Release connection back to pool
    }
  }
};
// UPDATE booking status for admin 
export const updateBookingStatus = async (req, res) => {
  let connection;
  try {
    const { booking_id, action, datetime } = req.body;

    if (!booking_id || !action) {
      return res.status(400).json({
        success: false,
        message: "Missing booking_id or action",
      });
    }

    const actionLower = action.toLowerCase().trim();

    // Get pool first, then connection
    const pool = await connectDB();
    connection = await pool.getConnection();

    // Verify connection is established
    if (!connection) {
      throw new Error("Failed to establish database connection");
    }

    // Check and update payment_status enum if needed
    let allowedPaymentStatuses = [];
    try {
      const [columnInfo] = await connection.query(
        "SHOW COLUMNS FROM bookings WHERE Field = 'payment_status'"
      );

      if (columnInfo.length > 0 && columnInfo[0].Type) {
        const matches = columnInfo[0].Type.match(/'([^']+)'/g);
        if (matches) {
          allowedPaymentStatuses = matches.map((m) => m.replace(/'/g, ""));
        }

        if (
          !allowedPaymentStatuses.includes("Partial Payment") ||
          !allowedPaymentStatuses.includes("Payment Complete")
        ) {
          try {
            await connection.query(
              "ALTER TABLE bookings MODIFY COLUMN payment_status ENUM('Pending', 'Partial Payment', 'Payment Complete') DEFAULT 'Pending'"
            );
            allowedPaymentStatuses = [
              "Pending",
              "Partial Payment",
              "Payment Complete",
            ];
          } catch (error) {
            console.error("Failed to update payment_status enum:", error.message);
          }
        }
      }
    } catch (error) {
      console.error("Failed to check payment_status enum:", error.message);
    }

    if (allowedPaymentStatuses.length === 0) {
      allowedPaymentStatuses = [
        "Pending",
        "Partial Payment",
        "Payment Complete",
      ];
    }

    await connection.beginTransaction();

    // Get current booking details
    const [current] = await connection.query(
      `
      SELECT 
        b.status, 
        b.payment_status,
        b.check_in,
        b.check_out,
        u.full_name AS guest_name,
        u.email,
        b.room_number,
        rt.type_name AS room_type
      FROM bookings b
      JOIN users u ON b.user_id = u.user_id
      LEFT JOIN room_types rt ON rt.room_type_id = b.room_type_id
      WHERE b.booking_id = ?
      LIMIT 1
    `,
      [booking_id]
    );

    if (current.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const currentBooking = current[0];
    const currentStatus = currentBooking.status;
    const currentPaymentStatus = currentBooking.payment_status;
    let guestName = currentBooking.guest_name || "Guest";
    guestName = guestName.replace(/\s+/g, " ").trim();
    const email = currentBooking.email || "";
    const roomNumber = currentBooking.room_number || "";
    const roomType = currentBooking.room_type || "";
    const room = roomNumber
      ? `Room ${roomNumber}`
      : roomType
      ? roomType
      : "—";
    let checkOutDate = null;

    if (actionLower === "checkout" && datetime) {
      checkOutDate = new Date(datetime).toISOString().split("T")[0];
    }

    // Define status and payment transitions
    let newStatus = currentStatus;
    let newPaymentStatus = currentPaymentStatus;

    if (actionLower === "paid") {
      newStatus = "Confirmed";
      newPaymentStatus = "Partial Payment";
    } else if (actionLower === "checkin") {
      newStatus = "Checked-in";
      newPaymentStatus = "Partial Payment";
    } else if (actionLower === "checkout") {
      newStatus = "Checked-out";
      newPaymentStatus = "Payment Complete";
    } else if (actionLower === "cancel") {
      newStatus = "Cancelled";
      newPaymentStatus = currentPaymentStatus;
    } else {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      });
    }

    // Map payment status to storage-safe value
    let storagePaymentStatus = newPaymentStatus;
    if (!allowedPaymentStatuses.includes(newPaymentStatus)) {
      if (
        newPaymentStatus === "Partial Payment" &&
        allowedPaymentStatuses.includes("Paid")
      ) {
        storagePaymentStatus = "Paid";
      } else if (
        newPaymentStatus === "Payment Complete" &&
        allowedPaymentStatuses.includes("Completed")
      ) {
        storagePaymentStatus = "Completed";
      } else if (allowedPaymentStatuses.includes("Pending")) {
        storagePaymentStatus = "Pending";
      } else {
        storagePaymentStatus = allowedPaymentStatuses[0];
      }
    }

    // Check if check_in_time and check_out_time columns exist
    let hasCheckInTime = false;
    let hasCheckOutTime = false;
    try {
      const [checkInCol] = await connection.query(
        "SHOW COLUMNS FROM bookings LIKE 'check_in_time'"
      );
      hasCheckInTime = checkInCol.length > 0;

      const [checkOutCol] = await connection.query(
        "SHOW COLUMNS FROM bookings LIKE 'check_out_time'"
      );
      hasCheckOutTime = checkOutCol.length > 0;
    } catch (error) {
      console.error("Error checking time columns:", error);
    }

    // Map action to last_action value
    const lastActionMap = {
      paid: "Paid",
      checkin: "Check-in",
      checkout: "Check-out",
      cancel: "Cancel",
    };
    const lastAction = lastActionMap[actionLower] || "Unknown";

    // Update booking based on action
    if (actionLower === "checkin" && datetime) {
      // datetime is already in Manila time from client, just store it directly
      if (hasCheckInTime) {
        await connection.query(
          "UPDATE bookings SET status = ?, payment_status = ?, check_in_time = ? WHERE booking_id = ?",
          [newStatus, storagePaymentStatus, datetime, booking_id]
        );
      } else {
        await connection.query(
          "UPDATE bookings SET status = ?, payment_status = ? WHERE booking_id = ?",
          [newStatus, storagePaymentStatus, booking_id]
        );
      }
    } else if (actionLower === "checkout" && datetime) {
      // datetime is already in Manila time from client, just store it directly
      if (hasCheckOutTime) {
        await connection.query(
          "UPDATE bookings SET status = ?, payment_status = ?, check_out_time = ?, check_out = ? WHERE booking_id = ?",
          [newStatus, storagePaymentStatus, datetime, checkOutDate, booking_id]
        );
      } else {
        await connection.query(
          "UPDATE bookings SET status = ?, payment_status = ?, check_out = ? WHERE booking_id = ?",
          [newStatus, storagePaymentStatus, checkOutDate, booking_id]
        );
      }
    } else {
      const [result] = await connection.query(
        "UPDATE bookings SET status = ?, payment_status = ? WHERE booking_id = ?",
        [newStatus, storagePaymentStatus, booking_id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(500).json({
          success: false,
          message: "Update failed",
          error: "No rows affected",
        });
      }
    }

    // Get actual check-in/check-out timestamps
    let logCheckIn = null;
    let logCheckOut = null;
    try {
      const [timeData] = await connection.query(
        "SELECT check_in_time, check_out_time FROM bookings WHERE booking_id = ?",
        [booking_id]
      );
      if (timeData.length > 0) {
        logCheckIn = timeData[0].check_in_time || null;
        logCheckOut = timeData[0].check_out_time || null;
      }
    } catch (error) {
      console.error("Error fetching time data:", error);
    }

    if (!logCheckIn) {
      logCheckIn =
        currentBooking.check_in || new Date().toISOString().split("T")[0];
    }
    if (!logCheckOut) {
      logCheckOut =
        currentBooking.check_out || new Date().toISOString().split("T")[0];
    }

    // Check if booking_logs has new schema
    let hasNewSchema = false;
    try {
      const [guestNameCol] = await connection.query(
        "SHOW COLUMNS FROM booking_logs LIKE 'guest_name'"
      );
      hasNewSchema = guestNameCol.length > 0;
    } catch (error) {
      console.error("Error checking booking_logs schema:", error);
    }

    // Generate Manila timezone timestamp for logging
    const getManilaTimestamp = () => {
      const manilaTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      return manilaTime.toISOString().slice(0, 19).replace('T', ' ');
    };

    // Use provided datetime for check-in/check-out actions, otherwise generate current Manila time
    const actionTimestamp = (actionLower === 'checkin' || actionLower === 'checkout') && datetime 
      ? datetime 
      : getManilaTimestamp();

    if (hasNewSchema) {
      // Check for email and room_number columns
      let hasEmail = false;
      let hasRoomNumber = false;
      try {
        const [emailCol] = await connection.query(
          "SHOW COLUMNS FROM booking_logs LIKE 'email'"
        );
        hasEmail = emailCol.length > 0;

        const [roomCol] = await connection.query(
          "SHOW COLUMNS FROM booking_logs LIKE 'room_number'"
        );
        hasRoomNumber = roomCol.length > 0;
      } catch (error) {
        console.error("Error checking log columns:", error);
      }

      // Build dynamic INSERT query
      const columns = ["booking_id", "guest_name"];
      const values = [booking_id, guestName];
      const placeholders = ["?", "?"];

      if (hasEmail) {
        columns.push("email");
        values.push(email);
        placeholders.push("?");
      }

      if (hasRoomNumber) {
        columns.push("room_number");
        values.push(roomNumber || "");
        placeholders.push("?");
      }

      columns.push(
        "payment_status",
        "status",
        "room",
        "check_in",
        "check_out",
        "last_action",
        "action_timestamp",
        "performed_by"
      );
      values.push(
        storagePaymentStatus,
        newStatus,
        room,
        logCheckIn,
        logCheckOut,
        lastAction,
        actionTimestamp, // Now uses Manila time consistently
        "Admin"
      );
      placeholders.push("?", "?", "?", "?", "?", "?", "?", "?");

      const sql = `INSERT INTO booking_logs (${columns.join(
        ", "
      )}) VALUES (${placeholders.join(", ")})`;
      await connection.query(sql, values);
    } else {
      // Use NOW() which will respect the timezone setting
      await connection.query(
        "INSERT INTO booking_logs (booking_id, action, timestamp) VALUES (?, ?, NOW())",
        [booking_id, lastAction]
      );
    }

    await connection.commit();

    res.status(200).json({
      success: true,
      message: "Booking status updated successfully.",
      status: newStatus,
      payment_status: newPaymentStatus,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }
    console.error("Error updating booking status:", error);
    res.status(500).json({
      success: false,
      message: "Update failed",
      error: error.message,
    });
  } finally {
    // Release connection back to pool
    if (connection) {
      try {
        connection.release();
        console.log("Connection released back to pool");
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
};

// GET booking logs with filters
export const getBookingLogs = async (req, res) => {
  let connection;
  try {
    const pool = await connectDB(); // Get pool first
    connection = await pool.getConnection(); // Then get connection

    // Build WHERE clause based on filters
    const where = [];
    const params = [];

    // Search filter
    if (req.query.search && req.query.search.trim() !== '') {
      const search = req.query.search.trim();
      where.push("(CAST(bl.log_id AS CHAR) LIKE ? OR bl.booking_id LIKE ? OR bl.guest_name LIKE ? OR bl.room LIKE ?)");
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    // Status filter
    if (req.query.status && req.query.status !== 'All') {
      where.push("bl.status = ?");
      params.push(req.query.status);
    }

    // Room type filter
    if (req.query.room_type && req.query.room_type !== 'All') {
      where.push("bl.room LIKE ?");
      params.push(`%${req.query.room_type}%`);
    }

    // Date from filter
    if (req.query.date_from && req.query.date_from.trim() !== '') {
      where.push("DATE(bl.check_in) >= ?");
      params.push(req.query.date_from);
    }

    // Date to filter
    if (req.query.date_to && req.query.date_to.trim() !== '') {
      where.push("DATE(bl.check_in) <= ?");
      params.push(req.query.date_to);
    }

    // Payment status filter
    if (req.query.payment_status && req.query.payment_status !== 'All') {
      where.push("bl.payment_status = ?");
      params.push(req.query.payment_status);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // Check if booking_logs has email column
    let hasEmail = false;
    try {
      const [emailCol] = await connection.query(
        "SHOW COLUMNS FROM booking_logs LIKE 'email'"
      );
      hasEmail = emailCol.length > 0;
    } catch (error) {
      // Column doesn't exist
    }

    // Check if booking_logs has room_number column
    let hasRoomNumber = false;
    try {
      const [roomCol] = await connection.query(
        "SHOW COLUMNS FROM booking_logs LIKE 'room_number'"
      );
      hasRoomNumber = roomCol.length > 0;
    } catch (error) {
      // Column doesn't exist
    }

    // Build SELECT columns dynamically
    let selectColumns = `
      bl.log_id,
      bl.booking_id,
      bl.guest_name,
      ${hasEmail ? 'bl.email' : "COALESCE(u.email, '') AS email"},
      bl.payment_status,
      bl.status,
      bl.room,
      ${hasRoomNumber ? 'bl.room_number,' : ''}
      b.room_type_id,
      rt.type_name AS room_type,
      bl.check_in,
      bl.check_out,
      bl.last_action,
      bl.action_timestamp,
      bl.performed_by
    `;

    const sql = `
      SELECT ${selectColumns}
      FROM booking_logs bl
      LEFT JOIN bookings b ON b.booking_id = bl.booking_id
      LEFT JOIN room_types rt ON rt.room_type_id = b.room_type_id
      ${hasEmail ? '' : 'LEFT JOIN users u ON u.user_id = b.user_id'}
      ${whereClause}
      ORDER BY bl.action_timestamp DESC
      LIMIT 500
    `;

    const [logs] = await connection.query(sql, params);

    res.status(200).json({
      success: true,
      data: logs
    });

  } catch (error) {
    console.error("Error fetching booking logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking logs",
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
      console.log("Connection released");
    }
  }
};

// Export booking logs as CSV (no auth required)
export const exportBookingLogs = async (req, res) => {
  let connection;
  try {
    const pool = await connectDB(); // Get pool first
    connection = await pool.getConnection(); // Then get connection

    // Build WHERE clause based on filters (same as getBookingLogs)
    const where = [];
    const params = [];

    if (req.query.search && req.query.search.trim() !== '') {
      const search = req.query.search.trim();
      where.push("(CAST(bl.log_id AS CHAR) LIKE ? OR bl.booking_id LIKE ? OR bl.guest_name LIKE ? OR bl.room LIKE ?)");
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (req.query.status && req.query.status !== 'All') {
      where.push("bl.status = ?");
      params.push(req.query.status);
    }

    if (req.query.room_type && req.query.room_type !== 'All') {
      where.push("bl.room LIKE ?");
      params.push(`%${req.query.room_type}%`);
    }

    if (req.query.date_from && req.query.date_from.trim() !== '') {
      where.push("DATE(bl.check_in) >= ?");
      params.push(req.query.date_from);
    }

    if (req.query.date_to && req.query.date_to.trim() !== '') {
      where.push("DATE(bl.check_in) <= ?");
      params.push(req.query.date_to);
    }

    if (req.query.payment_status && req.query.payment_status !== 'All') {
      where.push("bl.payment_status = ?");
      params.push(req.query.payment_status);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT 
        bl.log_id,
        bl.booking_id,
        bl.guest_name,
        bl.payment_status,
        bl.status,
        bl.room,
        bl.check_in,
        bl.check_out,
        bl.last_action,
        bl.action_timestamp,
        bl.performed_by
      FROM booking_logs bl
      ${whereClause}
      ORDER BY bl.action_timestamp DESC
    `;

    const [logs] = await connection.query(sql, params);

    // Generate CSV content
    const headers = [
      'Log ID',
      'Booking ID',
      'Guest Name',
      'Payment Status',
      'Status',
      'Room',
      'Check-In',
      'Check-Out',
      'Last Action',
      'Timestamp',
      'Performed By'
    ];

    // CSV helper function to escape fields
    const escapeCSV = (field) => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV content
    let csvContent = headers.join(',') + '\n';

    logs.forEach(log => {
      const row = [
        log.log_id,
        log.booking_id,
        log.guest_name,
        log.payment_status,
        log.status,
        log.room,
        log.check_in,
        log.check_out,
        log.last_action,
        log.action_timestamp,
        log.performed_by
      ].map(escapeCSV);

      csvContent += row.join(',') + '\n';
    });

    // Generate filename with current timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `booking_logs_${timestamp}.csv`;

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.status(200).send(csvContent);

  } catch (error) {
    console.error("Error exporting booking logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export booking logs",
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
      console.log("Connection released");
    }
  }
};
//Calendar Room matrix
// GET: Calendar bookings for admin
export const adminGetCalendarBookings = async (req, res) => {
  try {
    const db = await connectDB();
    
    const [bookings] = await db.query(`
      SELECT 
        b.booking_id as id,
        b.room_number,
        b.check_in,
        b.check_out,
        b.user_id,
        b.room_type_id,
        b.status,
        b.adults,
        b.children,
        b.notes,
        u.full_name as guest_name,
        'Direct' as booking_source
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE b.status IN ('confirmed', 'checked-in', 'pending')
      ORDER BY b.check_in
    `);

    // Transform the data to match what the frontend expects
    const transformedBookings = bookings.map(booking => ({
      id: booking.id,
      room_number: booking.room_number,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      guest: booking.guest_name || booking.notes || 'Guest',
      source: booking.booking_source || 'Direct',
      status: booking.status
    }));

    res.json(transformedBookings);
  } catch (err) {
    console.error("Error fetching calendar bookings:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};