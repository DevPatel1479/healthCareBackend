// import app from './app.js'
// import dotenv from 'dotenv'

// dotenv.config()

// const PORT = process.env.PORT || 3000

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`)
// })



import app from './app.js';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// 🔥 Socket.IO setup
export const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// 🔥 Handle connections
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  
  // join caregiver-specific room
  socket.on("join_caregiver", (caregiverId) => {
    socket.join(`caregiver_${caregiverId}`);
  });
  socket.on("join_patient", (patientId) => {
    socket.join(`patient_${patientId}`);
  });
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log("Node time:", new Date());
  console.log(`Server running on port ${PORT}`);
});