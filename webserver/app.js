const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let userData = []; // { id, lat, lng, name, notificationsEnabled }

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('Uživatel připojen:', socket.id);

  socket.on('userSettings', (data) => {
    const index = userData.findIndex(u => u.id === socket.id);
    if (index !== -1) {
      userData[index].name = data.name;
      userData[index].notificationsEnabled = data.notificationsEnabled;
    } else {
      userData.push({
        id: socket.id,
        lat: 0,
        lng: 0,
        name: data.name,
        notificationsEnabled: data.notificationsEnabled
      });
    }
    io.emit('updateLocations', userData);
  });

  socket.on('sendLocation', (data) => {
    const index = userData.findIndex(u => u.id === socket.id);
    if (index !== -1) {
      userData[index].lat = data.lat;
      userData[index].lng = data.lng;
    } else {
      userData.push({
        id: socket.id,
        lat: data.lat,
        lng: data.lng,
        name: 'Neznámý',
        notificationsEnabled: false
      });
    }
    io.emit('updateLocations', userData);
  });

  socket.on('disconnect', () => {
    console.log('Uživatel odpojen:', socket.id);
    userData = userData.filter(u => u.id !== socket.id);
    io.emit('updateLocations', userData);
  });
});

server.listen(3000, () => {
  console.log('Server běží na portu 3000');
});