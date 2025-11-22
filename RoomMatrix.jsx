import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight, Download, Menu, CirclePlus } from "lucide-react";

const API_ROOT = "http://localhost:3000/api";

const DAY_WIDTH = 80;
const LEFT_COL_WIDTH = 200;
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 80;

function isoDateLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}


function generateDateRange(year, month) {
  const out = [];

  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);

  for (let d = first; d <= last; d = new Date(year, month - 1, d.getDate() + 1)) {
    out.push(isoDateLocal(d));
  }

  return out;
}


export default function RoomMatrix() {
  const [viewMode, setViewMode] = useState("matrix");
  const [grouped, setGrouped] = useState({});
  const [order, setOrder] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const [currentYear, setCurrentYear] = useState(2025);
  const [currentMonth, setCurrentMonth] = useState(11);
  const [dates, setDates] = useState(() => generateDateRange(2025, 11));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);
  const headerScrollRef = useRef(null);
  const leftInnerRef = useRef(null);

  useEffect(() => {
    setDates(generateDateRange(currentYear, currentMonth));
  }, [currentYear, currentMonth]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [groupRes, bookingRes] = await Promise.all([
          fetch(`${API_ROOT}/rooms/admin/grouped`).then(r => {
            if (!r.ok) throw new Error('Failed to fetch rooms');
            return r.json();
          }),
          fetch(`${API_ROOT}/bookings/admin/calendar`).then(r => {
            if (!r.ok) throw new Error('Failed to fetch bookings');
            return r.json();
          })
        ]);

        if (cancelled) return;

        const groupedData = groupRes.grouped || groupRes.data || groupRes;
        setGrouped(groupedData);

        const ordered = Object.keys(groupedData);
        setOrder(ordered);

        const initCollapsed = {};
        ordered.forEach((t) => (initCollapsed[t] = true));
        setCollapsed(initCollapsed);

        const bookingsArray = Array.isArray(bookingRes) ? bookingRes : (bookingRes.bookings || []);
        setBookings(bookingsArray);

        setLoading(false);
      } catch (err) {
        console.error("Failed to load calendar data:", err);
        setError(err.message);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const availabilityByType = useMemo(() => {
    const availability = {};

    order.forEach((type) => {
      availability[type] = {};
      const rooms = grouped[type] || [];

      dates.forEach((date) => {
        const totalRooms = rooms.length;
        const bookedRooms = new Set();

        bookings.forEach((booking) => {
          const checkIn = booking.checkIn || booking.check_in;
          const checkOut = booking.checkOut || booking.check_out;
          const roomNum = booking.room_number;

          if (rooms.includes(roomNum) &&
              checkIn && checkOut &&
              date >= checkIn &&
              date < checkOut) {
            bookedRooms.add(roomNum);
          }
        });

        availability[type][date] = totalRooms - bookedRooms.size;
      });
    });

    return availability;
  }, [order, grouped, bookings, dates]);

  const rows = useMemo(() => {
    const out = [];
    order.forEach((type) => {
      const rooms = grouped[type] || [];
      if (collapsed[type]) {
        out.push({ type, isSummary: true, roomsCount: rooms.length });
      } else {
        rooms.forEach((roomNumber) => {
          out.push({ type, roomNumber: String(roomNumber), isSummary: false });
        });
      }
    });
    return out;
  }, [order, grouped, collapsed]);

  const bookingsByRoom = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      const room = String(b.room_number);
      if (!map[room]) {
        map[room] = [];
      }

      const checkIn = b.checkIn || b.check_in;
      const checkOut = b.checkOut || b.check_out;
      const guest = b.guest_name || b.guest || b.notes || "Guest";
      const source = b.source || b.booking_source || "Direct";

      map[room].push({
        id: b.id || b.booking_id,
        room_number: b.room_number,
        checkIn: checkIn,
        checkOut: checkOut,
        guest: guest,
        source: source,
        status: b.status
      });
    });

    return map;
  }, [bookings]);

  function dateIndex(iso) {
    const idx = dates.indexOf(iso);
    return idx >= 0 ? idx : -1;
  }

  useEffect(() => {
    const mainScroller = scrollRef.current;
    const headerScroller = headerScrollRef.current;
    const leftInner = leftInnerRef.current;
    
    if (!mainScroller || !headerScroller || !leftInner) return;

    function onMainScroll() {
      const scrollLeft = mainScroller.scrollLeft;
      const scrollTop = mainScroller.scrollTop;
      headerScroller.scrollLeft = scrollLeft;
      leftInner.scrollTop = scrollTop;
    }

    mainScroller.addEventListener('scroll', onMainScroll, { passive: true });
    return () => mainScroller.removeEventListener('scroll', onMainScroll);
  }, [dates.length, rows.length]);

  function BookingBar({ booking }) {
    if (!booking.checkIn || !booking.checkOut) {
      return null;
    }

    const startIdx = dateIndex(booking.checkIn);
    const endIdx = dateIndex(booking.checkOut);

    if (startIdx === -1 && endIdx === -1) return null;

    const leftIdx = Math.max(0, startIdx === -1 ? 0 : startIdx);
    const rightIdx = Math.min(dates.length, endIdx === -1 ? dates.length : endIdx);

    if (rightIdx <= leftIdx) return null;

    const left = leftIdx * DAY_WIDTH;
    const width = Math.max(DAY_WIDTH * (rightIdx - leftIdx), DAY_WIDTH * 0.5);
    const top = 8;

    const isBlocked = (booking.guest || "").toUpperCase().includes("BLOCK");
    const source = (booking.source || "").toLowerCase();

    let bgColor = "bg-blue-500";
    let textColor = "text-white";

    if (isBlocked) {
      bgColor = "bg-gray-600";
    } else if (source.includes("sunrise")) {
      bgColor = "bg-orange-500";
    } else if (source.includes("makemytrip") || source.includes("mmt")) {
      bgColor = "bg-pink-500";
    }

    return (
      <div
        title={`${booking.guest} — ${booking.source} (${booking.checkIn} → ${booking.checkOut})`}
        className={`absolute rounded px-2 py-1 text-xs font-medium truncate ${bgColor} ${textColor} cursor-pointer hover:opacity-90 shadow-lg`}
        style={{
          left: `${left}px`,
          width: `${width}px`,
          top: `${top}px`,
          height: `${ROW_HEIGHT - 16}px`,
          zIndex: 30,
        }}
      >
        <div className="flex flex-col gap-0.5">
          <div className="font-semibold leading-tight truncate text-xs">{booking.guest}</div>
          <div className="text-[9px] opacity-90 truncate">{booking.source}</div>
        </div>
      </div>
    );
  }

  function toggleType(t) {
    setCollapsed(prev => ({ ...prev, [t]: !prev[t] }));
  }

  function switchToMatrix() {
    setViewMode("matrix");
    const newCollapsed = {};
    order.forEach(type => newCollapsed[type] = false);
    setCollapsed(newCollapsed);
  }

  function switchToSummary() {
    setViewMode("summary");
    const newCollapsed = {};
    order.forEach(type => newCollapsed[type] = true);
    setCollapsed(newCollapsed);
  }

  function getAvailabilityColor(available, total) {
    if (available === 0) return "bg-red-900 text-red-100";
    if (available <= Math.ceil(total * 0.3)) return "bg-orange-900 text-orange-100";
    return "bg-green-900 text-green-100";
  }

  function handlePrevMonth() {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  const monthName = new Date(currentYear, currentMonth - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 p-6 flex items-center justify-center">
        <div className="text-xl text-black">Loading calendar data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
        <div className="bg-red-900 border border-red-700 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Error loading data</h3>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-red-700 px-4 py-2 rounded hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white-950 text-gray-100 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900 p-6 mb-6 shadow-sm">
          <h2 className="text-2xl font-semibold mb-4 text-white-900">Room Matrix</h2>

          <div className="flex gap-3 flex-wrap">
            <button className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm">
              <CirclePlus className="w-4 h-4" />
              New Booking
            </button>
            <button className="flex items-center gap-2 bg-gray-700 text-gray-100 px-4 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Block/Unblock
            </button>
            <button 
              onClick={switchToMatrix}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                viewMode === "matrix" 
                  ? "bg-green-600 text-white" 
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Matrix
            </button>
            <button 
              onClick={switchToSummary}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                viewMode === "summary" 
                  ? "bg-green-600 text-white" 
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Summary
            </button>
          </div>
        </div>

        {/* Calendar Container */}
        <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900">
          {/* Month Navigation */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center gap-3">
              <button 
                onClick={handlePrevMonth}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-semibold min-w-[180px]">{monthName}</h3>
              <button 
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg transition-colors text-sm">
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>

          {/* Grid Container */}
          <div style={{ display: 'flex', width: '100%', position: 'relative' }}>
            {/* LEFT COLUMN (Fixed) */}
            <div
              style={{
                width: LEFT_COL_WIDTH,
                minWidth: LEFT_COL_WIDTH,
                borderRight: '1px solid rgba(55,65,81,1)',
                background: '#111827',
                position: 'sticky',
                left: 0,
                zIndex: 50,
                height: 'calc(100vh - 300px)',
                overflow: 'hidden'
              }}
            >
              <div style={{ height: HEADER_HEIGHT }} className="flex items-center px-3 border-b border-gray-800 bg-gray-900">
                <div className="font-medium text-xs text-gray-400">{viewMode === 'summary' ? 'Room Type' : 'Room Unit'}</div>
              </div>

              <div
                ref={leftInnerRef}
                style={{
                  height: `calc(100vh - ${300 + HEADER_HEIGHT}px)`,
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                {rows.map((row, i) => {
                  if (row.isSummary) {
                    return (
                      <div key={`left-${row.type}`} className="flex items-center px-3 border-t border-gray-800" style={{ height: ROW_HEIGHT }}>
                        <div className="flex items-center w-full gap-2">
                          {/* Only show toggle button in matrix view */}
                          {viewMode === 'matrix' && (
                            <button onClick={() => toggleType(row.type)} className="p-1 rounded hover:bg-green-600 hover:text-white transition-colors flex-shrink-0" title="Toggle detailed view">
                              <Menu className="w-3 h-3" />
                            </button>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-xs truncate">{row.type}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{row.roomsCount} rooms</div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const hasBookings = bookingsByRoom[row.roomNumber]?.length > 0;

                  return (
                    <div key={`left-${row.roomNumber}`} className="flex items-center px-3 border-t border-gray-800" style={{ height: ROW_HEIGHT }}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <button onClick={() => toggleType(row.type)} className="p-1 rounded hover:bg-green-600 hover:text-white transition-colors flex-shrink-0" title="Show summary view">
                          <Menu className="w-3 h-3" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">Room {row.roomNumber}</div>
                          <div className="text-xs text-gray-500 truncate">{row.type}</div>
                        </div>
                        {hasBookings && <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" title="Has bookings"></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Scrollable Grid */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
               {/* Date Header */}
              <div
                ref={headerScrollRef}
                className="bg-gray-900 border-b border-gray-800"
                style={{
                  height: HEADER_HEIGHT,
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${dates.length}, ${DAY_WIDTH}px)`, height: '100%' }}>
                  {dates.map((d) => {
                    const date = new Date(d);
                    return (
                      <div key={d} className="flex flex-col items-center justify-center border-l border-gray-800" style={{ minWidth: DAY_WIDTH, height: '100%', padding: '4px 2px' }}>
                        <div className="font-semibold text-sm">{date.getDate()}</div>
                        <div className="text-xs text-gray-500">{date.toLocaleString('en-US', { weekday: 'short' })}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scrollable Content Area */}
              <div
                ref={scrollRef}
                style={{
                  overflow: 'auto',
                  height: `calc(100vh - ${300 + HEADER_HEIGHT}px)`,
                  position: 'relative'
                }}
              >
                <div style={{ width: dates.length * DAY_WIDTH }}>
                  {/* Rows */}
                  {rows.map((row, rowIndex) => {
                    if (row.isSummary) {
                      const availability = availabilityByType[row.type] || {};
                      const totalRooms = row.roomsCount;

                      return (
                        <div key={`row-${row.type}`} className="relative border-t border-gray-800" style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${dates.length}, ${DAY_WIDTH}px)` }}>
                            {dates.map((d) => {
                              const available = availability[d] ?? totalRooms;
                              const colorClass = getAvailabilityColor(available, totalRooms);

                              return (
                                <div key={`${row.type}-${d}`} className="h-full border-l border-gray-800 flex items-center justify-center" style={{ minWidth: DAY_WIDTH }} title={`${available} of ${totalRooms} rooms available`}>
                                  <div className={`px-2 py-1 rounded text-xs font-semibold ${colorClass}`}>{available}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    const roomBookings = bookingsByRoom[row.roomNumber] || [];

                    return (
                      <div key={`row-${row.roomNumber}`} className="relative border-t border-gray-800" style={{ height: ROW_HEIGHT }}>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${dates.length}, ${DAY_WIDTH}px)` }}>
                          {dates.map((d) => (
                            <div key={`${row.roomNumber}-${d}`} className="h-full border-l border-gray-800 hover:bg-gray-800/30" style={{ minWidth: DAY_WIDTH }} />
                          ))}
                        </div>

                        {roomBookings.map((b, i) => (
                          <BookingBar key={b.id || `${row.roomNumber}-${i}`} booking={b} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        {viewMode === 'summary' && (
          <div className="mt-4 p-3 bg-gray-900 border border-gray-800 rounded-lg">
            <div className="font-semibold mb-2 text-sm">Legend:</div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 bg-green-900 rounded" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 bg-orange-900 rounded" />
                <span>Low Availability</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 bg-red-900 rounded" />
                <span>Unavailable</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}