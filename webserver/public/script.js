const socket = io();

let map;
let myMarker;
let myName = 'Neznámý';
let notificationsEnabled = false;
let notificationDistance = 50;
let otherMarkers = {};
let pendingUserArray = null;

const mapContainer = document.getElementById('mapContainer');
const locationOverlay = document.getElementById('locationOverlay');
const retryLocationBtn = document.getElementById('retryLocationBtn');

window.addEventListener('load', () => {
  console.log("Aplikace načtena.");

  const savedName = localStorage.getItem('myName');
  const savedNotifications = localStorage.getItem('notificationsEnabled');
  const savedDistance = localStorage.getItem('notificationDistance');

  if (savedName) myName = savedName;
  if (savedNotifications) notificationsEnabled = (savedNotifications === 'true');
  if (savedDistance) notificationDistance = parseInt(savedDistance, 10);

  document.getElementById('nameInput').value = myName;
  document.getElementById('notificationsSwitch').checked = notificationsEnabled;

  const distanceRange = document.getElementById('distanceRange');
  const distanceValue = document.getElementById('distanceValue');

  if (distanceRange && distanceValue) {
    distanceRange.value = notificationDistance;
    distanceValue.textContent = notificationDistance;

    distanceRange.addEventListener('input', () => {
      notificationDistance = parseInt(distanceRange.value, 10);
      distanceValue.textContent = notificationDistance;
    });
  }

  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    myName = document.getElementById('nameInput').value || 'Neznámý';
    if (myName.length > 20) {
      alert("Jméno nesmí mít více než 20 znaků.");
      return;
    }

    notificationsEnabled = document.getElementById('notificationsSwitch').checked;
    notificationDistance = parseInt(distanceRange.value, 10);

    localStorage.setItem('myName', myName);
    localStorage.setItem('notificationsEnabled', notificationsEnabled);
    localStorage.setItem('notificationDistance', notificationDistance);

    socket.emit('userSettings', {
      name: myName,
      notificationsEnabled: notificationsEnabled
    });

    console.log("Uloženo nastavení:", myName, notificationsEnabled, notificationDistance);
  });

  socket.emit('userSettings', {
    name: myName,
    notificationsEnabled: notificationsEnabled
  });

  retryLocationBtn.addEventListener('click', initGeolocation);

  initGeolocation();
});

function initGeolocation() {
  console.log("Spouštím získání polohy...");
  mapContainer.style.display = 'none';
  locationOverlay.style.display = 'flex';

  if (!('geolocation' in navigator)) {
    console.warn('Geolokace není podporována tímto prohlížečem.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      console.log("Získaná poloha:", pos.coords);
      
      locationOverlay.style.display = 'none';
      locationOverlay.classList.add('d-none');
      locationOverlay.style.visibility = 'hidden';
      locationOverlay.style.opacity = '0';

      mapContainer.style.display = 'block';
      mapContainer.classList.remove('d-none');
  
      setTimeout(() => {
        if (locationOverlay.style.display !== 'none') {
          console.warn("Overlay stále zobrazen – schovávám znovu jako pojistku.");
          locationOverlay.style.display = 'none';
          locationOverlay.style.visibility = 'hidden';
          locationOverlay.style.opacity = '0';
        }
      }, 1000);
  
      if (!map) {
        initMap(pos.coords.latitude, pos.coords.longitude);
      }
  
      updateLocation(pos);
  
      setInterval(() => {
        navigator.geolocation.getCurrentPosition(updateLocation, locationError);
      }, 5000);
    },
    locationError,
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function locationError(err) {
  console.warn('Chyba při získávání polohy:', err);
  mapContainer.style.display = 'none';
  locationOverlay.style.display = 'flex';

  const overlayDebug = document.getElementById('overlayDebug');
  if (overlayDebug) {
    overlayDebug.textContent = `Chyba: ${err.code} – ${err.message}`;
  }
}

function initMap(lat, lng) {
  console.log("Inicializuji mapu s polohou:", lat, lng);

  map = L.map('map').setView([lat, lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  myMarker = L.marker([lat, lng]).addTo(map);
  myMarker.bindTooltip(myName, { permanent: true, direction: 'top' });

  if (pendingUserArray) {
    console.log("Zpracovávám dříve přijaté pozice...");
    renderMarkers(pendingUserArray);
    pendingUserArray = null;
  }
}

function updateLocation(pos) {
  if (!pos.coords) {
    console.warn("Chybějící souřadnice při updateLocation.");
    return;
  }

  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  console.log("Odesílám svou pozici na server:", lat, lng);

  socket.emit('sendLocation', { lat, lng });

  if (myMarker) {
    myMarker.setLatLng([lat, lng]);
    myMarker.setTooltipContent(myName);
  }
}

socket.on('updateLocations', (userArray) => {
  console.log("Přišla data od serveru:", userArray);

  if (!map) {
    console.warn("Mapa ještě není připravená, ukládám pozice...");
    pendingUserArray = userArray;
    return;
  }

  renderMarkers(userArray);
});

function renderMarkers(userArray) {
  for (let id in otherMarkers) {
    map.removeLayer(otherMarkers[id]);
  }
  otherMarkers = {};

  let myLatLng = myMarker ? myMarker.getLatLng() : null;

  userArray.forEach((u) => {
    if (u.id === socket.id) return;
    if (typeof u.lat !== 'number' || typeof u.lng !== 'number') {
      console.warn(`Uživatel "${u.name}" má neplatné souřadnice:`, u.lat, u.lng);
      return;
    }

    const marker = L.marker([u.lat, u.lng]);
    marker.bindTooltip(u.name || 'Neznámý', { permanent: true, direction: 'top' });
    marker.addTo(map);
    otherMarkers[u.id] = marker;

    if (myLatLng && notificationsEnabled) {
      const dist = myLatLng.distanceTo([u.lat, u.lng]);
      if (dist <= notificationDistance) {
        alert(`Pozor! Uživatel "${u.name}" je od tebe jen ${dist.toFixed(1)} m daleko!`);
      }
    }
  });
}