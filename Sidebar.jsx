
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { assets } from "../../assets/assets";

const SideBar = ({ isCollapsed = true, onHoverChange }) => {
  const location = useLocation();

  const sidebarLinks = [
    { name: "Dashboard", path: "/owner", icon: assets.dashboardIcon },
    { name: "Bookings", path: "/owner/bookings", icon: assets.calenderIcon },
    { name: "Booking Logs", path: "/owner/booking-logs", icon: assets.bookinglogsIcon },
    { name: "Room Matrix", path: "/owner/room-matrix", icon: assets.roommatrixIcon },
    { name: "Rooms", path: "/owner/add-room", icon: assets.addroomsIcon },
    { name: "Event Reservations", path: "/owner/event-reservations", icon: assets.calenderIcon },
    { name: "Event Reservations Logs", path: "/owner/event-reservations-logs", icon: assets.bookinglogsIcon },
  ];

  return (
    <div
      className={`group relative min-h-screen bg-white border-r border-gray-200 shadow-sm transition-[width] duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      } hover:w-64`}
      onMouseEnter={() => onHoverChange && onHoverChange(true)}
      onMouseLeave={() => onHoverChange && onHoverChange(false)}
    >
      <div className="flex flex-col pt-4 min-h-screen">
        {/* Logo intentionally omitted; topbar logo is the single source */}
        <nav className="flex-1">
          
          {sidebarLinks.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                to={item.path}
                key={index}
                className={`flex items-center py-3 px-4 gap-3 transition-all duration-200 ${
                  isActive
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                }`}
                title={item.name}
              >
                <img src={item.icon} alt={item.name} className="w-6 h-6 object-contain" />
                <span className={`whitespace-nowrap overflow-hidden transition-opacity duration-200 ${isCollapsed ? "opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto" : "opacity-100"}`}>
                  {item.name}
                </span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default SideBar;

