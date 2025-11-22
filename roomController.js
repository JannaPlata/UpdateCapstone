
import { v2 as cloudinary } from "cloudinary";
import connectDB from "../configs/db.js";

//Api to create new room for the hotel
export const createRoom = async (req, res) => {
    try {
        const {roomType, pricePerNight, amenities} = req.body;
        const hotel = await Hotel.findOne({owner: req.auth.userId})

        if (!hotel){
            return res.json({
                success: false,
                message: "Hotel not found"
            })
        }
        const uploadImages = req.files.map(async (file) => {
            const response = await cloudinary.uploader.upload(file.path);
            return response.secure_url;
        })

        const images = await Promise.all(uploadImages)

        await Room.create({
            hotel: hotel._id,
            roomType,
            pricePerNight: +pricePerNight,
            amenities: JSON.parse(amenities),
            images,
        })
        res.json({
            success:true,
            message:"Room created successfully"
        })
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        })
    }
}
//Api to get all rooms of the hotel
export const getRooms = async (req, res) => {
    try {
        const rooms = await Room.find({isAvailable: true}).populate({
            path: "hotel",
            populate: {
                path: "owner",
                select: 'image'
            }
        }).sort({createdAt: -1});
        res.json({
            success:true,
            rooms
        })      
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        })
    }
}
//API to get all rooms for a specific hotel
export const getOwnerRooms = async (req, res) => {
    try {
        const hotelData = await Hotel({owner: req.auth.userId})
        const rooms = await Room.find({hotel: hotelData._id.toString()}).populate("hotel");
        res.json ({
            success: true,
            rooms
        });
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        })
    }
}
//API to toggle availability of a room
export const checkRoomAvailability = async (req, res) => {
  try {
    const { room_number } = req.params;

    const db = await connectDB();

    const [results] = await db.query("SELECT * FROM rooms WHERE room_number = ?", [room_number]);

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    const room = results[0];
 
    if (room.status !== "available") {
      return res.json({
        success: false,
        message: "This room is not available for the following days.",
      });
    }

    return res.json({
      success: true,
      message: "Room is available",
      room,
    });
  } catch (error) {
    console.error("❌ Error checking room:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =================== ADMIN FUNCTIONS ===================

// Helper function to sanitize strings
const sanitizeString = (str) => {
  if (!str) return '';
  return String(str).trim();
};

// NEW: Get all room types for dropdown/filter
export const adminGetRoomTypes = async (req, res) => {
  try {
    const db = await connectDB();
    
    const [roomTypes] = await db.query(`
      SELECT 
        room_type_id as id,
        type_name as name,
        price_per_night,
        capacity_adults,
        capacity_children
      FROM room_types
      ORDER BY type_name
    `);
    
    res.json({
      success: true,
      data: roomTypes
    });
    
  } catch (error) {
    console.error('Failed to fetch room types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room types',
      error: error.message
    });
  }
};

// Admin: Get all rooms with filters
export const adminGetRooms = async (req, res) => {
  try {
    const db = await connectDB();
    
    const { search, room_type, status } = req.query;
    
    const whereConditions = [];
    const params = [];
    
    if (search && search.trim() !== '') {
      const searchTerm = `%${sanitizeString(search)}%`;
      whereConditions.push("(r.room_number LIKE ? OR rt.type_name LIKE ?)");
      params.push(searchTerm, searchTerm);
    }
    
    if (room_type && room_type !== 'all') {
      whereConditions.push("rt.type_name = ?");
      params.push(sanitizeString(room_type));
    }
    
    if (status && status !== 'all') {
      whereConditions.push("LOWER(r.status) = LOWER(?)");
      params.push(sanitizeString(status));
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';
    
    const sql = `
      SELECT 
        r.room_id,
        r.room_number,
        r.status,
        r.room_type_id,
        rt.type_name,
        rt.capacity_adults,
        rt.capacity_children,
        rt.price_per_night
      FROM rooms r
      JOIN room_types rt ON rt.room_type_id = r.room_type_id
      ${whereClause}
      ORDER BY r.room_number
    `;
    
    const [rooms] = await db.query(sql, params);
    
    res.json({
      success: true,
      count: rooms.length,
      data: rooms
    });
    
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rooms',
      error: error.message
    });
  }
};

// Admin: Add new room (creates new room_type if needed)
export const adminAddRoom = async (req, res) => {
  try {
    const db = await connectDB();
    
    const { 
      room_number, 
      room_type, 
      room_type_id, 
      price_per_night, 
      capacity_adults, 
      capacity_children, 
      status 
    } = req.body;

    if (!room_number || room_number.trim() === '') {
      return res.status(400).json({ success: false, message: 'Room number is required' });
    }

    if (!room_type && !room_type_id) {
      return res.status(400).json({ success: false, message: 'Room type is required' });
    }

    let finalRoomTypeId = room_type_id;
    const typeName = sanitizeString(room_type);

    // If no room_type_id provided OR we need to look up by name
    if (typeName) {
      const [existingType] = await db.query(
        "SELECT room_type_id FROM room_types WHERE type_name = ?",
        [typeName]
      );

      if (existingType.length > 0) {
        finalRoomTypeId = existingType[0].room_type_id;
        
        // Optionally update existing room type with new values
        const typeUpdates = [];
        const typeParams = [];
        
        if (price_per_night !== undefined) {
          typeUpdates.push("price_per_night = ?");
          typeParams.push(parseFloat(price_per_night) || 0);
        }
        if (capacity_adults !== undefined) {
          typeUpdates.push("capacity_adults = ?");
          typeParams.push(parseInt(capacity_adults) || 0);
        }
        if (capacity_children !== undefined) {
          typeUpdates.push("capacity_children = ?");
          typeParams.push(parseInt(capacity_children) || 0);
        }
        
        if (typeUpdates.length > 0) {
          typeParams.push(finalRoomTypeId);
          await db.query(
            `UPDATE room_types SET ${typeUpdates.join(", ")} WHERE room_type_id = ?`,
            typeParams
          );
        }
      } else {
        // Create new room type
        const [result] = await db.query(
          `INSERT INTO room_types (type_name, price_per_night, capacity_adults, capacity_children) 
           VALUES (?, ?, ?, ?)`,
          [
            typeName,
            parseFloat(price_per_night) || 0,
            parseInt(capacity_adults) || 0,
            parseInt(capacity_children) || 0
          ]
        );
        finalRoomTypeId = result.insertId;
      }
    }

    // Check for duplicate room number
    const [duplicate] = await db.query(
      "SELECT room_id FROM rooms WHERE room_number = ?",
      [room_number.trim()]
    );

    if (duplicate.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'Room number already exists.' 
      });
    }

    // Insert the room
    const roomStatus = status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : 'Available';

    await db.query(
      "INSERT INTO rooms (room_number, room_type_id, status) VALUES (?, ?, ?)",
      [room_number.trim(), finalRoomTypeId, roomStatus]
    );
    
    res.json({ 
      success: true, 
      message: 'Room added successfully',
      room_type_id: finalRoomTypeId
    });

  } catch (error) {
    console.error('Add room error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database error: ' + error.message 
    });
  }
};

// Admin: Update room (updates room_type if needed)
export const adminUpdateRoom = async (req, res) => {
  try {
    const db = await connectDB();

    const {
      room_id,
      room_number,
      room_type_id,
      type_name,
      status,
      capacity_adults,
      capacity_children,
      price_per_night
    } = req.body;

    if (!room_id) {
      return res.status(400).json({
        success: false,
        message: "Room ID is required"
      });
    }

    // Get current room data
    const [currentRoom] = await db.query(
      "SELECT room_type_id FROM rooms WHERE room_id = ?",
      [room_id]
    );
    
    if (currentRoom.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    let finalRoomTypeId = room_type_id || currentRoom[0].room_type_id;
    const typeName = sanitizeString(type_name);

    // Handle room type: look up existing or create new
    if (typeName) {
      const [existingType] = await db.query(
        "SELECT room_type_id FROM room_types WHERE type_name = ?",
        [typeName]
      );

      if (existingType.length > 0) {
        finalRoomTypeId = existingType[0].room_type_id;
      } else {
        // Create new room type
        const [result] = await db.query(
          `INSERT INTO room_types (type_name, price_per_night, capacity_adults, capacity_children) 
           VALUES (?, ?, ?, ?)`,
          [
            typeName,
            parseFloat(price_per_night) || 0,
            parseInt(capacity_adults) || 0,
            parseInt(capacity_children) || 0
          ]
        );
        finalRoomTypeId = result.insertId;
      }
    }

    // Update rooms table
    const roomUpdates = [];
    const roomParams = [];

    if (room_number !== undefined) {
      // Check for duplicate room number (excluding current room)
      const [duplicate] = await db.query(
        "SELECT room_id FROM rooms WHERE room_number = ? AND room_id != ?",
        [sanitizeString(room_number), room_id]
      );
      
      if (duplicate.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Room number already exists"
        });
      }
      
      roomUpdates.push("room_number = ?");
      roomParams.push(sanitizeString(room_number));
    }

    if (finalRoomTypeId) {
      roomUpdates.push("room_type_id = ?");
      roomParams.push(parseInt(finalRoomTypeId));
    }

    if (status !== undefined) {
      roomUpdates.push("status = ?");
      roomParams.push(status.charAt(0).toUpperCase() + status.slice(1).toLowerCase());
    }

    if (roomUpdates.length > 0) {
      roomParams.push(parseInt(room_id));
      await db.query(
        `UPDATE rooms SET ${roomUpdates.join(", ")} WHERE room_id = ?`,
        roomParams
      );
    }

    // Update room_types table with new values
    if (finalRoomTypeId) {
      const typeUpdates = [];
      const typeParams = [];

      if (typeName) {
        typeUpdates.push("type_name = ?");
        typeParams.push(typeName);
      }
      if (capacity_adults !== undefined) {
        typeUpdates.push("capacity_adults = ?");
        typeParams.push(parseInt(capacity_adults));
      }
      if (capacity_children !== undefined) {
        typeUpdates.push("capacity_children = ?");
        typeParams.push(parseInt(capacity_children));
      }
      if (price_per_night !== undefined) {
        typeUpdates.push("price_per_night = ?");
        typeParams.push(parseFloat(price_per_night));
      }

      if (typeUpdates.length > 0) {
        typeParams.push(parseInt(finalRoomTypeId));
        await db.query(
          `UPDATE room_types SET ${typeUpdates.join(", ")} WHERE room_type_id = ?`,
          typeParams
        );
      }
    }

    res.json({
      success: true,
      message: "Room updated successfully"
    });

  } catch (error) {
    console.error("Update room error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Delete room(s)
export const adminDeleteRoom = async (req, res) => {
  try {
    const db = await connectDB();
    
    const { room_id, room_ids, ids } = req.body;
    
    let roomIds = [];
    
    if (room_id) {
      roomIds.push(parseInt(room_id));
    } else if (room_ids && Array.isArray(room_ids)) {
      roomIds = room_ids.map(id => parseInt(id));
    } else if (ids && Array.isArray(ids)) {
      roomIds = ids.map(id => parseInt(id));
    }
    
    if (roomIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No room IDs provided' 
      });
    }
    
    let deletedCount = 0;
    const skippedActive = [];
    
    for (const roomId of roomIds) {
      const [roomRows] = await db.query(
        "SELECT room_number FROM rooms WHERE room_id = ?",
        [roomId]
      );
      
      if (roomRows.length === 0) continue;
      
      const room = roomRows[0];
      
      // Check for active bookings (optional - depends on your schema)
      try {
        const [activeBookings] = await db.query(
          `SELECT COUNT(*) as count FROM booking_rooms br
           JOIN bookings b ON b.booking_id = br.booking_id
           WHERE br.room_id = ? AND b.status IN ('Confirmed', 'Checked-in')`,
          [roomId]
        );
        
        if (activeBookings[0].count > 0) {
          skippedActive.push(room.room_number || roomId);
          continue;
        }
        
        // Delete associated booking_rooms entries
        await db.query("DELETE FROM booking_rooms WHERE room_id = ?", [roomId]);
      } catch (e) {
        // booking_rooms table might not exist, continue with deletion
        console.log("No booking_rooms table or error:", e.message);
      }
      
      // Delete room
      await db.query("DELETE FROM rooms WHERE room_id = ?", [roomId]);
      
      deletedCount++;
    }
    
    let message = `${deletedCount} room(s) deleted successfully.`;
    if (skippedActive.length > 0) {
      message += ` Skipped rooms with active bookings: ${skippedActive.join(', ')}`;
    }
    
    res.json({
      success: true,
      message,
      deleted: deletedCount,
      skipped: skippedActive
    });
    
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rooms',
      error: error.message
    });
  }
};

// Admin: Group rooms by room type
export const adminGetGroupedRooms = async (req, res) => {
  try {
    const db = await connectDB();

    const [rows] = await db.query(`
      SELECT rt.type_name, r.room_number
      FROM room_types rt
      LEFT JOIN rooms r ON r.room_type_id = rt.room_type_id
      ORDER BY rt.type_name, r.room_number
    `);

    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.type_name]) grouped[row.type_name] = [];
      if (row.room_number) grouped[row.type_name].push(row.room_number);
    });

    res.json(grouped);
  } catch (err) {
    console.error("Grouped rooms error:", err);
    res.status(500).json({ message: "Failed to fetch grouped rooms" });
  }
};