const io = require("socket.io-client");

const NUM_CLIENTS = 100;
const SERVER_URL = "https://silar.cloud"; 
const clients = [];

for (let i = 0; i < NUM_CLIENTS; i++) {
  const socket = io(SERVER_URL, {
    transports: ["polling"], 
    reconnection: false
  });

  socket.on("connect", () => {
    console.log(`✅ Klient ${i} připojen`);
    socket.emit("userSettings", {
      name: `Test${i}`,
      notificationsEnabled: true
    });
    setInterval(() => {
      const lat = 50 + Math.random() * 0.01;
      const lng = 14.4 + Math.random() * 0.01;
      socket.emit("sendLocation", { lat, lng });
      console.log(`Klient ${i} → ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }, 3000);
  });

  socket.on("connect_error", (err) => {
    console.error(`❌ Klient ${i} – chyba připojení:`, err.message);
  });

  socket.on("disconnect", () => {
    console.log(`⚠️ Klient ${i} odpojen`);
  });

  clients.push(socket);
}