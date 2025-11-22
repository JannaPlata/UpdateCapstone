import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import axios from "axios";
import Swal from "sweetalert2"; 
import RoomFormModal from "./AddRoomForm";
import RoomTable from "./RoomTable";

const ITEMS_PER_PAGE = 7;
const API_BASE = import.meta.env.VITE_API_BASE_ROOMS || "http://localhost:3000/api/rooms";

export default function AddRoom() {
  const [roomTypesList, setRoomTypesList] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);

  // =================== FETCH ROOM TYPES ===================
  const fetchRoomTypes = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/getRoomTypes`);
      const data = res.data?.data ?? [];
      setRoomTypesList(data);
    } catch (e) {
      console.error("Failed to fetch room types:", e);
      setRoomTypesList([]);
    }
  }, []);

  useEffect(() => {
    fetchRoomTypes();
  }, [fetchRoomTypes]);

  // =================== FETCH ROOMS ===================
  const cancelTokenRef = useRef(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('New request');
    }
    cancelTokenRef.current = axios.CancelToken.source();
    
    try {
      const params = {};
      if (search && search.trim() !== "") params.search = search.trim();
      if (roomTypeFilter !== "all") params.room_type = roomTypeFilter;
      if (statusFilter !== "all") params.status = statusFilter;

      const res = await axios.get(`${API_BASE}/admin/getRooms`, { 
        params, 
        cancelToken: cancelTokenRef.current.token 
      });
      
      const data = res.data?.data ?? [];

      const mapped = data.map((r) => ({
        room_id: r.room_id,
        roomNumber: r.room_number,
        roomType: r.type_name,
        roomTypeId: r.room_type_id,
        pricePerNight: Number(r.price_per_night) || 0,
        capacityAdults: r.capacity_adults ?? 1,
        capacityChildren: r.capacity_children ?? 0,
        status: (r.status || "").toLowerCase(),
        raw: r,
      }));
      
      setRooms(mapped);
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.error("Failed to fetch rooms:", err);
        Swal.fire({
          icon: "error",
          title: "Failed to Load Rooms",
          text: err?.message || "Please check backend/CORS or API URL.",
          confirmButtonColor: "#2563eb",
        });
        setRooms([]);
      }
    } finally {
      setLoading(false);
    }
  }, [search, roomTypeFilter, statusFilter]);

  useEffect(() => {
    const debounceMs = 300;
    const timer = setTimeout(() => {
      fetchRooms();
      setCurrentPage(1);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('Effect cleanup');
      }
    };
  }, [fetchRooms]);

  // =================== PAGINATION ===================
  const filteredRoomsMemo = useMemo(() => rooms, [rooms]);
  const pageCount = Math.max(1, Math.ceil(filteredRoomsMemo.length / ITEMS_PER_PAGE));
  const paginatedRooms = filteredRoomsMemo.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    (currentPage - 1) * ITEMS_PER_PAGE + ITEMS_PER_PAGE
  );

  // =================== SELECTION HELPERS ===================
  const isAllSelected =
    filteredRoomsMemo.length > 0 && filteredRoomsMemo.every((r) => selectedIds.includes(r.room_id));

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(filteredRoomsMemo.map((r) => r.room_id));
  };

  const toggleSelectOne = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // =================== TOGGLE STATUS ===================
  const handleToggleAvailability = async (id, currentStatus) => {
    const next = currentStatus === "available" ? "booked" : "available";
    setRooms((prev) => prev.map((r) => (r.room_id === id ? { ...r, status: next } : r)));

    try {
      await axios.post(
        `${API_BASE}/admin/updateRoom`,
        { room_id: id, status: next },
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      console.error("Toggle availability failed:", e);
      Swal.fire({
        icon: "error",
        title: "Status Update Failed",
        text: e.message,
        confirmButtonColor: "#2563eb",
      });
      setRooms((prev) => prev.map((r) => (r.room_id === id ? { ...r, status: currentStatus } : r)));
    }
  };

  // =================== DELETE SINGLE ROOM ===================
  const handleDeleteRoom = async (id) => {
    if (!id) {
      return Swal.fire({
        icon: "error",
        title: "Invalid Room ID",
        text: "Please select a valid room to delete.",
        confirmButtonColor: "#2563eb",
      });
    }

    const confirmDelete = await Swal.fire({
      icon: "warning",
      title: "Delete Room?",
      text: "Are you sure you want to delete this room? This action cannot be undone.",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280", 
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!confirmDelete.isConfirmed) return;

    try {
      Swal.fire({
        title: "Deleting Room...",
        text: "Please wait a moment.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await axios.post(`${API_BASE}/admin/deleteRoom`, { room_id: id });

      if (res.data?.success) {
        Swal.fire({
          icon: "success",
          title: "Room Deleted",
          text: res.data.message || "The room was successfully removed.",
          confirmButtonColor: "#2563eb",
          timer: 1500,
          showConfirmButton: false,
        });
        await fetchRooms();
      } else {
        Swal.fire({
          icon: "error",
          title: "Delete Failed",
          text: res.data?.message || "Room deletion failed.",
          confirmButtonColor: "#2563eb",
        });
      }
    } catch (error) {
      console.error("Delete failed:", error);
      Swal.fire({
        icon: "error",
        title: "Error Deleting Room",
        text: error?.response?.data?.message || error?.message || "A server error occurred.",
        confirmButtonColor: "#2563eb",
      });
    }
  };

  // =================== BULK DELETE ===================
  const handleBulkDelete = async (ids) => {
    if (!ids || ids.length === 0) return;

    const confirmBulk = await Swal.fire({
      icon: "warning",
      title: `Delete ${ids.length} rooms?`,
      text: "This action cannot be undone.",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete all",
    });

    if (!confirmBulk.isConfirmed) return;

    const prev = rooms;
    setRooms((prevRooms) => prevRooms.filter((r) => !ids.includes(r.room_id)));

    try {
      const res = await axios.post(`${API_BASE}/admin/deleteRoom`, { room_ids: ids });

      if (!res.data?.success) throw new Error(res.data?.message || "Bulk delete failed");

      setSelectedIds([]);
      Swal.fire({
        icon: "success",
        title: "Rooms Deleted",
        text: res.data?.message || "All selected rooms were deleted.",
        confirmButtonColor: "#2563eb",
      });
      
      await fetchRooms();
    } catch (e) {
      console.error("Bulk delete failed:", e);
      setRooms(prev);
      Swal.fire({
        icon: "error",
        title: "Failed to Delete",
        text: e?.response?.data?.message || e?.message || "Server error occurred.",
        confirmButtonColor: "#2563eb",
      });
    }
  };

  // =================== ADD ROOM ===================
  const handleAddRoom = async (payload) => {
    try {
      const formatted = {
        room_number: payload.room_number || payload.roomNumber,
        room_type_id: payload.room_type_id ?? payload.roomTypeId ?? null,
        room_type: payload.room_type ?? payload.roomType ?? "Dormitory Room",
        price_per_night: payload.price_per_night ?? payload.pricePerNight ?? 0,
        capacity_adults: payload.capacity_adults ?? payload.capacityAdults ?? 0,
        capacity_children: payload.capacity_children ?? payload.capacityChildren ?? 0,
        status: payload.status ?? "Available",
      };

      const res = await axios.post(`${API_BASE}/admin/addRoom`, formatted, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.success) {
        Swal.fire({
          icon: "success",
          title: "Room Added",
          text: res.data.message,
          confirmButtonColor: "#2563eb",
        });

        // Refresh both rooms AND room types (in case new type was created)
        await Promise.all([fetchRooms(), fetchRoomTypes()]);
        return true;
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: res.data?.message || "Failed to add room.",
          confirmButtonColor: "#2563eb",
        });
        return false;
      }
    } catch (e) {
      console.error("Add room error:", e.response?.data || e.message);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e.response?.data?.message || e.message || "Connection error.",
        confirmButtonColor: "#2563eb",
      });
      return false;
    }
  };

  // =================== UPDATE ROOM ===================
  const handleUpdateRoom = async (id, payload) => {
    try {
      // Find room_type_id from roomTypesList if type name is provided
      const matchedType = roomTypesList.find(
        rt => rt.name === (payload.room_type || payload.roomType || payload.type_name)
      );

      const formatted = {
        room_id: id,
        room_number: payload.room_number || payload.roomNumber,
        room_type_id: payload.room_type_id || matchedType?.id || null,
        type_name: payload.room_type || payload.roomType || payload.type_name,
        price_per_night: payload.price_per_night ?? payload.pricePerNight,
        capacity_adults: payload.capacity_adults ?? payload.capacityAdults,
        capacity_children: payload.capacity_children ?? payload.capacityChildren,
        status: payload.status || "Available",
      };

      const res = await axios.post(`${API_BASE}/admin/updateRoom`, formatted, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.success) {
        // Refresh both rooms AND room types (in case type was updated/created)
        await Promise.all([fetchRooms(), fetchRoomTypes()]);
        Swal.fire({
          icon: "success",
          title: "Room Updated",
          text: res.data?.message || "Update successful.",
          confirmButtonColor: "#2563eb",
        });
        return true;
      } else {
        Swal.fire({
          icon: "error",
          title: "Update Failed",
          text: res.data?.message || "Room not updated.",
          confirmButtonColor: "#2563eb",
        });
        return false;
      }
    } catch (e) {
      console.error("Update room error:", e);
      Swal.fire({
        icon: "error",
        title: "Failed to Update",
        text: e.response?.data?.message || e.message,
        confirmButtonColor: "#2563eb",
      });
      return false;
    }
  };

  // =================== RENDER ===================
  return (
    <div className="w-full min-h-screen font-poppins bg-white">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Room Management</h1>
              <p className="text-gray-600 mt-1">Manage and track all room information</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setEditingRoom(null);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all"
              >
                + Add New Room
              </button>
              
              {selectedIds.length > 0 && (
                <button
                  onClick={() => handleBulkDelete(selectedIds)}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg shadow-lg hover:from-red-600 hover:to-red-700 transition-all"
                >
                  Delete Selected ({selectedIds.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search room number..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
              <select
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              >
                <option value="all">All Room Types</option>
                {roomTypesList.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="booked">Booked</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                Showing {rooms.length} room{rooms.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <RoomTable
          rooms={paginatedRooms}
          loading={loading}
          selectedIds={selectedIds}
          toggleSelectAll={toggleSelectAll}
          toggleSelectOne={toggleSelectOne}
          isAllSelected={isAllSelected}
          onToggleAvailability={handleToggleAvailability}
          onEdit={(r) => {
            setEditingRoom(r);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteRoom}
          currentPage={currentPage}
          pageCount={pageCount}
          onPageChange={setCurrentPage}
          totalCount={rooms.length}
          ITEMS_PER_PAGE={ITEMS_PER_PAGE} 
        />

        {/* Modal */}
        {isModalOpen && (
          <RoomFormModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingRoom(null);
            }}
            initialData={editingRoom}
            onAdd={handleAddRoom}
            onUpdate={handleUpdateRoom}
            roomTypesList={roomTypesList}
          />
        )}
      </div>
    </div>
  );
}