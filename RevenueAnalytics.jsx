import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { DollarSign, FileText, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

const RevenueAnalytics = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [roomType, setRoomType] = useState('all');
  const [status, setStatus] = useState('checked-out');
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  const [analyticsData, setAnalyticsData] = useState({
    summary: {
      total_revenue: 0,
      total_bookings: 0,
      avg_revenue_per_booking: 0
    },
    monthlyData: [],
    bookingDetails: [],
    roomTypes: [],
    statuses: ['arrival', 'checked-in', 'checked-out', 'cancelled']
  });

  useEffect(() => {
    loadAnalyticsData();
  }, [currentMonth, roomType, status]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const queryParams = new URLSearchParams({
        start: startStr,
        end: endStr,
        roomType: roomType,
        status: status
      });

      const [summaryRes, monthlyRes, detailsRes, roomTypesRes] = await Promise.all([
        fetch(`http://localhost:3000/api/dashboard/revenue-summary?${queryParams}`),
        fetch(`http://localhost:3000/api/dashboard/revenue-trends?${queryParams}`),
        fetch(`http://localhost:3000/api/dashboard/revenue-details?${queryParams}`),
        fetch(`http://localhost:3000/api/dashboard/room-types`)
      ]);

      const [summaryData, monthlyData, detailsData, roomTypesData] = await Promise.all([
        summaryRes.json(),
        monthlyRes.json(),
        detailsRes.json(),
        roomTypesRes.json()
      ]);

      setAnalyticsData({
        summary: summaryData.success ? summaryData.data : {
          total_revenue: 0,
          total_bookings: 0,
          avg_revenue_per_booking: 0
        },
        monthlyData: monthlyData.success ? monthlyData.data : [],
        bookingDetails: detailsData.success ? detailsData.data : [],
        roomTypes: roomTypesData.success ? roomTypesData.data : [],
        statuses: analyticsData.statuses
      });
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Booking ID', 'Room Type', 'Check-in', 'Amount Paid', 'Status'];
    const rows = analyticsData.bookingDetails.map(booking => [
      booking.booking_id,
      booking.room_type,
      booking.check_in,
      booking.amount_paid,
      booking.status
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const summaryCards = [
    {
      title: 'Total Revenue',
      value: analyticsData.summary.total_revenue,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      iconBg: 'bg-green-100',
      isCurrency: true
    },
    {
      title: 'Total Bookings',
      value: analyticsData.summary.total_bookings,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      iconBg: 'bg-blue-100',
      isCurrency: false
    },
    {
      title: 'Avg Revenue',
      value: analyticsData.summary.avg_revenue_per_booking,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      iconBg: 'bg-purple-100',
      isCurrency: true
    }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header with Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Revenue Analytics</h2>
          
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {/* Month Switcher */}
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-md border border-gray-200">
              <button
                onClick={handlePreviousMonth}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ←
              </button>
              <span className="text-sm font-medium text-gray-900 min-w-[150px] text-center">
                {formatMonthYear(currentMonth)}
              </span>
              <button
                onClick={handleNextMonth}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                →
              </button>
            </div>

            {/* Room Type */}
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Rooms</option>
              {analyticsData.roomTypes.map(room => (
                <option key={room.room_type_id} value={room.room_type_id}>
                  {room.type_name}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="checked-out">Checked-Out</option>
              <option value="checked-in">Checked-In</option>
            </select>


          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summaryCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div key={index} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">{card.title}</p>
                      <p className={`text-3xl font-bold ${card.color}`}>
                        {card.isCurrency ? formatCurrency(card.value) : card.value}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl ${card.iconBg}`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart Section */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue</h3>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Loading chart...
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Collapsible Details Table */}
      <div className="p-6">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
        >
          {showDetails ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
          Booking Breakdown
        </button>

        {showDetails && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Booking ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Room Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Check-in</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Amount Paid</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.bookingDetails.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-600">
                      No booking data found
                    </td>
                  </tr>
                ) : (
                  analyticsData.bookingDetails.map((booking) => (
                    <tr key={booking.booking_id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 text-sm font-medium text-gray-900">#{booking.booking_id}</td>
                      <td className="py-4 px-4 text-sm text-gray-900">{booking.room_type || '—'}</td>
                      <td className="py-4 px-4 text-sm text-gray-900">{booking.check_in || '—'}</td>
                      <td className="py-4 px-4 text-sm font-semibold text-green-600">
                        {formatCurrency(booking.amount_paid)}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-900">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevenueAnalytics;