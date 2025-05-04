/**
 * Moje Mapa – Node.js back‑end server  
 * • Serves static assets from /public  
 * • Relays live GPS positions via Socket.IO (in‑memory array `userData`)  
 * Author Martin Šilar · 2025
 */

/**
 * @typedef {Object} User
 * @property {string}  id                      Socket ID
 * @property {number}  lat                     Latitude (WGS‑84)
 * @property {number}  lng                     Longitude (WGS‑84)
 * @property {string}  name                    Display name
 * @property {boolean} notificationsEnabled    Proximity‑alert toggle
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

/** @type {User[]} Current users in memory */
let userData = []; // { id, lat, lng, name, notificationsEnabled }

app.use(express.static(path.join(__dirname, 'public')));

/**
 * Main WebSocket handler – registers per‑socket listeners and
 * broadcasts a fresh snapshot (`updateLocations`) on every change.
 */
io.on('connection', (socket) => {
  console.log('Uživatel připojen:', socket.id);

  /**
   * Store or update user preferences (name + alerts).
   * @event Socket#userSettings
   * @param {{name:string, notificationsEnabled:boolean}} data
   */
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

  /**
   * Receive live coordinates from browser (~1 packet / 5 s).
   * @event Socket#sendLocation
   * @param {{lat:number,lng:number}} data
   */
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

  /** Cleanup when socket disconnects. */
  socket.on('disconnect', () => {
    console.log('Uživatel odpojen:', socket.id);
    userData = userData.filter(u => u.id !== socket.id);
    io.emit('updateLocations', userData);
  });
});

server.listen(3000, () => {
  console.log('Server běží na portu 3000');
});