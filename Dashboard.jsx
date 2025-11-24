import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  DoorOpen, 
  DoorClosed, 
  XCircle,
  TrendingUp,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import RevenueAnalytics from './RevenueAnalytics';

const Dashboard = () => {
  const [dateRange, setDateRange] = useState('all');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customRange, setCustomRange] = useState([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection'
    }
  ]);

  const [dashboardData, setDashboardData] = useState({ 
    stats: { 
      total_bookings: 0, 
      not_paid_bookings: 0,
      arrival_bookings: 0,
      checked_in: 0,
      checked_out: 0,
      cancelled: 0
    },
    recentBookings: [],
    monthlyBookings: { labels: [], counts: [] }
  });

  const getDateRange = (range) => {
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
      case 'all':
      default:
        return null;
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        let dateParams = null;
        
        if (dateRange === 'custom' && customRange[0]) {
          const start = customRange[0].startDate;
          const end = customRange[0].endDate;
          dateParams = {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
          };
        } else {
          dateParams = getDateRange(dateRange);
        }
        
        const queryString = dateParams 
          ? `?start=${dateParams.start}&end=${dateParams.end}`
          : '';

        const [statsRes, recentRes, monthlyRes] = await Promise.all([
          fetch(`http://localhost:3000/api/dashboard/stats${queryString}`),
          fetch(`http://localhost:3000/api/dashboard/recent-bookings?limit=5${dateParams ? `&start=${dateParams.start}&end=${dateParams.end}` : ''}`),
          fetch(`http://localhost:3000/api/dashboard/trends${queryString}`)
        ]);

        const [statsData, recentData, monthlyData] = await Promise.all([
          statsRes.json(),
          recentRes.json(),
          monthlyRes.json()
        ]);

        setDashboardData({ 
          stats: statsData.success ? statsData.data : { 
            total_bookings: 0, 
            not_paid_bookings: 0,
            arrival_bookings: 0,
            checked_in: 0, 
            checked_out: 0, 
            cancelled: 0 
          },
          recentBookings: recentData.success ? recentData.data : [],
          monthlyBookings: monthlyData.success ? monthlyData.data : { labels: [], counts: [] }
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      }
    };
    loadData();
  }, [dateRange, customRange]);

  const filterButtons = [
    { label: 'Last 7 Days', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'Last Month', value: 'last_month' },
    { label: 'This Year', value: 'year' },
    { label: 'All Time', value: 'all' }
  ];

  const statCards = [
    {
      title: 'Total Bookings',
      value: dashboardData.stats.total_bookings,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      iconBg: 'bg-blue-100'
    },
    {
      title: 'Not Paid',
      value: dashboardData.stats.not_paid_bookings,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      iconBg: 'bg-yellow-100'
    },
    {
      title: 'Arrival',
      value: dashboardData.stats.arrival_bookings,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      iconBg: 'bg-green-100'
    },
    {
      title: 'Checked-In',
      value: dashboardData.stats.checked_in,
      icon: DoorOpen,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      iconBg: 'bg-blue-100'
    },
    {
      title: 'Checked-Out',
      value: dashboardData.stats.checked_out,
      icon: DoorClosed,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      iconBg: 'bg-gray-100'
    },
    {
      title: 'Cancelled',
      value: dashboardData.stats.cancelled,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      iconBg: 'bg-red-100'
    }
  ];

  const getBadgeStyles = (variant) => {
    const variants = {
      success: 'bg-green-100 text-green-800 border-green-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      info: 'bg-blue-100 text-blue-800 border-blue-200',
      secondary: 'bg-gray-100 text-gray-800 border-gray-200',
      destructive: 'bg-red-100 text-red-800 border-red-200'
    };
    return variants[variant] || variants.secondary;
  };

  const getStatusBadgeVariant = (status) => {
    const normalizedStatus = (status || '').toLowerCase();

    switch (normalizedStatus) {
      case 'arrival':
        return 'success';
      case 'check-in':
      case 'checked-in':
        return 'info';
      case 'check-out':
      case 'checked-out':
      case 'checked out':
        return 'secondary';
      case 'cancel':
      case 'cancelled':
        return 'destructive';
      default:
        return 'warning';
    }
  };

  const getPaymentBadgeVariant = (payment) => {
    const normalizedPayment = (payment || '').toLowerCase();

    switch (normalizedPayment) {
      case 'paid':
        return 'success';
      case 'not paid':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const chartData = dashboardData.monthlyBookings.labels.map((label, index) => ({
    month: label,
    bookings: dashboardData.monthlyBookings.counts[index] || 0
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Date Range Filters */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Welcome back! Here's your hotel overview</p>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 rounded-lg border border-gray-200 relative">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Filter by:</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {filterButtons.map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => {
                    setDateRange(btn.value);
                    setShowCustomRange(false);
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    dateRange === btn.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}

              <button
                onClick={() => {
                  setDateRange('custom');
                  setShowCustomRange(!showCustomRange);
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  dateRange === 'custom'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Custom Range
              </button>
            </div>

            {showCustomRange && (
              <div className="absolute top-full left-0 mt-2 z-50 p-4 bg-white rounded-lg shadow-lg border border-gray-200">
                <DateRange
                  editableDateInputs={true}
                  onChange={(item) => setCustomRange([item.selection])}
                  moveRangeOnFirstSelection={false}
                  ranges={customRange}
                  maxDate={new Date()}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                    onClick={() => setShowCustomRange(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    onClick={() => {
                      setShowCustomRange(false);
                      setDateRange('custom');
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chart Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-900">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Bookings Overview
                </h2>
                <p className="text-sm text-gray-600">Track your booking trends over time</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bookings" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={{ fill: '#2563eb', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Revenue Analytics */}
        <RevenueAnalytics />

        {/* Recent Bookings */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-gray-900">Recent Bookings</h2>
                <p className="text-sm text-gray-600">Your latest booking activity</p>
              </div>
              <a 
                href="/owner/bookings"
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium w-fit"
              >
                View All Bookings
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Guest Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Room Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 hidden md:table-cell">Room No.</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 hidden lg:table-cell">Check-In</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 hidden lg:table-cell">Check-Out</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Payment</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.recentBookings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-600">
                        No recent bookings found
                      </td>
                    </tr>
                  ) : (
                    dashboardData.recentBookings.map((booking) => (
                      <tr key={booking.booking_id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4 text-sm font-medium text-gray-900">#{booking.booking_id}</td>
                        <td className="py-4 px-4 text-sm text-gray-900">{booking.guest_name || 'Guest'}</td>
                        <td className="py-4 px-4 text-sm text-gray-900">{booking.room_type || '—'}</td>
                        <td className="py-4 px-4 text-sm text-gray-900 hidden md:table-cell">{booking.room_number || '—'}</td>
                        <td className="py-4 px-4 text-sm text-gray-900 hidden lg:table-cell">{booking.check_in || '—'}</td>
                        <td className="py-4 px-4 text-sm text-gray-900 hidden lg:table-cell">{booking.check_out || '—'}</td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyles(getPaymentBadgeVariant(booking.payment_status))}`}>
                            {booking.payment_status || 'Not Paid'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyles(getStatusBadgeVariant(booking.status))}`}>
                            {booking.status || 'Arrival'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;