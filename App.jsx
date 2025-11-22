import React, { useEffect } from 'react'
import Navbar from './components/Navbar'
import { data, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Footer from './components/Footer'
import AllRooms from './pages/AllRooms'
import RoomDetails from './pages/RoomDetails'
import MyBookings from './pages/MyBookings'
import Layout from './pages/hotelOwner/Layout'
import Dashboard from './pages/hotelOwner/Dashboard'
import AddRoom from './pages/hotelOwner/AddRoom'
import Events from './pages/Events'
import Dining from './pages/Dining'
import AddEvent from './pages/hotelOwner/AddEvent'
import About from './pages/About'
import {Toaster} from 'react-hot-toast'
import HotelReg from './components/HotelReg'
import { useAppContext } from './context/AppContext'
import LoginForm from './pages/LoginForm'
import FaqButton from './components/FaqButton'
import Offers from './pages/Offers'
import Booking_logs from './pages/hotelOwner/Booking_logs'
import Bookings from './pages/hotelOwner/Bookings'
import EventReservations from './pages/hotelOwner/EventReservations'
import EventReservationsLogs from './pages/hotelOwner/EventReservationsLogs'
import ProtectedRoute from './components/ProtectedRoute'
import RoomMatrix from './pages/hotelOwner/RoomMatrix'


const App = () => {
  
  const isOwnerPath = useLocation().pathname.includes("owner");
  const {showHotelReg} = useAppContext();


  return (
    <div>
      <Toaster />
      {!isOwnerPath && <Navbar />}
      {showHotelReg && <HotelReg />} 
    <div className='min-h-[70vh]'>
      <Routes>
        <Route path='/' element={<Home/>} />
        <Route path='/accommodation' element={<AllRooms/>} />
        <Route path='/events' element={<Events />} />
        <Route path='/dining' element={<Dining/>}/>
        <Route path='/about' element={<About/>}/>
        <Route path='/offers' element={<Offers/>}/>
        
        <Route path='/login' element={<LoginForm />} />

        <Route path='/rooms/:id' element={<RoomDetails/>} />
        <Route path='/my-bookings' element={<MyBookings/>} />

        <Route path='/owner' element={<ProtectedRoute><Layout/></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="add-room" element={<AddRoom />} />
            <Route path="add-event" element={<AddEvent />} />
            <Route path="booking-logs" element={<Booking_logs />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path='event-reservations' element={<EventReservations />} />
            <Route path='event-reservations-logs' element={<EventReservationsLogs />} />
            <Route path='room-matrix' element={<RoomMatrix />} />
            

        </Route>
      </Routes>
    </div>
    <Footer />
    <FaqButton />
    </div>
  )
}

export default App