/**
 * VegaWx Weather Dashboard
 * Core Application Logic: Open-Meteo Geocoding, NWS API, RainViewer Radar & Leaflet
 */

// Application State
const state = {
  currentCity: "Bryan",
  currentState: "Texas",
  coords: { lat: 30.6744, lon: -96.3700 }, // Bryan, TX default
  unit: localStorage.getItem('vegawx_unit') || 'F', // 'F' or 'C'
  weatherData: null,
  hourlyData: null,
  dailyData: null,
  alertsData: [],
  stationInfo: null,
  radar: {
    map: null,
    marker: null,
    mode: 'nexrad', // 'nexrad', 'loop', 'windy'
    product: 'N0Q', // 'N0Q' (composite), 'N0U' (velocity), 'N0S' (SRV), 'N0Z', 'NET'
    siteCode: 'KGRK',
    cleanSite: 'GRK',
    iemLayer: null,
    host: "https://tilecache.rainviewer.com",
    frames: [],
    layers: [],
    currentIndex: 0,
    isPlaying: false,
    intervalId: null,
    colorScheme: 2, // Universal Blue (100% free, no API key needed)
    opacity: 0.8,
    speedMs: 700
  }
};

// Quick chips configuration
const QUICK_CITIES = [
  { name: "Bryan / College Station", query: "Bryan, TX" },
  { name: "Houston", query: "Houston, TX" },
  { name: "Austin", query: "Austin, TX" },
  { name: "Dallas", query: "Dallas, TX" },
  { name: "San Antonio", query: "San Antonio, TX" },
  { name: "Miami", query: "Miami, FL" },
  { name: "Denver", query: "Denver, CO" },
  { name: "Chicago", query: "Chicago, IL" },
  { name: "New York", query: "New York, NY" },
  { name: "Seattle", query: "Seattle, WA" }
];

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  renderQuickChips();
  initUnitToggle();
  initSearch();
  initHourlyScroll();
  initRadarControls();

  // Initial load with Bryan, TX
  loadWeatherByCoords(state.coords.lat, state.coords.lon, state.currentCity, state.currentState);
});

/* ==========================================================================
   UI Helpers & Quick Chips
   ========================================================================== */

function renderQuickChips() {
  const container = document.getElementById("quick-chips-container");
  if (!container) return;

  container.innerHTML = QUICK_CITIES.map(city => `
    <button class="quick-chip ${city.query.includes(state.currentCity) ? 'active' : ''}" 
            onclick="searchCity('${city.query}')">
      ${city.name}
    </button>
  `).join("");
}

function updateActiveChip(query) {
  const chips = document.querySelectorAll(".quick-chip");
  chips.forEach(chip => {
    if (chip.textContent.trim().toLowerCase().includes(query.toLowerCase()) || 
        query.toLowerCase().includes(chip.textContent.trim().toLowerCase())) {
      chip.classList.add("active");
    } else {
      chip.classList.remove("active");
    }
  });
}

function initUnitToggle() {
  const toggleBtn = document.getElementById("unit-toggle-btn");
  if (!toggleBtn) return;

  toggleBtn.textContent = `°${state.unit}`;
  toggleBtn.addEventListener("click", () => {
    state.unit = state.unit === 'F' ? 'C' : 'F';
    localStorage.setItem('vegawx_unit', state.unit);
    toggleBtn.textContent = `°${state.unit}`;
    
    // Re-render UI with new unit if we have weather data
    if (state.hourlyData && state.dailyData) {
      renderCurrentConditions();
      renderHourlyForecast();
      renderDailyForecast();
    }
  });
}

function initSearch() {
  const input = document.getElementById("city-input");
  const searchBtn = document.getElementById("search-btn");
  const locateBtn = document.getElementById("locate-btn");

  if (searchBtn && input) {
    searchBtn.addEventListener("click", () => searchCity(input.value.trim()));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchCity(input.value.trim());
      }
    });
  }

  if (locateBtn) {
    locateBtn.addEventListener("click", locateUser);
  }
}

function initHourlyScroll() {
  const container = document.getElementById("hourly-scroll-container");
  const leftBtn = document.getElementById("scroll-left-btn");
  const rightBtn = document.getElementById("scroll-right-btn");

  if (leftBtn && container) {
    leftBtn.addEventListener("click", () => {
      container.scrollBy({ left: -320, behavior: "smooth" });
    });
  }
  if (rightBtn && container) {
    rightBtn.addEventListener("click", () => {
      container.scrollBy({ left: 320, behavior: "smooth" });
    });
  }
}

/* ==========================================================================
   Search & Geocoding
   ========================================================================== */

async function searchCity(query) {
  if (!query) return;

  const titleEl = document.getElementById("city-title");
  if (titleEl) titleEl.innerText = "Searching location...";

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const res = await fetch(geoUrl);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      showErrorToast("City not found. Please verify spelling or try another US city.");
      if (titleEl) titleEl.innerText = `${state.currentCity}, ${state.currentState}`;
      return;
    }

    // Filter for US locations since NWS is US-only
    const usResult = data.results.find(r => r.country_code === "US") || data.results[0];

    if (usResult.country_code !== "US") {
      showErrorToast("The National Weather Service covers US locations. Please search for a US city.");
      if (titleEl) titleEl.innerText = `${state.currentCity}, ${state.currentState}`;
      return;
    }

    const lat = usResult.latitude;
    const lon = usResult.longitude;
    const cityName = usResult.name;
    const stateName = usResult.admin1 || "USA";

    updateActiveChip(cityName);
    await loadWeatherByCoords(lat, lon, cityName, stateName);

  } catch (err) {
    console.error("Geocoding error:", err);
    showErrorToast("Error searching city. Please check your internet connection.");
  }
}

function locateUser() {
  if (!navigator.geolocation) {
    showErrorToast("Geolocation is not supported by your browser.");
    return;
  }

  const titleEl = document.getElementById("city-title");
  if (titleEl) titleEl.innerText = "Finding your location...";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      await loadWeatherByCoords(lat, lon, "Your Location", "");
    },
    (err) => {
      console.warn("Geolocation denied or failed:", err);
      showErrorToast("Location access denied or unavailable.");
      if (titleEl) titleEl.innerText = `${state.currentCity}, ${state.currentState}`;
    },
    { timeout: 10000 }
  );
}

/* ==========================================================================
   Weather Data Fetching (National Weather Service)
   ========================================================================== */

async function loadWeatherByCoords(lat, lon, cityLabel, stateLabel) {
  state.coords = { lat, lon };
  state.currentCity = cityLabel;
  state.currentState = stateLabel;

  showLoadingState(true);

  try {
    // 1. Fetch NWS grid point metadata
    const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
    if (!pointRes.ok) {
      throw new Error(`NWS point lookup failed (${pointRes.status}). NWS covers US territories only.`);
    }
    const pointData = await pointRes.json();
    const props = pointData.properties;

    // Detect exact city/state if label was generic (e.g. from GPS)
    if (cityLabel === "Your Location" && props.relativeLocation && props.relativeLocation.properties) {
      state.currentCity = props.relativeLocation.properties.city || "Local";
      state.currentState = props.relativeLocation.properties.state || "";
    }

    // 2. Fetch Hourly, Daily Forecast, Alerts, and Station in parallel
    const hourlyUrl = props.forecastHourly;
    const dailyUrl = props.forecast;
    const stationsUrl = props.observationStations;
    const alertsUrl = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;

    const [hourlyRes, dailyRes, alertsRes, stationsRes] = await Promise.allSettled([
      fetch(hourlyUrl).then(r => r.json()),
      fetch(dailyUrl).then(r => r.json()),
      fetch(alertsUrl).then(r => r.json()),
      fetch(stationsUrl).then(r => r.json())
    ]);

    // Save state safely
    state.hourlyData = (hourlyRes.status === "fulfilled" && hourlyRes.value?.properties?.periods) 
      ? hourlyRes.value.properties.periods 
      : [];
      
    state.dailyData = (dailyRes.status === "fulfilled" && dailyRes.value?.properties?.periods) 
      ? dailyRes.value.properties.periods 
      : [];
      
    state.alertsData = (alertsRes.status === "fulfilled" && alertsRes.value?.features) 
      ? alertsRes.value.features 
      : [];
    
    // Observation station info
    if (stationsRes.status === "fulfilled" && stationsRes.value?.features?.length > 0) {
      state.stationInfo = stationsRes.value.features[0].properties;
    } else {
      state.stationInfo = {
        stationIdentifier: props.cwa || "NWS",
        name: `NWS ${props.cwa || "Regional"} Forecast Office`
      };
    }

    // Technical meteorological info
    renderTechInfo(props);

    // Update local radar station ID
    if (props.radarStation) {
      state.radar.siteCode = props.radarStation;
      state.radar.cleanSite = props.radarStation.replace(/^K/, '');
      const dualPolBtn = document.getElementById("btn-dual-pol");
      if (dualPolBtn) {
        dualPolBtn.href = `https://radar.weather.gov/station/${state.radar.siteCode}/standard`;
        dualPolBtn.title = `Open official NWS Level II Dual-Pol viewer for ${state.radar.siteCode} (CC, ZDR, Velocity couplets)`;
      }
    }

    // Render UI Components
    renderAlerts();
    renderCurrentConditions();
    renderHourlyForecast();
    renderDailyForecast();

    // Update Radar Map position
    updateRadarMapLocation(lat, lon);

    showLoadingState(false);

  } catch (err) {
    console.error("NWS Weather Fetch Error:", err);
    showErrorToast(err.message || "Failed to load weather data.");
    showLoadingState(false);
  }
}

/* ==========================================================================
   UI Renderers
   ========================================================================== */

function showLoadingState(isLoading) {
  const titleEl = document.getElementById("city-title");
  if (isLoading) {
    if (titleEl) {
      titleEl.innerHTML = `<span class="loading-indicator me-2"></span> Updating Forecast...`;
    }
  } else {
    if (titleEl) {
      titleEl.innerText = state.currentState 
        ? `${state.currentCity}, ${state.currentState}` 
        : state.currentCity;
    }
  }
}

function renderAlerts() {
  const container = document.getElementById("alerts-container");
  if (!container) return;

  if (!state.alertsData || state.alertsData.length === 0) {
    container.innerHTML = "";
    return;
  }

  const alertHtml = state.alertsData.map((alert, idx) => {
    const props = alert.properties;
    const severity = (props.severity || "info").toLowerCase();
    const alertClass = severity === "extreme" || severity === "severe" 
      ? "alert-banner" 
      : (severity === "moderate" ? "alert-banner warning-level" : "alert-banner advisory-level");

    return `
      <div class="${alertClass} shadow-sm">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div class="d-flex align-items-center">
            <span class="alert-pulse"></span>
            <strong>${props.event || "Weather Alert"}</strong>
            <span class="ms-2 badge bg-dark bg-opacity-50">${props.severity || "Notice"}</span>
          </div>
          <button class="btn btn-sm btn-outline-light py-0 px-2" type="button" 
                  data-bs-toggle="collapse" data-bs-target="#alert-detail-${idx}">
            Details <i class="bi bi-chevron-down ms-1"></i>
          </button>
        </div>
        <div class="mt-2 text-white-50" style="font-size: 0.9rem;">
          ${props.headline || (props.description ? props.description.substring(0, 160) + "..." : "")}
        </div>
        <div class="collapse mt-3 pt-3 border-top border-white border-opacity-10" id="alert-detail-${idx}">
          <p class="mb-2" style="white-space: pre-line; font-size: 0.85rem;">${props.description || "No further details available."}</p>
          ${props.instruction ? `<div class="p-2 rounded bg-dark bg-opacity-40 text-warning" style="font-size: 0.82rem;"><strong>Precautionary/Preparedness Actions:</strong> ${props.instruction}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = alertHtml;
}

function renderCurrentConditions() {
  if (!state.hourlyData || state.hourlyData.length === 0) return;

  const current = state.hourlyData[0];
  const tempF = current.temperature;
  const humidity = current.relativeHumidity?.value !== undefined ? current.relativeHumidity.value : 50;
  const windRaw = current.windSpeed || "0 mph";
  const windMph = parseInt(windRaw, 10) || 0;
  const windDir = current.windDirection || "--";
  const pop = current.probabilityOfPrecipitation?.value || 0;

  // Dew point in Celsius to Unit
  let dewPointF = 0;
  if (current.dewpoint && current.dewpoint.value !== null && current.dewpoint.value !== undefined) {
    dewPointF = Math.round((current.dewpoint.value * 9 / 5) + 32);
  } else {
    dewPointF = tempF - Math.round((100 - humidity) / 5);
  }

  // Calculate feels like
  const feelsLikeF = calculateFeelsLike(tempF, humidity, windMph);

  // High & Low from daily forecast
  let todayHigh = "--";
  let todayLow = "--";
  if (state.dailyData && state.dailyData.length > 0) {
    const todayPeriod = state.dailyData[0];
    const tonightPeriod = state.dailyData[1];
    if (todayPeriod.isDaytime) {
      todayHigh = `${formatTemp(todayPeriod.temperature)}°`;
      todayLow = tonightPeriod ? `${formatTemp(tonightPeriod.temperature)}°` : "--";
    } else {
      todayLow = `${formatTemp(todayPeriod.temperature)}°`;
      todayHigh = tonightPeriod ? `${formatTemp(tonightPeriod.temperature)}°` : "--";
    }
  }

  // Station label
  const stationLabel = state.stationInfo 
    ? `${state.stationInfo.stationIdentifier} · ${state.stationInfo.name || "Observation Station"}`
    : "Local Observation Station";

  const stationEl = document.getElementById("current-station-text");
  if (stationEl) stationEl.innerText = stationLabel;

  const tempEl = document.getElementById("current-temp");
  if (tempEl) tempEl.innerText = formatTemp(tempF);

  const unitEl = document.getElementById("current-temp-unit");
  if (unitEl) unitEl.innerText = `°${state.unit}`;

  const condEl = document.getElementById("current-condition");
  if (condEl) condEl.innerText = current.shortForecast || "Clear";

  const highLowEl = document.getElementById("current-high-low");
  if (highLowEl) highLowEl.innerText = `H: ${todayHigh} · L: ${todayLow}`;

  // Icon
  const iconEl = document.getElementById("current-icon");
  if (iconEl && current.icon) {
    iconEl.src = current.icon;
    iconEl.alt = current.shortForecast || "Weather";
    iconEl.onerror = () => {
      iconEl.src = "https://api.weather.gov/icons/land/day/few?size=medium";
    };
  }

  // Metrics Grid
  const feelsLikeEl = document.getElementById("metric-feels-like");
  if (feelsLikeEl) feelsLikeEl.innerText = `${formatTemp(feelsLikeF)}°`;

  const windEl = document.getElementById("metric-wind");
  if (windEl) windEl.innerText = formatWind(windRaw);

  const humidityEl = document.getElementById("metric-humidity");
  if (humidityEl) humidityEl.innerText = `${humidity}%`;

  const dewpointEl = document.getElementById("metric-dewpoint");
  if (dewpointEl) dewpointEl.innerText = `${formatTemp(dewPointF)}°`;

  const precipEl = document.getElementById("metric-precip");
  if (precipEl) precipEl.innerText = `${pop}%`;

  const windDirEl = document.getElementById("metric-wind-dir");
  if (windDirEl) windDirEl.innerText = windDir;
}

function renderHourlyForecast() {
  const container = document.getElementById("hourly-scroll-container");
  if (!container || !state.hourlyData) return;

  const hours = state.hourlyData.slice(0, 24); // Next 24 hours

  container.innerHTML = hours.map((hour, idx) => {
    const date = new Date(hour.startTime);
    const timeStr = idx === 0 
      ? "Now" 
      : date.toLocaleTimeString([], { hour: 'numeric' });
    const pop = hour.probabilityOfPrecipitation?.value || 0;

    return `
      <div class="hourly-card ${idx === 0 ? 'current-hour' : ''}">
        <div class="hourly-time">${timeStr}</div>
        <img src="${hour.icon}" alt="${hour.shortForecast}" class="hourly-icon" 
             onerror="this.src='https://api.weather.gov/icons/land/day/few?size=small'">
        <div class="hourly-temp">${formatTemp(hour.temperature)}°</div>
        <div class="hourly-pop ${pop > 20 ? 'text-info' : 'text-muted'}">
          <i class="bi bi-droplet-fill" style="font-size: 0.65rem;"></i> ${pop}%
        </div>
        <div class="hourly-wind mt-1">${formatWind(hour.windSpeed)}</div>
      </div>
    `;
  }).join("");
}

function renderDailyForecast() {
  const container = document.getElementById("daily-forecast-container");
  if (!container || !state.dailyData) return;

  // Process NWS periods into paired days
  const dailyPairs = [];
  const periods = state.dailyData;

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (p.isDaytime) {
      const night = periods[i + 1] && !periods[i + 1].isDaytime ? periods[i + 1] : null;
      dailyPairs.push({
        dayName: p.name,
        icon: p.icon,
        condition: p.shortForecast,
        high: p.temperature,
        low: night ? night.temperature : p.temperature - 15,
        pop: p.probabilityOfPrecipitation?.value || 0
      });
      if (night) i++; // skip night period
    } else {
      // Started at night
      dailyPairs.push({
        dayName: p.name,
        icon: p.icon,
        condition: p.shortForecast,
        high: p.temperature + 10,
        low: p.temperature,
        pop: p.probabilityOfPrecipitation?.value || 0
      });
    }
    if (dailyPairs.length >= 7) break;
  }

  // Find min and max for range bar
  const allTemps = dailyPairs.flatMap(d => [d.high, d.low]);
  const minTemp = Math.min(...allTemps);
  const maxTemp = Math.max(...allTemps);
  const tempRange = Math.max(1, maxTemp - minTemp);

  container.innerHTML = dailyPairs.map(day => {
    const leftPct = Math.max(0, ((day.low - minTemp) / tempRange) * 100);
    const widthPct = Math.max(15, ((day.high - day.low) / tempRange) * 100);

    return `
      <div class="daily-row">
        <div class="daily-day">${day.dayName}</div>
        <div class="daily-condition">
          <img src="${day.icon}" alt="${day.condition}" class="daily-icon"
               onerror="this.src='https://api.weather.gov/icons/land/day/few?size=small'">
          <span class="text-truncate" style="max-width: 220px;">${day.condition}</span>
        </div>
        <div class="daily-temp-bar-wrap">
          <span class="temp-low">${formatTemp(day.low)}°</span>
          <div class="temp-bar-bg">
            <div class="temp-bar-fill" style="left: ${leftPct}%; width: ${widthPct}%;"></div>
          </div>
          <span class="temp-high">${formatTemp(day.high)}°</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderTechInfo(props) {
  const container = document.getElementById("nws-tech-info");
  if (!container) return;

  container.innerHTML = `
    <div class="row g-2 text-muted" style="font-size: 0.82rem;">
      <div class="col-sm-6">
        <div><strong>Forecast Office:</strong> NWS ${props.cwa || "N/A"}</div>
        <div><strong>Grid Coordinates:</strong> X: ${props.gridX}, Y: ${props.gridY}</div>
      </div>
      <div class="col-sm-6 text-sm-end">
        <div><strong>Lat / Lon:</strong> ${state.coords.lat.toFixed(4)}, ${state.coords.lon.toFixed(4)}</div>
        <div>
          <a href="https://forecast.weather.gov/product.php?site=${props.cwa}&issuedby=${props.cwa}&product=AFD" 
             target="_blank" class="text-info text-decoration-none">
            <i class="bi bi-box-arrow-up-right me-1"></i>Area Forecast Discussion (AFD)
          </a>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   Multi-Source Live Radar: High-Res NEXRAD, RainViewer Loop & Windy
   ========================================================================== */

async function initRadarMap() {
  const mapContainer = document.getElementById("radar-map");
  if (!mapContainer || state.radar.map) return;

  // Initialize Leaflet Map
  state.radar.map = L.map('radar-map', {
    center: [state.coords.lat, state.coords.lon],
    zoom: 8,
    zoomControl: true,
    attributionControl: false
  });

  // ESRI World Dark Gray Canvas Base (100% Free, No API Key, No Watermark)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
  }).addTo(state.radar.map);

  // High-Resolution US NEXRAD N0Q Base Reflectivity Layer (IEM / NOAA)
  // Free, high-resolution, full radar color scheme, no zoom caps, no API key needed
  state.radar.iemLayer = L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png', {
    maxZoom: 16,
    opacity: state.radar.opacity,
    zIndex: 90,
    attribution: 'Radar &copy; NOAA / IEM'
  }).addTo(state.radar.map);

  // ESRI City Names & County Borders Layer (Rendered on top of radar)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16,
    zIndex: 110,
    opacity: 0.85
  }).addTo(state.radar.map);

  // Invalidate size once rendered
  setTimeout(() => {
    if (state.radar.map) state.radar.map.invalidateSize();
  }, 250);

  // Add initial location pin
  updateRadarMarker(state.coords.lat, state.coords.lon);

  // Set default mode UI (NEXRAD is primary)
  setRadarMode('nexrad');
}

function updateRadarMarker(lat, lon) {
  if (!state.radar.map) return;

  if (state.radar.marker) {
    state.radar.marker.setLatLng([lat, lon]);
  } else {
    // Custom radar pulse pin
    const pulseIcon = L.divIcon({
      className: 'radar-pulse-icon',
      html: `<div style="width: 14px; height: 14px; background: #38bdf8; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 10px #38bdf8;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    state.radar.marker = L.marker([lat, lon], { icon: pulseIcon }).addTo(state.radar.map);
  }
}

function updateRadarMapLocation(lat, lon) {
  // Update Windy iframe if active
  const windyEl = document.getElementById("windy-frame");
  if (windyEl) {
    windyEl.src = `https://embed.windy.com/embed2.html?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&zoom=8&level=surface&overlay=radar&metricWind=kt&metricTemp=%C2%B0F&lightning=true`;
  }

  if (!state.radar.map) {
    initRadarMap();
    return;
  }
  state.radar.map.flyTo([lat, lon], 8, { duration: 1.2 });
  updateRadarMarker(lat, lon);
  setTimeout(() => {
    if (state.radar.map) state.radar.map.invalidateSize();
  }, 300);
}

// Mode Switcher: 'nexrad' (High-Res NWS), 'loop' (RainViewer), 'windy' (Windy + Lightning)
async function setRadarMode(mode) {
  state.radar.mode = mode;

  // Stop playback if switching away from loop
  if (state.radar.isPlaying && mode !== 'loop') {
    toggleRadarPlay();
  }

  // Update button active styling
  ['nexrad', 'loop', 'windy'].forEach(m => {
    const btn = document.getElementById(`btn-mode-${m}`);
    if (btn) {
      if (m === mode) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  const mapEl = document.getElementById('radar-map');
  const windyEl = document.getElementById('windy-frame');
  const playbackRow = document.getElementById('radar-playback-row');
  const sourceBadge = document.getElementById('radar-source-badge');
  const timeEl = document.getElementById('radar-timestamp');

  if (mode === 'windy') {
    if (mapEl) mapEl.style.display = 'none';
    if (windyEl) {
      windyEl.style.display = 'block';
      if (!windyEl.src || windyEl.src === 'about:blank') {
        windyEl.src = `https://embed.windy.com/embed2.html?lat=${state.coords.lat.toFixed(4)}&lon=${state.coords.lon.toFixed(4)}&zoom=8&level=surface&overlay=radar&metricWind=kt&metricTemp=%C2%B0F&lightning=true`;
      }
    }
    if (playbackRow) playbackRow.style.display = 'none';
    if (sourceBadge) sourceBadge.innerText = 'Windy Radar & Live Lightning';
    if (timeEl) timeEl.innerHTML = '<span class="badge bg-primary">LIVE RADAR + LIGHTNING</span>';
    return;
  }

  // Leaflet modes (nexrad or loop)
  if (windyEl) windyEl.style.display = 'none';
  if (mapEl) {
    mapEl.style.display = 'block';
    if (state.radar.map) state.radar.map.invalidateSize();
  }

  if (mode === 'nexrad') {
    state.radar.layers.forEach(l => l.setOpacity(0));
    if (playbackRow) playbackRow.style.display = 'none';
    const productBar = document.getElementById('radar-product-bar');
    if (productBar) productBar.style.display = 'flex';
    updateNWSProductLayer();
    if (timeEl) timeEl.innerHTML = '<span class="badge bg-success">LIVE COMPOSITE</span>';
  } else if (mode === 'loop') {
    if (state.radar.iemLayer) state.radar.iemLayer.setOpacity(0);
    if (playbackRow) playbackRow.style.display = 'flex';
    const productBar = document.getElementById('radar-product-bar');
    if (productBar) productBar.style.display = 'none';
    if (sourceBadge) sourceBadge.innerText = 'RainViewer 2-Hr Doppler Loop';
    if (state.radar.frames.length === 0) {
      if (timeEl) timeEl.innerHTML = '<span class="badge bg-secondary">LOADING LOOP...</span>';
      await loadRainViewerRadar();
    } else {
      showRadarFrame(state.radar.currentIndex);
    }
  }
}
window.setRadarMode = setRadarMode;

function updateNWSProductLayer() {
  if (!state.radar.map) return;
  if (state.radar.iemLayer) {
    state.radar.map.removeLayer(state.radar.iemLayer);
  }

  const prod = state.radar.product;
  let tileUrl = '';
  let badgeText = '';

  if (prod === 'N0Q') {
    tileUrl = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png';
    badgeText = 'NWS / NOAA NEXRAD Base Reflectivity (Composite)';
  } else {
    // Single-site product from local WSR-88D station
    tileUrl = `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${state.radar.cleanSite}-${prod}-0/{z}/{x}/{y}.png`;
    const prodLabels = {
      'N0U': `${state.radar.siteCode} Base Velocity (Radial Wind)`,
      'N0S': `${state.radar.siteCode} Storm-Relative Motion (SRV)`,
      'N0Z': `${state.radar.siteCode} Long-Range Reflectivity (248nm)`,
      'NET': `${state.radar.siteCode} Echo Tops (Cloud Height)`
    };
    badgeText = prodLabels[prod] || `${state.radar.siteCode} ${prod}`;
  }

  state.radar.iemLayer = L.tileLayer(tileUrl, {
    maxZoom: 16,
    opacity: state.radar.opacity,
    zIndex: 90,
    attribution: 'Radar &copy; NOAA / IEM'
  }).addTo(state.radar.map);

  const sourceBadge = document.getElementById('radar-source-badge');
  if (sourceBadge) sourceBadge.innerText = badgeText;
}

function setRadarProduct(prod) {
  state.radar.product = prod;
  if (state.radar.mode !== 'nexrad') {
    setRadarMode('nexrad');
  } else {
    updateNWSProductLayer();
  }
}
window.setRadarProduct = setRadarProduct;

function toggleRadarFullscreen() {
  const card = document.getElementById("radar-card");
  const icon = document.getElementById("fullscreen-icon");
  const text = document.getElementById("fullscreen-text");
  if (!card) return;

  card.classList.toggle("radar-fullscreen");
  const isFull = card.classList.contains("radar-fullscreen");

  if (icon) {
    icon.className = isFull ? "bi bi-fullscreen-exit me-1" : "bi bi-arrows-fullscreen me-1";
  }
  if (text) {
    text.innerText = isFull ? "Exit" : "Full Screen";
  }

  setTimeout(() => {
    if (state.radar.map) state.radar.map.invalidateSize();
  }, 200);
}
window.toggleRadarFullscreen = toggleRadarFullscreen;

// Escape key exits fullscreen
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const card = document.getElementById("radar-card");
    if (card && card.classList.contains("radar-fullscreen")) {
      toggleRadarFullscreen();
    }
  }
});

async function loadRainViewerRadar() {
  try {
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    const data = await res.json();

    state.radar.host = data.host || "https://tilecache.rainviewer.com";
    state.radar.frames = data.radar?.past || [];

    if (state.radar.frames.length === 0) return;

    // Clear old animation layers
    state.radar.layers.forEach(l => {
      if (state.radar.map) state.radar.map.removeLayer(l);
    });
    state.radar.layers = [];

    // Pre-create tile layers with opacity 0 to enable seamless switching
    // CRITICAL: maxNativeZoom: 7 prevents "zoom level not supported" error on RainViewer free tier!
    // CRITICAL: colorScheme 2 (Universal Blue) is officially supported on free tier without API key!
    state.radar.frames.forEach((frame) => {
      const tileUrl = `${state.radar.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
      const layer = L.tileLayer(tileUrl, {
        tileSize: 256,
        opacity: 0,
        zIndex: 100,
        maxZoom: 18,
        maxNativeZoom: 7 // Prevents requesting tiles above zoom 7, Leaflet upscales client-side
      });
      layer.addTo(state.radar.map);
      state.radar.layers.push(layer);
    });

    // Setup slider
    const slider = document.getElementById("radar-slider");
    if (slider) {
      slider.max = state.radar.frames.length - 1;
      slider.value = state.radar.frames.length - 1;
    }

    if (state.radar.mode === 'loop') {
      showRadarFrame(state.radar.frames.length - 1);
    }

  } catch (err) {
    console.error("RainViewer Radar load failed:", err);
  }
}

function showRadarFrame(index) {
  if (!state.radar.layers || state.radar.layers.length === 0) return;
  if (index < 0 || index >= state.radar.layers.length) return;

  state.radar.currentIndex = index;

  // Toggle opacity on RainViewer frames only
  state.radar.layers.forEach((layer, i) => {
    layer.setOpacity(i === index ? state.radar.opacity : 0);
  });

  // Update slider UI
  const slider = document.getElementById("radar-slider");
  if (slider && slider.value != index) slider.value = index;

  // Update timestamp badge
  const timeEl = document.getElementById("radar-timestamp");
  if (timeEl && state.radar.frames[index]) {
    const frameTime = new Date(state.radar.frames[index].time * 1000);
    const isLive = index === state.radar.frames.length - 1;
    timeEl.innerHTML = isLive 
      ? `<span class="badge bg-success me-1">LIVE</span> ${frameTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : `<span class="badge bg-secondary me-1">PAST</span> ${frameTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
}

function toggleRadarPlay() {
  const btn = document.getElementById("radar-play-btn");
  if (state.radar.isPlaying) {
    // Stop playback
    clearInterval(state.radar.intervalId);
    state.radar.isPlaying = false;
    if (btn) btn.innerHTML = `<i class="bi bi-play-fill"></i>`;
  } else {
    // Start playback
    state.radar.isPlaying = true;
    if (btn) btn.innerHTML = `<i class="bi bi-pause-fill"></i>`;

    state.radar.intervalId = setInterval(() => {
      let nextIndex = state.radar.currentIndex + 1;
      if (nextIndex >= state.radar.frames.length) {
        nextIndex = 0;
      }
      showRadarFrame(nextIndex);
    }, state.radar.speedMs);
  }
}

function initRadarControls() {
  const playBtn = document.getElementById("radar-play-btn");
  const slider = document.getElementById("radar-slider");
  const opacitySlider = document.getElementById("radar-opacity-slider");

  if (playBtn) playBtn.addEventListener("click", toggleRadarPlay);

  if (slider) {
    slider.addEventListener("input", (e) => {
      if (state.radar.isPlaying) toggleRadarPlay(); // pause on scrub
      showRadarFrame(parseInt(e.target.value, 10));
    });
  }

  if (opacitySlider) {
    opacitySlider.addEventListener("input", (e) => {
      state.radar.opacity = parseFloat(e.target.value);
      if (state.radar.mode === 'nexrad' && state.radar.iemLayer) {
        state.radar.iemLayer.setOpacity(state.radar.opacity);
      } else if (state.radar.mode === 'loop') {
        showRadarFrame(state.radar.currentIndex);
      }
    });
  }
}

/* ==========================================================================
   Math, Calculations & Formatters
   ========================================================================== */

function formatTemp(tempF) {
  if (tempF === null || tempF === undefined || isNaN(tempF)) return "--";
  if (state.unit === 'C') {
    return Math.round((tempF - 32) * 5 / 9);
  }
  return Math.round(tempF);
}

function formatWind(windStr) {
  if (!windStr) return "--";
  if (state.unit === 'C') {
    // Convert mph to km/h
    return windStr.replace(/(\d+)\s*mph/gi, (match, val) => `${Math.round(parseInt(val, 10) * 1.60934)} km/h`);
  }
  return windStr;
}

// NOAA / NWS Heat Index & Wind Chill formula
function calculateFeelsLike(tempF, humidity, windMph) {
  if (tempF <= 50 && windMph >= 3) {
    // Wind Chill
    const v016 = Math.pow(windMph, 0.16);
    return Math.round(35.74 + (0.6215 * tempF) - (35.75 * v016) + (0.4275 * tempF * v016));
  } else if (tempF >= 80) {
    // Heat Index (Rothfusz equation)
    const T = tempF;
    const R = humidity;
    let HI = 0.5 * (T + 61.0 + ((T - 68.0) * 1.2) + (R * 0.094));
    if (HI >= 80) {
      HI = -42.379 + 2.04901523 * T + 10.14333127 * R
           - 0.22475541 * T * R - 0.00683783 * T * T
           - 0.05481717 * R * R + 0.00122874 * T * T * R
           + 0.00085282 * T * R * R - 0.00000199 * T * T * R * R;
    }
    return Math.round(HI);
  }
  return tempF;
}

function showErrorToast(msg) {
  const toastEl = document.getElementById("liveToast");
  const msgEl = document.getElementById("toast-message");
  if (toastEl && msgEl && window.bootstrap) {
    msgEl.innerText = msg;
    const toast = new bootstrap.Toast(toastEl, { delay: 4500 });
    toast.show();
  } else {
    alert(msg);
  }
}
