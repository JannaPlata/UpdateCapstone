import connectDB from "../configs/db.js";

export const getRecentBookings = async (req, res) => {
  try {
    const db = await connectDB();
    const { start, end, limit = 10 } = req.query;
    const dateFilter = start && end ? `WHERE DATE(b.created_at) BETWEEN '${start}' AND '${end}'` : '';

    const [rows] = await db.query(`
      SELECT 
        b.booking_id,
        COALESCE(u.full_name, 'Guest') AS guest_name,
        COALESCE(rt.type_name, '—') AS room_type,
        COALESCE(r.room_number, '—') AS room_number,
        DATE_FORMAT(b.check_in, '%Y-%m-%d') AS check_in,
        DATE_FORMAT(b.check_out, '%Y-%m-%d') AS check_out,
        b.payment_status,
        b.status
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN room_types rt ON b.room_type_id = rt.room_type_id
      LEFT JOIN rooms r ON r.room_type_id = rt.room_type_id
      ${dateFilter}
      ORDER BY b.created_at DESC
      LIMIT ${Number(limit)};
    `);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("Error in getRecentBookings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch recent bookings", error: error.message });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const db = await connectDB();
    const { start, end } = req.query;
    const dateFilter = start && end ? `WHERE DATE(created_at) BETWEEN '${start}' AND '${end}'` : '';

    const queries = [
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter}`),
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter ? dateFilter + " AND" : "WHERE"} payment_status = 'not paid'`),
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter ? dateFilter + " AND" : "WHERE"} status = 'arrival'`),
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter ? dateFilter + " AND" : "WHERE"} status = 'checked-in'`),
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter ? dateFilter + " AND" : "WHERE"} status = 'checked-out'`),
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter ? dateFilter + " AND" : "WHERE"} status = 'cancelled'`)
    ];

    const [
      [total],
      [notPaid],
      [arrival],
      [checkedIn],
      [checkedOut],
      [cancelled]
    ] = await Promise.all(queries);

    res.json({
      success: true,
      data: {
        total_bookings: total[0].count || 0,
        not_paid_bookings: notPaid[0].count || 0,
        arrival_bookings: arrival[0].count || 0,
        checked_in: checkedIn[0].count || 0,
        checked_out: checkedOut[0].count || 0,
        cancelled: cancelled[0].count || 0
      }
    });
  } catch (error) {
    console.error("Error in getDashboardStats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats", error: error.message });
  }
};

export const getBookingTrends = async (req, res) => {
  try {
    const db = await connectDB();
    const { start, end } = req.query;
    const dateFilter = start && end ? `WHERE DATE(created_at) BETWEEN '${start}' AND '${end}'` : '';
    
    const [trends] = await db.query(`
      SELECT DATE_FORMAT(created_at, '%b %Y') AS month, COUNT(*) AS count
      FROM bookings
      ${dateFilter}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY created_at DESC
      LIMIT 12
    `);
    
    res.json({ 
      success: true, 
      data: {
        labels: trends.map(t => t.month),
        counts: trends.map(t => t.count)
      }
    });
  } catch (error) {
    console.error("Error in getBookingTrends:", error);
    res.status(500).json({ success: false, message: "Failed to fetch booking trends", error: error.message });
  }
};

// Revenue Analytics Endpoints
export const getRevenueSummary = async (req, res) => {
  try {
    const db = await connectDB();
    const { range = 'month', roomType = 'all', status = 'all' } = req.query;

    let dateFilter = '';
    const now = new Date();
    let start, end;

    switch(range) {
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        end = now;
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      default:
        start = null;
        end = null;
    }

    if (start && end) {
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      dateFilter = `AND DATE(b.created_at) BETWEEN '${startStr}' AND '${endStr}'`;
    }

    const roomTypeFilter = roomType !== 'all' ? `AND b.room_type_id = ${Number(roomType)}` : '';
    const statusFilter = status !== 'all' ? `AND b.status = '${status}'` : '';

    const [summaryRows] = await db.query(`
      SELECT 
        COALESCE(SUM(b.total_price), 0) AS total_revenue,
        COUNT(b.booking_id) AS total_bookings,
        COALESCE(AVG(b.total_price), 0) AS avg_revenue_per_booking
      FROM bookings b
      WHERE b.payment_status = 'paid'
      ${dateFilter}
      ${roomTypeFilter}
      ${statusFilter}
    `);

    res.json({
      success: true,
      data: {
        total_revenue: summaryRows[0].total_revenue || 0,
        total_bookings: summaryRows[0].total_bookings || 0,
        avg_revenue_per_booking: summaryRows[0].avg_revenue_per_booking || 0
      }
    });
  } catch (error) {
    console.error("Error in getRevenueSummary:", error);
    res.status(500).json({ success: false, message: "Failed to fetch revenue summary", error: error.message });
  }
};

export const getRevenueTrends = async (req, res) => {
  try {
    const db = await connectDB();
    const { range = 'month', roomType = 'all', status = 'all' } = req.query;

    let dateFilter = '';
    const now = new Date();
    let start, end;

    switch(range) {
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        end = now;
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      default:
        start = null;
        end = null;
    }

    if (start && end) {
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      dateFilter = `AND DATE(b.created_at) BETWEEN '${startStr}' AND '${endStr}'`;
    }

    const roomTypeFilter = roomType !== 'all' ? `AND b.room_type_id = ${Number(roomType)}` : '';
    const statusFilter = status !== 'all' ? `AND b.status = '${status}'` : '';

    const [trends] = await db.query(`
      SELECT 
        DATE_FORMAT(b.created_at, '%b %Y') AS month,
        COALESCE(SUM(b.total_price), 0) AS revenue
      FROM bookings b
      WHERE b.payment_status = 'paid'
      ${dateFilter}
      ${roomTypeFilter}
      ${statusFilter}
      GROUP BY DATE_FORMAT(b.created_at, '%Y-%m')
      ORDER BY b.created_at ASC
    `);

    res.json({
      success: true,
      data: trends.map(t => ({
        month: t.month,
        revenue: t.revenue
      }))
    });
  } catch (error) {
    console.error("Error in getRevenueTrends:", error);
    res.status(500).json({ success: false, message: "Failed to fetch revenue trends", error: error.message });
  }
};

export const getRevenueDetails = async (req, res) => {
  try {
    const db = await connectDB();
    const { range = 'month', roomType = 'all', status = 'all' } = req.query;

    let dateFilter = '';
    const now = new Date();
    let start, end;

    switch(range) {
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        end = now;
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      default:
        start = null;
        end = null;
    }

    if (start && end) {
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      dateFilter = `AND DATE(b.created_at) BETWEEN '${startStr}' AND '${endStr}'`;
    }

    const roomTypeFilter = roomType !== 'all' ? `AND b.room_type_id = ${Number(roomType)}` : '';
    const statusFilter = status !== 'all' ? `AND b.status = '${status}'` : '';

    const [details] = await db.query(`
      SELECT 
        b.booking_id,
        rt.type_name AS room_type,
        DATE_FORMAT(b.check_in, '%Y-%m-%d') AS check_in,
        b.total_price AS amount_paid,
        b.status
      FROM bookings b
      LEFT JOIN room_types rt ON b.room_type_id = rt.room_type_id
      WHERE b.payment_status = 'paid'
      ${dateFilter}
      ${roomTypeFilter}
      ${statusFilter}
      ORDER BY b.created_at DESC
    `);

    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    console.error("Error in getRevenueDetails:", error);
    res.status(500).json({ success: false, message: "Failed to fetch revenue details", error: error.message });
  }
};

export const getRoomTypes = async (req, res) => {
  try {
    const db = await connectDB();
    
    const [roomTypes] = await db.query(`
      SELECT room_type_id, type_name
      FROM room_types
      ORDER BY type_name ASC
    `);

    res.json({
      success: true,
      data: roomTypes
    });
  } catch (error) {
    console.error("Error in getRoomTypes:", error);
    res.status(500).json({ success: false, message: "Failed to fetch room types", error: error.message });
  }
};