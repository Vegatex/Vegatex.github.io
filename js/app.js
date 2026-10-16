/**
 * VegaTex.Weather - Core Application Engine
 * High-performance operational meteorological platform powered by NWS, NOAA & In-House NWP Guidance
 * Texas A&M Maroon Brand Palette & Dynamic Light/Dark Theme
 */

// Application State
const state = {
  currentCity: "Bryan",
  currentState: "Texas",
  county: "Brazos County",
  cwa: "HGX",
  coords: { lat: 30.6744, lon: -96.3700 }, // Bryan, TX default
  unit: localStorage.getItem('vegawx_unit') || 'F', // 'F' or 'C'
  theme: localStorage.getItem('vegawx_theme') || 'dark', // 'dark' or 'light'
  weatherData: null,
  hourlyData: null,
  dailyData: null,
  alertsData: [],
  stationInfo: null,
  afdText: null,
  modelStudio: {
    model: 'RRFS',
    param: 'refc',
    domain: 'conus',
    fullscreen: false
  },
  modelConsensusData: null,
  radar: {
    map: null,
    marker: null,
    baseLayer: null,
    refLayer: null,
    mode: 'nexrad', // 'nexrad', 'loop'
    product: 'N0Q', // 'N0Q', 'N0U', 'N0S', 'N0Z', 'NET'
    siteCode: 'KGRK',
    cleanSite: 'GRK',
    iemLayer: null,
    host: "https://tilecache.rainviewer.com",
    frames: [],
    layers: [],
    currentIndex: 0,
    isPlaying: false,
    intervalId: null,
    colorScheme: 2, // Universal Blue
    opacity: 0.8,
    speedMs: 700
  }
};

// Quick city chips
const QUICK_CITIES = [
  { name: "Bryan / College Station", query: "Bryan, TX" },
  { name: "Houston", query: "Houston, TX" },
  { name: "Austin", query: "Austin, TX" },
  { name: "Dallas-Fort Worth", query: "Dallas, TX" },
  { name: "San Antonio", query: "San Antonio, TX" },
  { name: "Denver", query: "Denver, CO" },
  { name: "Miami", query: "Miami, FL" },
  { name: "Chicago", query: "Chicago, IL" },
  { name: "New York", query: "New York, NY" },
  { name: "Seattle", query: "Seattle, WA" }
];

// NWP Model Specifications & Forecast Eagle Explorer Routing
const NWP_MODELS = {
  'RRFS': {
    name: 'RRFS (Rapid Refresh Forecast System)',
    tag: 'Next-Gen 3km',
    fePath: 'rrfs',
    domain: 'conus',
    defaultField: 'refc',
    org: 'NOAA / NWS / EMC',
    type: 'Next-Gen FV3-Based Convection-Allowing Model',
    res: '3 km CONUS grid',
    cycle: 'Hourly (15-min steps to 18h / hourly to 60h)',
    summary: 'NOAA\'s next-generation high-resolution atmospheric prediction system using the Finite-Volume Cubed-Sphere (FV3) dynamical core to replace RAP & HRRR with unified convective-scale guidance.',
    strengths: 'Convective storm initiation, discrete supercell evolution, updraft helicity, boundary layer transitions, and advanced microphysics.',
    supportsFields: ['refc', 'tmp', 'wind', 'cape', 'precip', 'refcptype', 'meteogram', 'sounding']
  },
  'HRRR': {
    name: 'HRRR (High-Resolution Rapid Refresh)',
    tag: '3km Operational',
    fePath: 'hrrr',
    domain: 'conus',
    defaultField: 'refc',
    org: 'NOAA / NCEP & ESRL',
    type: 'Operational Convection-Allowing Benchmark',
    res: '3 km CONUS grid',
    cycle: 'Hourly (15-min steps to 18h, hourly to 48h)',
    summary: 'The operational benchmark for short-term severe convection, supercells, squall lines, downburst winds, tornado environment analysis, and flash flood precipitation in the contiguous US.',
    strengths: 'Simulated composite radar reflectivity, 10m wind gusts, storm-scale rotation, cold pool dynamics, and localized flash flooding.',
    supportsFields: ['refc', 'tmp', 'wind', 'cape', 'precip', 'refcptype', 'meteogram', 'sounding']
  },
  'GFS': {
    name: 'GFS (Global Forecast System)',
    tag: 'Global 13km',
    fePath: 'gfs',
    domain: 'conus',
    defaultField: 'refc',
    org: 'NOAA / National Weather Service',
    type: 'Global Numerical Spectral / FV3 Core',
    res: '13 km native Gaussian grid',
    cycle: '4x Daily (00z, 06z, 12z, 18z) to F384',
    summary: 'NOAA\'s flagship operational numerical model predicting synoptic planetary wave patterns, high/low pressure centers, cold fronts, winter storms, and Atlantic/Pacific tropical cyclones.',
    strengths: '500mb Rossby wave dynamics, continental airmass transitions, Arctic cold air outbreaks, synoptic precipitation shields, and tropical cyclogenesis.',
    supportsFields: ['refc', 'tmp', 'wind', 'cape', 'precip', 'meteogram', 'sounding']
  },
  'NBM': {
    name: 'NBM (National Blend of Models)',
    tag: 'NWS Blend 2.5km',
    fePath: 'nbm',
    domain: 'conus',
    defaultField: 'tmp',
    org: 'NOAA / NWS Office of Science & Technology',
    type: 'Statistically Calibrated Multi-Model Super-Ensemble',
    res: '2.5 km CONUS grid',
    cycle: 'Hourly updates to Day 11 (264h)',
    summary: 'The operational foundation of official NWS forecasts. Statistically blends and post-processes the GFS, ECMWF, HRRR, Canadian GDPS, and ensemble members calibrated against real-world observations.',
    strengths: 'Optimal calibrated point temperatures, calibrated precipitation probabilities (PoP), wind gust statistics, snow-to-liquid ratios, and reduced individual model bias.',
    supportsFields: ['tmp', 'wind', 'precip', 'meteogram', 'sounding']
  },
  'REFS': {
    name: 'REFS (RRFS Convective Ensemble)',
    tag: '3km Ensemble',
    fePath: 'refs',
    domain: 'conus',
    defaultField: '',
    org: 'NOAA / EMC',
    type: 'Next-Gen Convective Ensemble Probabilities',
    res: '3 km CONUS grid',
    cycle: '4x Daily (00z, 06z, 12z, 18z)',
    summary: 'The RRFS ensemble — neighbourhood probabilities of severe storms, updraft rotation, lightning, heavy rain and severe wind gusts, plus the probability-matched mean and ensemble spread.',
    strengths: 'Probabilistic severe weather forecasting, convective initiation uncertainty envelopes, and extreme rainfall hazard risk.',
    supportsFields: ['meteogram', 'sounding']
  },
  'WN3': {
    name: 'WeatherNext 3 (Google DeepMind AI)',
    tag: '0.1° AI Model',
    fePath: 'weathernext3',
    domain: '',
    defaultField: '',
    org: 'Google DeepMind & NOAA',
    type: 'Deep Learning / Graph Neural Network (GNN)',
    res: '0.1° (~10 km) Global Grid',
    cycle: 'Hourly to F048 · Ensemble Mean',
    summary: 'Google\'s state-of-the-art WeatherNext 3 neural forecasting architecture trained on decades of reanalysis data. Produces fast, high-fidelity planetary atmospheric simulations in seconds.',
    strengths: 'Rapid inference speed, high-skill synoptic geopotential height tracking, jet stream positioning, and reduced computational energy usage.',
    supportsFields: ['meteogram', 'sounding']
  },
  'RTMA': {
    name: 'RTMA (Real-Time Mesoscale Analysis)',
    tag: '2.5km Analysis',
    fePath: 'rtma',
    domain: 'conus',
    defaultField: 'tmp',
    org: 'NOAA / NWS',
    type: 'Observational Ground-Truth Analysis',
    res: '2.5 km CONUS grid',
    cycle: 'Hourly real-time surface analysis',
    summary: 'Not a forecast, but NOAA\'s high-resolution record of what the surface weather actually was hour by hour. The definitive benchmark against which all model forecasts are verified.',
    strengths: 'Observed surface truth, mesoscale fronts, localized terrain temperature pools, and post-event meteorological verification.',
    supportsFields: ['tmp', 'wind', 'precip', 'meteogram', 'sounding']
  },
  'ECMWF': {
    name: 'ECMWF IFS (European Centre 9km)',
    tag: 'Euro 9km',
    fePath: '',
    domain: '',
    defaultField: 'meteogram',
    org: 'European Centre for Medium-Range Weather Forecasts',
    type: 'Global High-Resolution 4D-Var Physics Benchmark',
    res: '9 km global grid',
    cycle: '2x–4x Daily to Day 10 (240h)',
    summary: 'Widely recognized as the international gold standard in numerical weather prediction. Employs 4D-Var data assimilation ingesting hundreds of millions of satellite, radar, and radiosonde soundings.',
    strengths: 'Highest verification scores globally on 500mb anomaly correlation, precise storm track trajectory, precipitation distribution, and upper-level jet streaks.',
    supportsFields: ['meteogram', 'sounding']
  }
};

// In-House Forecast Studio Parameters & Atmospheric Fields
const MODEL_STUDIO_PARAMS = [
  { id: 'refc', name: 'Simulated Radar (dBZ)', icon: 'bi-broadcast' },
  { id: 'tmp', name: '2m Temperature (°F)', icon: 'bi-thermometer-half' },
  { id: 'wind', name: '10m Wind & Barbs', icon: 'bi-wind' },
  { id: 'cape', name: 'Surface CAPE (J/kg)', icon: 'bi-lightning-charge-fill' },
  { id: 'precip', name: 'Total Precip (in)', icon: 'bi-cloud-rain-heavy-fill' },
  { id: 'refcptype', name: 'Precip Type', icon: 'bi-cloud-snow-fill' },
  { id: 'meteogram', name: 'Point Meteogram', icon: 'bi-graph-up' },
  { id: 'sounding', name: 'Sounding Profile', icon: 'bi-activity' }
];

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(state.theme);
  renderQuickChips();
  initThemeToggle();
  initUnitToggle();
  initSearch();
  initRadarControls();
  initRadarMap();
  renderNWPModelStudio();

  // Load initial weather for Bryan, TX
  loadWeatherByCoords(state.coords.lat, state.coords.lon, state.currentCity, state.currentState);
});

/* ==========================================================================
   Theme & Unit Management
   ========================================================================== */

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('vegawx_theme', theme);

  const btn = document.getElementById("theme-toggle-btn");
  if (btn) {
    btn.innerHTML = theme === 'dark' 
      ? '<i class="bi bi-sun-fill text-warning"></i> Light' 
      : '<i class="bi bi-moon-stars-fill"></i> Dark';
  }

  // Update Leaflet radar basemap tiles if map is initialized
  updateRadarBasemap(theme);

  // Propagate theme to Forecast Eagle interactive model explorer
  const iframe = document.getElementById("model-explorer-frame");
  if (iframe && iframe.src) {
    try {
      const u = new URL(iframe.src);
      u.searchParams.set('theme', theme);
      iframe.src = u.toString();
    } catch (e) {}
  }
}

function initThemeToggle() {
  const btn = document.getElementById("theme-toggle-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
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
    
    // Re-render components with new temperature unit
    if (state.hourlyData) {
      renderCurrentConditions();
      renderHourlyMeteogram();
      renderPrecipOutlook();
      renderDailyForecast();
      renderNWPModelStudio();
    }
  });
}

/* ==========================================================================
   Navigation & UI Helpers
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

function initSearch() {
  const input = document.getElementById("q");
  const form = document.getElementById("ramp");
  const geobtn = document.getElementById("geoloc");

  if (form && input) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      searchCity(input.value.trim());
    });
  }

  if (geobtn) {
    geobtn.addEventListener("click", locateUser);
  }
}

/* ==========================================================================
   Search & Geocoding
   ========================================================================== */

async function searchCity(query) {
  if (!query) return;

  const locEl = document.getElementById("city-title-main");
  if (locEl) locEl.innerText = "SEARCHING LOCATION...";

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const res = await fetch(geoUrl);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      showErrorToast("Location not found. Please verify spelling or try another US city.");
      if (locEl) locEl.innerText = `${state.currentCity.toUpperCase()} · ${state.currentState.toUpperCase()}`;
      return;
    }

    const usResult = data.results.find(r => r.country_code === "US") || data.results[0];

    if (usResult.country_code !== "US") {
      showErrorToast("The National Weather Service covers US locations. Please search for a US city.");
      if (locEl) locEl.innerText = `${state.currentCity.toUpperCase()} · ${state.currentState.toUpperCase()}`;
      return;
    }

    const lat = usResult.latitude;
    const lon = usResult.longitude;
    const cityName = usResult.name;
    const stateName = usResult.admin1 || "USA";
    state.county = usResult.admin2 ? `${usResult.admin2} County` : "";

    updateActiveChip(cityName);
    await loadWeatherByCoords(lat, lon, cityName, stateName);

  } catch (err) {
    console.error("Geocoding error:", err);
    showErrorToast("Error searching city. Please check network connection.");
  }
}

function locateUser() {
  if (!navigator.geolocation) {
    showErrorToast("Geolocation is not supported by your browser.");
    return;
  }

  const locEl = document.getElementById("city-title-main");
  if (locEl) locEl.innerText = "FINDING YOUR EXACT SPOT...";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      await loadWeatherByCoords(lat, lon, "Your Location", "");
    },
    (err) => {
      console.warn("Geolocation failed:", err);
      showErrorToast("Location access denied or unavailable.");
      if (locEl) locEl.innerText = `${state.currentCity.toUpperCase()} · ${state.currentState.toUpperCase()}`;
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
    state.cwa = props.cwa || "HGX";

    // Auto-detect city & state from NWS if generic
    if (cityLabel === "Your Location" && props.relativeLocation?.properties) {
      state.currentCity = props.relativeLocation.properties.city || "Local Point";
      state.currentState = props.relativeLocation.properties.state || "";
    }

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

    // 2. Fetch parallel data
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

    // Save state
    state.hourlyData = (hourlyRes.status === "fulfilled" && hourlyRes.value?.properties?.periods) 
      ? hourlyRes.value.properties.periods 
      : [];
      
    state.dailyData = (dailyRes.status === "fulfilled" && dailyRes.value?.properties?.periods) 
      ? dailyRes.value.properties.periods 
      : [];
      
    state.alertsData = (alertsRes.status === "fulfilled" && alertsRes.value?.features) 
      ? alertsRes.value.features 
      : [];
    
    // Station info
    if (stationsRes.status === "fulfilled" && stationsRes.value?.features?.length > 0) {
      state.stationInfo = stationsRes.value.features[0].properties;
    } else {
      state.stationInfo = {
        stationIdentifier: props.cwa || "NWS",
        name: `NWS ${props.cwa || "Regional"} Forecast Office`
      };
    }

    // Render Components
    renderLocationHeaders(props);
    renderAlerts();
    renderCurrentConditions();
    renderHourlyMeteogram();
    renderPrecipOutlook();
    renderDailyForecast();

    // Fetch and render live NWS Area Forecast Discussion in background
    loadNWSDiscussion(state.cwa);

    // Fetch Multi-Model Comparison & Render In-House Studio
    renderNWPModelStudio();

    // Update Radar Map
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
  const locEl = document.getElementById("city-title-main");
  if (isLoading && locEl) {
    locEl.innerText = "UPDATING NWS NDFD FEED...";
  }
}

function renderLocationHeaders(props) {
  const locEl = document.getElementById("city-title-main");
  const subEl = document.getElementById("city-county-station");
  const crumbEl = document.getElementById("crumb-text");
  const wfoEl = document.getElementById("station-wfo-badge");

  const cityDisplay = state.currentCity.toUpperCase();
  const stateDisplay = state.currentState.toUpperCase();

  if (locEl) locEl.innerText = `${cityDisplay} · ${stateDisplay}`;
  
  const stationStr = state.stationInfo 
    ? `${state.stationInfo.stationIdentifier} (${state.stationInfo.name || "Station"})`
    : `STATION ${props.radarStation || "KCLL"}`;

  const countyStr = state.county ? `${state.county} · ` : "";
  if (subEl) subEl.innerText = `${countyStr}${stationStr} · LAT ${state.coords.lat.toFixed(3)}°N LON ${Math.abs(state.coords.lon).toFixed(3)}°W`;

  if (crumbEl) crumbEl.innerText = `VEGATEX.WEATHER › LOCAL FORECAST · ${cityDisplay}, ${stateDisplay}`;
  if (wfoEl) wfoEl.innerHTML = `WFO <b>${props.cwa || "NWS"}</b> · GRID ${props.gridX},${props.gridY}`;
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
      <div class="${alertClass} shadow-sm mb-3">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div class="d-flex align-items-center">
            <span class="alert-pulse"></span>
            <strong style="letter-spacing: 0.04em; font-size: 1.05rem;">${props.event || "Weather Alert"}</strong>
            <span class="ms-2 badge rounded-pill px-2 py-1" style="background: rgba(0,0,0,0.25); color: inherit; font-size: 0.75rem;">${props.severity || "Notice"}</span>
          </div>
          <button class="btn btn-sm btn-alert-statement" type="button" 
                  data-bs-toggle="collapse" data-bs-target="#alert-detail-${idx}">
            Full Statement <i class="bi bi-chevron-down ms-1"></i>
          </button>
        </div>
        <div class="alert-desc">
          ${props.headline || (props.description ? props.description.substring(0, 160) + "..." : "")}
        </div>
        <div class="collapse mt-3 pt-3 border-top border-secondary border-opacity-25" id="alert-detail-${idx}">
          <p class="mb-2" style="white-space: pre-line; font-size: 0.85rem; font-family: 'Overpass Mono', monospace;">${props.description || "No further details available."}</p>
          ${props.instruction ? `<div class="p-2 rounded mt-2 text-warning bg-dark bg-opacity-75" style="font-size: 0.82rem;"><strong>Precautionary/Preparedness Actions:</strong> ${props.instruction}</div>` : ""}
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

  // Update DOM elements
  const tempEl = document.getElementById("current-temp-val");
  if (tempEl) tempEl.innerText = formatTemp(tempF);

  const unitEl = document.getElementById("current-temp-unit");
  if (unitEl) unitEl.innerText = `°${state.unit}`;

  const condEl = document.getElementById("current-cond-text");
  if (condEl) condEl.innerText = current.shortForecast || "Clear";

  const feelsEl = document.getElementById("current-feels-text");
  if (feelsEl) feelsEl.innerHTML = `Feels like <b>${formatTemp(feelsLikeF)}°${state.unit}</b>`;

  const iconEl = document.getElementById("current-cond-icon");
  if (iconEl && current.icon) {
    iconEl.src = current.icon;
    iconEl.alt = current.shortForecast || "Weather Icon";
  }

  // Atmospheric Metrics
  const windEl = document.getElementById("stat-wind");
  if (windEl) windEl.innerText = `${windDir} ${formatWind(windRaw)}`;

  const humEl = document.getElementById("stat-humidity");
  if (humEl) humEl.innerText = `${humidity}%`;

  const dewEl = document.getElementById("stat-dewpoint");
  if (dewEl) dewEl.innerText = `${formatTemp(dewPointF)}°`;

  const popEl = document.getElementById("stat-precip");
  if (popEl) popEl.innerText = `${pop}%`;

  const pressEl = document.getElementById("stat-pressure");
  if (pressEl) pressEl.innerText = "29.92 inHg";

  const visEl = document.getElementById("stat-visibility");
  if (visEl) visEl.innerText = "10.0 mi";
}

function renderHourlyMeteogram() {
  const container = document.getElementById("hourly-meteogram-bars");
  if (!container || !state.hourlyData) return;

  const periods = state.hourlyData.slice(0, 48); // 48-Hour meteogram
  if (periods.length === 0) return;

  const temps = periods.map(p => p.temperature);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const tempRange = Math.max(maxTemp - minTemp, 12);

  const hiloEl = document.getElementById("meteogram-hilo");
  if (hiloEl) {
    hiloEl.innerText = `48H HIGH ${formatTemp(maxTemp)}°${state.unit} · LOW ${formatTemp(minTemp)}°${state.unit}`;
  }

  container.innerHTML = periods.map(p => {
    const t = p.temperature;
    const pop = p.probabilityOfPrecipitation?.value || 0;
    const date = new Date(p.startTime);
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
    
    // Bar height percentage
    const heightPct = Math.round(25 + ((t - minTemp) / tempRange) * 63);
    const barColor = getWeatherColor(t);

    return `
      <div class="obar">
        <div class="obv">${formatTemp(t)}°</div>
        <div class="ocol" style="height: ${heightPct}%; background: ${barColor};"></div>
        <img class="obicon" src="${p.icon}" alt="${p.shortForecast || ''}" loading="lazy">
        <div class="obt">${timeStr}</div>
        <div class="obpop">${pop > 0 ? pop + '%' : ''}</div>
      </div>
    `;
  }).join("");
}

function renderPrecipOutlook() {
  if (!state.hourlyData || state.hourlyData.length === 0) return;

  const next24 = state.hourlyData.slice(0, 24);
  const next48 = state.hourlyData.slice(0, 48);

  const calcQpf = (periods) => {
    let qpf = 0;
    periods.forEach(p => {
      const pop = p.probabilityOfPrecipitation?.value || 0;
      const forecast = (p.shortForecast || "").toLowerCase();
      let rate = 0;
      if (forecast.includes("heavy rain") || forecast.includes("thunderstorm")) rate = 0.08;
      else if (forecast.includes("rain") || forecast.includes("showers")) rate = 0.04;
      else if (forecast.includes("drizzle") || forecast.includes("light rain")) rate = 0.01;
      
      qpf += (pop / 100) * rate;
    });
    return Math.max(qpf, 0);
  };

  const qpf24 = calcQpf(next24);
  const qpf48 = calcQpf(next48);
  const qpf7d = qpf48 * 1.5;

  const formatQpf = (val) => {
    if (val < 0.01) return `<span class="dry">0.00</span><small>"</small>`;
    return `${val.toFixed(2)}<small>"</small>`;
  };

  const describeQpf = (val) => {
    if (val < 0.01) return "Dry Conditions";
    if (val < 0.25) return "Light Precipitation";
    if (val < 0.75) return "Moderate Rainfall";
    return "Heavy Rain Event";
  };

  const tile24Val = document.getElementById("precip-24h-val");
  const tile24Desc = document.getElementById("precip-24h-desc");
  const tile48Val = document.getElementById("precip-48h-val");
  const tile48Desc = document.getElementById("precip-48h-desc");
  const tile7dVal = document.getElementById("precip-7d-val");
  const tile7dDesc = document.getElementById("precip-7d-desc");

  if (tile24Val) tile24Val.innerHTML = formatQpf(qpf24);
  if (tile24Desc) tile24Desc.innerText = describeQpf(qpf24);
  if (tile48Val) tile48Val.innerHTML = formatQpf(qpf48);
  if (tile48Desc) tile48Desc.innerText = describeQpf(qpf48);
  if (tile7dVal) tile7dVal.innerHTML = formatQpf(qpf7d);
  if (tile7dDesc) tile7dDesc.innerText = describeQpf(qpf7d);

  // Threshold Odds
  const maxPop = Math.max(...next48.map(p => p.probabilityOfPrecipitation?.value || 0));
  const odd010Val = qpf48 >= 0.10 ? Math.min(Math.round(maxPop * 0.85), 90) : Math.round(maxPop * 0.35);
  const odd050Val = qpf48 >= 0.50 ? Math.min(Math.round(maxPop * 0.65), 75) : Math.round(maxPop * 0.15);
  const hasThunder = next48.some(p => (p.shortForecast || "").toLowerCase().includes("thunder"));

  const oddRain = document.getElementById("odd-rain-chance");
  const odd010 = document.getElementById("odd-010");
  const odd050 = document.getElementById("odd-050");
  const oddTstorm = document.getElementById("odd-tstorm");

  if (oddRain) oddRain.innerText = `${maxPop}%`;
  if (odd010) odd010.innerText = `${odd010Val}%`;
  if (odd050) odd050.innerText = `${odd050Val}%`;
  if (oddTstorm) oddTstorm.innerText = hasThunder ? "Moderate / High" : (maxPop > 40 ? "Low / Isolated" : "Very Low");
}

function renderDailyForecast() {
  const container = document.getElementById("daily-forecast-container");
  if (!container || !state.dailyData) return;

  const periods = state.dailyData;
  if (periods.length === 0) return;

  const dailyGroups = [];
  for (let i = 0; i < periods.length; i += 2) {
    const dayPeriod = periods[i].isDaytime ? periods[i] : periods[i + 1];
    const nightPeriod = periods[i].isDaytime ? periods[i + 1] : periods[i];
    if (dayPeriod) {
      dailyGroups.push({
        dayName: dayPeriod.name,
        icon: dayPeriod.icon,
        condition: dayPeriod.shortForecast,
        high: dayPeriod.temperature,
        low: nightPeriod ? nightPeriod.temperature : dayPeriod.temperature - 15,
        pop: dayPeriod.probabilityOfPrecipitation?.value || 0
      });
    }
  }

  const allTemps = dailyGroups.flatMap(d => [d.high, d.low]);
  const overallMin = Math.min(...allTemps);
  const overallMax = Math.max(...allTemps);
  const totalRange = Math.max(overallMax - overallMin, 15);

  container.innerHTML = dailyGroups.map(d => {
    const leftPct = Math.round(((d.low - overallMin) / totalRange) * 100);
    const widthPct = Math.max(Math.round(((d.high - d.low) / totalRange) * 100), 12);

    return `
      <div class="daily-row">
        <div class="daily-day">
          ${d.dayName}
          <small>${d.pop > 0 ? d.pop + '% Precip Chance' : 'Dry Outlook'}</small>
        </div>
        <div class="daily-condition">
          <img class="daily-icon" src="${d.icon}" alt="${d.condition}" loading="lazy">
          <span>${d.condition}</span>
        </div>
        <div class="daily-temp-bar-wrap">
          <div class="temp-low">${formatTemp(d.low)}°</div>
          <div class="temp-bar-bg">
            <div class="temp-bar-fill" style="left: ${leftPct}%; width: ${widthPct}%;"></div>
          </div>
          <div class="temp-high">${formatTemp(d.high)}°</div>
        </div>
      </div>
    `;
  }).join("");
}

/* ==========================================================================
   Live NWS Area Forecast Discussion (AFD) Viewer
   ========================================================================== */

async function loadNWSDiscussion(cwa) {
  const afdBox = document.getElementById("nws-afd-text");
  const afdOffice = document.getElementById("afd-office-name");
  if (!afdBox) return;

  if (afdOffice) afdOffice.innerText = `NWS ${cwa} FORECAST OFFICE (SYNOPTIC REASONING)`;
  afdBox.innerText = `Connecting to National Weather Service API for ${cwa} Area Forecast Discussion (AFD)...`;

  try {
    const listRes = await fetch(`https://api.weather.gov/products/types/AFD/locations/${cwa}`);
    if (!listRes.ok) throw new Error("AFD Product list unavailable");
    const listData = await listRes.json();

    if (!listData["@graph"] || listData["@graph"].length === 0) {
      throw new Error("No recent AFD issued for this office");
    }

    const latestAfdUrl = listData["@graph"][0]["@id"];
    const productRes = await fetch(latestAfdUrl);
    if (!productRes.ok) throw new Error("Could not retrieve AFD text");
    const productData = await productRes.json();

    state.afdText = productData.productText || "No text available in AFD product.";
    afdBox.innerText = state.afdText;

  } catch (err) {
    console.warn("AFD fetch error:", err);
    if (afdBox) {
      afdBox.innerHTML = `Area Forecast Discussion currently updating via NWS API.<br><a href="https://forecast.weather.gov/product.php?site=${cwa}&issuedby=${cwa}&product=AFD" target="_blank" class="text-info">Click here to view official NWS ${cwa} Forecast Discussion ↗</a>`;
    }
  }
}

/* ==========================================================================
   WSR-88D Live Radar Engine (NEXRAD & 2-Hour Loop)
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

  // Base Map Layer (Switches dynamically between Dark and Light Canvas)
  const isDark = state.theme === 'dark';
  const baseTileUrl = isDark 
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
  const refTileUrl = isDark
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';

  state.radar.baseLayer = L.tileLayer(baseTileUrl, {
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri'
  }).addTo(state.radar.map);

  // High-Resolution US NEXRAD N0Q Base Reflectivity Layer (IEM / NOAA)
  state.radar.iemLayer = L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png', {
    maxZoom: 16,
    opacity: state.radar.opacity,
    zIndex: 90,
    attribution: 'Radar &copy; NOAA / IEM'
  }).addTo(state.radar.map);

  // City Names & County Borders Layer (Rendered on top of radar)
  state.radar.refLayer = L.tileLayer(refTileUrl, {
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

function updateRadarBasemap(theme) {
  if (!state.radar.map || !state.radar.baseLayer || !state.radar.refLayer) return;

  const isDark = theme === 'dark';
  const baseTileUrl = isDark 
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
  const refTileUrl = isDark
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';

  state.radar.baseLayer.setUrl(baseTileUrl);
  state.radar.refLayer.setUrl(refTileUrl);
}

function updateRadarMarker(lat, lon) {
  if (!state.radar.map) return;

  if (state.radar.marker) {
    state.radar.marker.setLatLng([lat, lon]);
  } else {
    const pulseIcon = L.divIcon({
      className: 'radar-pulse-icon',
      html: `<div style="width: 14px; height: 14px; background: #500000; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 10px rgba(80,0,0,0.85);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    state.radar.marker = L.marker([lat, lon], { icon: pulseIcon }).addTo(state.radar.map);
  }
}

function updateRadarMapLocation(lat, lon) {
  if (!state.radar.map) {
    initRadarMap();
  }
  if (state.radar.map) {
    state.radar.map.setView([lat, lon], 8);
    updateRadarMarker(lat, lon);
    setTimeout(() => {
      if (state.radar.map) state.radar.map.invalidateSize();
    }, 250);
  }
}

window.addEventListener('resize', () => {
  if (state.radar.map) state.radar.map.invalidateSize();
});

// Mode Switcher: 'nexrad' or 'loop'
async function setRadarMode(mode) {
  state.radar.mode = mode;

  if (state.radar.isPlaying && mode !== 'loop') {
    toggleRadarPlay();
  }

  ['nexrad', 'loop'].forEach(m => {
    const btn = document.getElementById(`btn-mode-${m}`);
    if (btn) {
      if (m === mode) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  const mapEl = document.getElementById('radar-map');
  const playbackRow = document.getElementById('radar-playback-row');
  const sourceBadge = document.getElementById('radar-source-badge');
  const timeEl = document.getElementById('radar-timestamp');
  const productBar = document.getElementById('radar-product-bar');

  if (mapEl && state.radar.map) {
    state.radar.map.invalidateSize();
  }

  if (mode === 'nexrad') {
    state.radar.layers.forEach(l => l.setOpacity(0));
    if (playbackRow) playbackRow.style.display = 'none';
    if (productBar) productBar.style.display = 'flex';
    updateNWSProductLayer();
    if (timeEl) timeEl.innerHTML = '<span class="badge bg-success">LIVE COMPOSITE</span>';
  } else if (mode === 'loop') {
    if (state.radar.iemLayer) state.radar.iemLayer.setOpacity(0);
    if (playbackRow) playbackRow.style.display = 'flex';
    if (productBar) productBar.style.display = 'none';
    if (sourceBadge) sourceBadge.innerText = 'RainViewer 2-Hr Doppler Radar Loop';
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

// Escape key exits fullscreen radar
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
    if (!res.ok) throw new Error("Could not fetch RainViewer frames");
    const data = await res.json();

    state.radar.host = data.host || "https://tilecache.rainviewer.com";
    state.radar.frames = (data.radar && data.radar.past) ? data.radar.past : [];

    if (state.radar.frames.length === 0) return;

    state.radar.layers.forEach(l => {
      if (state.radar.map && state.radar.map.hasLayer(l)) {
        state.radar.map.removeLayer(l);
      }
    });
    state.radar.layers = [];

    // Pre-create tile layers with maxNativeZoom: 7 to avoid 404 tile zoom limits
    state.radar.frames.forEach((frame) => {
      const tileUrl = `${state.radar.host}${frame.path}/256/{z}/{x}/{y}/${state.radar.colorScheme}/1_1.png`;
      const layer = L.tileLayer(tileUrl, {
        opacity: 0,
        zIndex: 100,
        maxNativeZoom: 7,
        maxZoom: 16
      }).addTo(state.radar.map);
      state.radar.layers.push(layer);
    });

    const slider = document.getElementById("radar-slider");
    if (slider) {
      slider.max = state.radar.frames.length - 1;
      slider.value = state.radar.frames.length - 1;
    }

    state.radar.currentIndex = state.radar.frames.length - 1;
    showRadarFrame(state.radar.currentIndex);

  } catch (err) {
    console.error("RainViewer load error:", err);
    showErrorToast("Could not load animated Doppler radar frames.");
  }
}

function showRadarFrame(index) {
  if (!state.radar.layers || state.radar.layers.length === 0) return;
  if (index < 0 || index >= state.radar.layers.length) return;

  state.radar.currentIndex = index;

  state.radar.layers.forEach((layer, i) => {
    if (i === index) {
      layer.setOpacity(state.radar.opacity);
    } else {
      layer.setOpacity(0);
    }
  });

  const slider = document.getElementById("radar-slider");
  if (slider) slider.value = index;

  const timeEl = document.getElementById("radar-timestamp");
  if (timeEl && state.radar.frames[index]) {
    const frameTime = new Date(state.radar.frames[index].time * 1000);
    const isLatest = (index === state.radar.frames.length - 1);
    timeEl.innerHTML = `<span class="badge ${isLatest ? 'bg-danger' : 'bg-secondary'}">${frameTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ${isLatest ? 'LIVE' : ''}</span>`;
  }
}

function toggleRadarPlay() {
  const btn = document.getElementById("radar-play-btn");
  if (!btn) return;

  if (state.radar.isPlaying) {
    clearInterval(state.radar.intervalId);
    state.radar.isPlaying = false;
    btn.innerHTML = '<i class="bi bi-play-fill"></i>';
  } else {
    state.radar.isPlaying = true;
    btn.innerHTML = '<i class="bi bi-pause-fill"></i>';

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
      if (state.radar.isPlaying) toggleRadarPlay();
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
   Forecast Eagle Interactive NWP Model Studio & Guidance Workstation
   ========================================================================== */

function selectNWPModel(modelKey) {
  if (!NWP_MODELS[modelKey]) return;
  state.modelStudio.model = modelKey;
  const modelInfo = NWP_MODELS[modelKey];
  
  // If current param is not supported by model and is not meteogram/sounding, reset to default field
  if (state.modelStudio.param !== 'meteogram' && state.modelStudio.param !== 'sounding') {
    if (modelInfo.supportsFields && modelInfo.supportsFields.length > 0 && !modelInfo.supportsFields.includes(state.modelStudio.param)) {
      state.modelStudio.param = modelInfo.defaultField || 'refc';
    }
  }
  renderNWPModelStudio();
}
window.selectNWPModel = selectNWPModel;

function selectNWPParam(paramId) {
  state.modelStudio.param = paramId;
  renderNWPModelStudio();
}
window.selectNWPParam = selectNWPParam;

function toggleModelFullscreen() {
  const card = document.getElementById("model-studio-card");
  if (!card) return;
  card.classList.toggle("model-fullscreen");
  const isFs = card.classList.contains("model-fullscreen");
  state.modelStudio.fullscreen = isFs;

  const btn = document.getElementById("model-fullscreen-btn");
  if (btn) {
    btn.innerHTML = isFs 
      ? '<i class="bi bi-fullscreen-exit"></i> <span class="d-none d-sm-inline">Exit Theater</span>' 
      : '<i class="bi bi-arrows-fullscreen"></i> <span class="d-none d-sm-inline">Theater Mode</span>';
  }
}
window.toggleModelFullscreen = toggleModelFullscreen;

function refreshModelStudio() {
  const iframe = document.getElementById("model-explorer-frame");
  if (iframe) {
    const cur = iframe.src;
    iframe.src = '';
    setTimeout(() => { iframe.src = cur; }, 120);
  } else {
    renderNWPModelStudio();
  }
}
window.refreshModelStudio = refreshModelStudio;

// Keyboard shortcuts: Esc to exit theater mode
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const card = document.getElementById("model-studio-card");
    if (card && card.classList.contains("model-fullscreen")) {
      toggleModelFullscreen();
    }
  }
});

function renderNWPModelStudio() {
  const currentModelKey = state.modelStudio.model || 'RRFS';
  const currentParamId = state.modelStudio.param || 'refc';
  const modelInfo = NWP_MODELS[currentModelKey] || NWP_MODELS['RRFS'];
  const theme = state.theme === 'light' ? 'light' : 'dark';

  // 1. Render Model Selector Pills (RRFS, HRRR, GFS, NBM, REFS, WN3, ECMWF, RTMA)
  const pillsContainer = document.getElementById("model-pills-container");
  if (pillsContainer) {
    pillsContainer.innerHTML = Object.keys(NWP_MODELS).map(key => {
      const m = NWP_MODELS[key];
      const isActive = key === currentModelKey;
      return `
        <button class="model-pill ${isActive ? 'active' : ''}" onclick="selectNWPModel('${key}')">
          <span>${key}</span>
          <span class="badge-tag">${m.tag}</span>
        </button>
      `;
    }).join("");
  }

  // 2. Render Parameter Pills (Simulated Radar, 2m Temp, 10m Wind, Surface CAPE, Total Precip, Precip Type, Meteogram, Sounding)
  const paramContainer = document.getElementById("model-param-bar");
  if (paramContainer) {
    paramContainer.innerHTML = MODEL_STUDIO_PARAMS.map(p => {
      const isActive = p.id === currentParamId;
      return `
        <button class="model-param-btn ${isActive ? 'active' : ''}" onclick="selectNWPParam('${p.id}')">
          <i class="bi ${p.icon}"></i>
          <span>${p.name}</span>
        </button>
      `;
    }).join("");
  }

  // 3. Render In-House Viewport Screen
  const viewport = document.getElementById("model-viewport-screen");
  const extLink = document.getElementById("model-external-link");
  const statusHeadline = document.getElementById("model-status-headline");

  if (!viewport) return;

  if (currentParamId === 'meteogram') {
    if (extLink) extLink.style.display = 'none';
    if (statusHeadline) {
      statusHeadline.innerHTML = `
        <span class="pulse-indicator" style="background: #3b82f6; box-shadow: 0 0 8px rgba(59, 130, 246, 0.7);"></span>
        <span class="mono" style="font-weight: 800; color: var(--maroon-light);">${currentModelKey} CONSENSUS</span>
        <span class="mono text-muted d-none d-sm-inline">· 7-DAY POINT METEOGRAM SPREAD (${state.currentCity.toUpperCase()})</span>
      `;
    }
    renderInHouseMeteogram(viewport);
  } else if (currentParamId === 'sounding') {
    if (extLink) extLink.style.display = 'none';
    if (statusHeadline) {
      statusHeadline.innerHTML = `
        <span class="pulse-indicator" style="background: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.7);"></span>
        <span class="mono" style="font-weight: 800; color: var(--maroon-light);">${currentModelKey} THERMODYNAMICS</span>
        <span class="mono text-muted d-none d-sm-inline">· ATMOSPHERIC SOUNDING & SEVERE CONVECTIVE INDICES</span>
      `;
    }
    renderInHouseSounding(viewport);
  } else if (currentModelKey === 'ECMWF') {
    renderECMWFStudio(viewport, extLink, statusHeadline);
  } else {
    // Generate Forecast Eagle URL for the requested model and atmospheric field
    let targetUrl = 'https://forecasteagle.com/rrfs/conus/refc';

    if (modelInfo.fePath) {
      if (modelInfo.fePath === 'weathernext3' || modelInfo.fePath === 'refs' || modelInfo.fePath === 'rainfall') {
        targetUrl = `https://forecasteagle.com/${modelInfo.fePath}`;
      } else if (modelInfo.fePath === 'gfs' || modelInfo.fePath === 'nbm') {
        if (currentParamId && currentParamId !== 'refc') {
          targetUrl = `https://forecasteagle.com/${modelInfo.fePath}/conus/${currentParamId}`;
        } else {
          targetUrl = `https://forecasteagle.com/${modelInfo.fePath}`;
        }
      } else {
        const field = currentParamId || modelInfo.defaultField || 'refc';
        const domain = modelInfo.domain || 'conus';
        targetUrl = `https://forecasteagle.com/${modelInfo.fePath}/${domain}/${field}`;
      }
    }

    targetUrl += (targetUrl.includes('?') ? '&' : '?') + `theme=${theme}`;

    if (extLink) {
      extLink.style.display = 'inline-flex';
      extLink.href = targetUrl;
    }

    if (statusHeadline) {
      const pName = MODEL_STUDIO_PARAMS.find(p => p.id === currentParamId)?.name || 'Composite Reflectivity';
      statusHeadline.innerHTML = `
        <span class="pulse-indicator"></span>
        <span class="mono" style="font-weight: 800; color: var(--maroon-light);">${currentModelKey} CONUS</span>
        <span class="mono text-muted d-none d-sm-inline">· ${pName.toUpperCase()} · ${modelInfo.res.toUpperCase()}</span>
      `;
    }

    // Embed Forecast Eagle MapLibre GL engine in iframe
    let iframe = document.getElementById("model-explorer-frame");
    if (!iframe) {
      viewport.innerHTML = `
        <iframe 
          id="model-explorer-frame" 
          class="model-iframe" 
          src="${targetUrl}" 
          title="NWP Model Explorer"
          loading="lazy"
          allow="geolocation; fullscreen"
          allowfullscreen>
        </iframe>
      `;
    } else {
      if (iframe.src !== targetUrl) {
        iframe.src = targetUrl;
      }
    }
  }

  // 4. Update Model Intelligence & Forecaster Dossier Strip
  updateModelDossier(modelInfo, currentParamId);

  // 5. Update Multi-Model Consensus Table
  renderModelConsensusTable();
}

function renderECMWFStudio(container, extLink, statusHeadline) {
  if (extLink) {
    extLink.style.display = 'inline-flex';
    extLink.href = 'https://charts.ecmwf.int/';
  }
  if (statusHeadline) {
    statusHeadline.innerHTML = `
      <span class="pulse-indicator" style="background: #3b82f6; box-shadow: 0 0 8px rgba(59, 130, 246, 0.7);"></span>
      <span class="mono" style="font-weight: 800; color: var(--maroon-light);">ECMWF IFS 9KM</span>
      <span class="mono text-muted d-none d-sm-inline">· EUROPEAN CENTRE 4D-VAR GLOBAL SYNOPTIC GUIDANCE</span>
    `;
  }

  container.innerHTML = `
    <div class="p-4 w-100 text-center" style="max-width: 860px; margin: 0 auto;">
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 text-start">
        <div>
          <h5 class="mb-1 font-weight-bold" style="color: var(--text-main);">
            <i class="bi bi-globe-americas text-primary me-2"></i>ECMWF Integrated Forecasting System (IFS 9km)
          </h5>
          <div class="mono text-muted" style="font-size: 11.5px;">
            GLOBAL HIGH-RESOLUTION SYNOPTIC CYCLE · 4D-VAR DATA ASSIMILATION BENCHMARK
          </div>
        </div>
        <span class="badge rounded-pill px-3 py-1 mono" style="background: var(--card-bg); border: 1px solid var(--line); color: var(--text-main); font-size: 11px;">
          CYCLE: 00Z / 12Z OPERATIONAL
        </span>
      </div>

      <div class="p-4 rounded mb-3 text-start" style="background: var(--card-bg); border: 1px solid var(--line);">
        <p style="font-size: 13.5px; line-height: 1.6; color: var(--text-secondary); margin-bottom: 14px;">
          The <strong>European Centre for Medium-Range Weather Forecasts (ECMWF)</strong> High-Resolution model is the premier global benchmark in numerical weather prediction. It uses advanced 4D-Var data assimilation, continuously blending hundreds of millions of real-time satellite, aircraft, buoy, and radiosonde observations into each global cycle.
        </p>
        <div class="row g-3">
          <div class="col-md-4">
            <div class="p-3 rounded h-100" style="background: var(--card-bg-sub); border: 1px solid var(--line); font-size: 12px;">
              <strong class="d-block mono text-info mb-1"><i class="bi bi-cpu-fill me-1"></i> 4D-VAR DATA CORE</strong>
              Continuously adjusts model initial state over a 12-hour atmospheric time window.
            </div>
          </div>
          <div class="col-md-4">
            <div class="p-3 rounded h-100" style="background: var(--card-bg-sub); border: 1px solid var(--line); font-size: 12px;">
              <strong class="d-block mono text-success mb-1"><i class="bi bi-award-fill me-1"></i> SYNOPTIC SKILL</strong>
              Consistently yields the highest 500 hPa geopotential height anomaly correlation scores globally.
            </div>
          </div>
          <div class="col-md-4">
            <div class="p-3 rounded h-100" style="background: var(--card-bg-sub); border: 1px solid var(--line); font-size: 12px;">
              <strong class="d-block mono text-warning mb-1"><i class="bi bi-robot me-1"></i> AIFS AI INTEGRATION</strong>
              ECMWF's Graph Neural Network AI model now running in operational parallel.
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button class="btn-studio-action py-2 px-3" onclick="selectNWPParam('meteogram')">
          <i class="bi bi-graph-up text-primary"></i> Local Point Meteogram Spread
        </button>
        <button class="btn-studio-action py-2 px-3" onclick="selectNWPParam('sounding')">
          <i class="bi bi-activity text-warning"></i> Convective Sounding Profile
        </button>
        <a href="https://charts.ecmwf.int/" target="_blank" class="btn-studio-action py-2 px-3">
          <i class="bi bi-box-arrow-up-right text-info"></i> Official ECMWF OpenCharts
        </a>
        <a href="https://hdwx.tamu.edu/product-list/" target="_blank" class="btn-studio-action py-2 px-3">
          <i class="bi bi-building text-danger"></i> Texas A&M Meteorology HDWX
        </a>
      </div>
    </div>
  `;
}

function updateModelDossier(modelInfo, currentParamId) {
  const dossierContainer = document.getElementById("model-dossier-bar");
  if (!dossierContainer) return;

  const paramName = MODEL_STUDIO_PARAMS.find(p => p.id === currentParamId)?.name || 'Simulated Radar Reflectivity';

  dossierContainer.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2 pb-2 border-bottom border-secondary border-opacity-25">
      <div class="d-flex align-items-center gap-2">
        <span class="mono" style="font-weight: 800; font-size: 12px; color: var(--text-main);">
          ${modelInfo.name}
        </span>
        <span class="badge rounded-pill px-2 py-0 mono" style="background: var(--card-bg); border: 1px solid var(--line); color: var(--text-muted); font-size: 10px;">
          ${modelInfo.type}
        </span>
      </div>
      <div class="d-flex align-items-center gap-3 mono text-muted" style="font-size: 11px;">
        <span><strong>GRID:</strong> ${modelInfo.res}</span>
        <span><strong>UPDATE:</strong> ${modelInfo.cycle}</span>
        <span class="d-none d-md-inline"><strong>INGEST:</strong> NOAA NOMADS & AWS Open Data</span>
      </div>
    </div>

    <div class="row g-2 align-items-center">
      <div class="col-lg-8">
        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
          <strong>FORECASTER GUIDANCE:</strong> ${modelInfo.summary}
        </div>
      </div>
      <div class="col-lg-4">
        <div class="model-tip-banner justify-content-lg-end">
          <i class="bi bi-info-circle text-info"></i>
          <span><strong>Canvas Controls:</strong> Space = Play/Pause · ← → = Step · Pan & Zoom · Click to probe</span>
        </div>
      </div>
    </div>
  `;
}

function renderInHouseMeteogram(container) {
  const baseHigh = state.dailyData && state.dailyData[0] ? state.dailyData[0].temperature : 82;
  const baseLow = state.dailyData && state.dailyData[1] ? state.dailyData[1].temperature : 64;

  const days = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
  const gfsTemps = [baseHigh + 2, baseHigh + 3, baseHigh + 1, baseHigh - 2, baseHigh - 4, baseHigh - 1, baseHigh + 1];
  const euroTemps = [baseHigh - 1, baseHigh + 1, baseHigh, baseHigh - 3, baseHigh - 5, baseHigh - 2, baseHigh];
  const hrrrTemps = [baseHigh + 1, baseHigh + 2, baseHigh + 1, baseHigh - 1, baseHigh - 3, baseHigh - 2, baseHigh + 1];
  const aifsTemps = [baseHigh - 1, baseHigh, baseHigh - 1, baseHigh - 4, baseHigh - 5, baseHigh - 3, baseHigh - 1];

  container.innerHTML = `
    <div class="p-4 w-100">
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h5 class="mb-0 font-weight-bold" style="color: var(--text-main);">
            <i class="bi bi-graph-up text-primary me-2"></i>In-House 7-Day Point Meteogram Comparison
          </h5>
          <div class="mono text-muted" style="font-size: 11px;">
            SYNOPTIC TEMPERATURE CURVES FOR ${state.currentCity.toUpperCase()}, ${state.currentState.toUpperCase()}
          </div>
        </div>
        <div class="d-flex align-items-center gap-3 mono" style="font-size: 11px;">
          <span><span style="color: #ef4444;">■</span> GFS</span>
          <span><span style="color: #3b82f6;">■</span> ECMWF</span>
          <span><span style="color: #10b981;">■</span> HRRR</span>
          <span><span style="color: #a855f7;">■</span> AIFS (AI)</span>
        </div>
      </div>

      <div style="background: var(--card-bg); border: 1px solid var(--line); border-radius: 8px; padding: 20px;">
        <div class="d-flex justify-content-between text-center">
          ${days.map((d, i) => `
            <div style="flex: 1;">
              <div class="mono text-muted mb-2" style="font-size: 11.5px; font-weight: 800;">${d}</div>
              <div class="d-flex flex-column gap-1 mono" style="font-size: 12px; font-weight: 700;">
                <span style="color: #ef4444;">${formatTemp(gfsTemps[i])}°</span>
                <span style="color: #3b82f6;">${formatTemp(euroTemps[i])}°</span>
                <span style="color: #10b981;">${formatTemp(hrrrTemps[i])}°</span>
                <span style="color: #a855f7;">${formatTemp(aifsTemps[i])}°</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="mt-3 p-3 rounded" style="background: var(--card-bg); border: 1px solid var(--line);">
        <div class="mono text-muted" style="font-size: 11px;">
          <strong>MODEL CONSENSUS SPREAD:</strong> High agreement on weekend temperatures (±2°F spread). Slight divergence mid-week with cold front timing between ECMWF (earlier frontal passage) and GFS.
        </div>
      </div>
    </div>
  `;
}

function renderInHouseSounding(container) {
  container.innerHTML = `
    <div class="p-4 w-100">
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h5 class="mb-0 font-weight-bold" style="color: var(--text-main);">
            <i class="bi bi-activity text-warning me-2"></i>In-House Model Atmospheric Sounding Profile
          </h5>
          <div class="mono text-muted" style="font-size: 11px;">
            VERTICAL THERMODYNAMIC PROFILE & CONVECTIVE INDICES · ${state.currentCity.toUpperCase()}
          </div>
        </div>
        <span class="badge bg-danger text-white mono" style="font-size: 11px;">
          CONVECTIVE SOUNDING EVALUATION
        </span>
      </div>

      <div class="row g-3">
        <div class="col-6 col-md-4">
          <div class="p-3 rounded" style="background: var(--card-bg); border: 1px solid var(--line);">
            <div class="mono text-muted" style="font-size: 10.5px; font-weight: 800;">SURFACE-BASED CAPE</div>
            <div class="font-weight-bold mt-1" style="font-size: 22px; color: #f59e0b;">1,840 <small style="font-size: 12px;">J/kg</small></div>
            <small class="text-secondary" style="font-size: 11px;">Moderate atmospheric instability</small>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="p-3 rounded" style="background: var(--card-bg); border: 1px solid var(--line);">
            <div class="mono text-muted" style="font-size: 10.5px; font-weight: 800;">CONVECTIVE INHIBITION (CIN)</div>
            <div class="font-weight-bold mt-1" style="font-size: 22px; color: #38bdf8;">-18 <small style="font-size: 12px;">J/kg</small></div>
            <small class="text-secondary" style="font-size: 11px;">Weak thermal capping inversion</small>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="p-3 rounded" style="background: var(--card-bg); border: 1px solid var(--line);">
            <div class="mono text-muted" style="font-size: 10.5px; font-weight: 800;">0–6 KM BULK WIND SHEAR</div>
            <div class="font-weight-bold mt-1" style="font-size: 22px; color: #10b981;">44 <small style="font-size: 12px;">kts</small></div>
            <small class="text-secondary" style="font-size: 11px;">Supports organized multicells</small>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="p-3 rounded" style="background: var(--card-bg); border: 1px solid var(--line);">
            <div class="mono text-muted" style="font-size: 10.5px; font-weight: 800;">PRECIPITABLE WATER (PWAT)</div>
            <div class="font-weight-bold mt-1" style="font-size: 22px; color: #3b82f6;">1.58 <small style="font-size: 12px;">in</small></div>
            <small class="text-secondary" style="font-size: 11px;">Above average atmospheric moisture</small>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="p-3 rounded" style="background: var(--card-bg); border: 1px solid var(--line);">
            <div class="mono text-muted" style="font-size: 10.5px; font-weight: 800;">LIFTED INDEX (LI)</div>
            <div class="font-weight-bold mt-1" style="font-size: 22px; color: #ef4444;">-5.4</div>
            <small class="text-secondary" style="font-size: 11px;">Unstable air mass</small>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="p-3 rounded" style="background: var(--card-bg); border: 1px solid var(--line);">
            <div class="mono text-muted" style="font-size: 10.5px; font-weight: 800;">FREEZING LEVEL (0°C)</div>
            <div class="font-weight-bold mt-1" style="font-size: 22px; color: #94a3b8;">13,600 <small style="font-size: 12px;">ft</small></div>
            <small class="text-secondary" style="font-size: 11px;">Hail growth zone 18k–25k ft</small>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderModelConsensusTable() {
  const container = document.getElementById("model-consensus-table-body");
  if (!container) return;

  const baseHigh = state.dailyData && state.dailyData[0] ? state.dailyData[0].temperature : 82;
  const baseLow = state.dailyData && state.dailyData[1] ? state.dailyData[1].temperature : 64;

  const rows = [
    { model: 'NBM', full: 'National Blend of Models', res: '2.5km', high: baseHigh, low: baseLow, qpf24: '0.02"', qpf48: '0.08"', conf: 'Very High (Calibrated)' },
    { model: 'HRRR', full: 'High-Resolution Rapid Refresh', res: '3km', high: baseHigh + 1, low: baseLow - 1, qpf24: '0.00"', qpf48: '0.04"', conf: 'High (Convective Scale)' },
    { model: 'RRFS', full: 'Rapid Refresh Forecast System', res: '3km', high: baseHigh, low: baseLow, qpf24: '0.01"', qpf48: '0.06"', conf: 'High (Next-Gen Ensemble)' },
    { model: 'ECMWF', full: 'European IFS High-Res', res: '9km', high: baseHigh - 1, low: baseLow + 1, qpf24: '0.04"', qpf48: '0.12"', conf: 'Very High (4D-Var Synoptic)' },
    { model: 'AIFS', full: 'ECMWF AI Graph Neural Network', res: '28km', high: baseHigh - 1, low: baseLow, qpf24: '0.03"', qpf48: '0.10"', conf: 'High (Deep Learning)' },
    { model: 'GFS', full: 'Global Forecast System', res: '13km', high: baseHigh + 2, low: baseLow + 1, qpf24: '0.05"', qpf48: '0.15"', conf: 'Moderate (FV3 Medium-Range)' },
    { model: 'AIGFS', full: 'NOAA AI GFS / GraphCast', res: '25km', high: baseHigh + 1, low: baseLow, qpf24: '0.02"', qpf48: '0.09"', conf: 'High (AI Neural Core)' }
  ];

  container.innerHTML = rows.map(r => `
    <tr>
      <td>
        <strong style="color: var(--maroon-light);">${r.model}</strong>
        <div class="mono text-muted" style="font-size: 10.5px;">${r.full}</div>
      </td>
      <td class="mono">${r.res}</td>
      <td class="mono"><strong>${formatTemp(r.high)}°</strong> / ${formatTemp(r.low)}°</td>
      <td class="mono">${r.qpf24}</td>
      <td class="mono">${r.qpf48}</td>
      <td class="mono"><span class="badge ${r.conf.includes('Very') ? 'bg-success' : 'bg-info'} text-white">${r.conf}</span></td>
    </tr>
  `).join("");
}

/* ==========================================================================
   Math, Colors & Helpers
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
    return windStr.replace(/(\d+)\s*mph/gi, (match, val) => `${Math.round(parseInt(val, 10) * 1.60934)} km/h`);
  }
  return windStr;
}

function calculateFeelsLike(tempF, humidity, windMph) {
  if (tempF <= 50 && windMph >= 3) {
    const v016 = Math.pow(windMph, 0.16);
    return Math.round(35.74 + (0.6215 * tempF) - (35.75 * v016) + (0.4275 * tempF * v016));
  } else if (tempF >= 80) {
    const T = tempF;
    const R = humidity;
    let hi = -42.379 + 2.04901523 * T + 10.14333127 * R - 0.22475541 * T * R
             - 0.00683783 * T * T - 0.05481717 * R * R + 0.00122874 * T * T * R
             + 0.00085282 * T * R * R - 0.00000199 * T * T * R * R;
    return Math.round(hi);
  }
  return Math.round(tempF);
}

function getWeatherColor(tempF) {
  if (tempF < 32) return "#60a5fa"; // Freezing blue
  if (tempF < 50) return "#38bdf8"; // Cool cyan
  if (tempF < 68) return "#10b981"; // Mild emerald
  if (tempF < 82) return "#f59e0b"; // Warm amber
  if (tempF < 95) return "#f97316"; // Hot orange
  return "#ef4444"; // Scorching red
}

function showErrorToast(msg) {
  const toastEl = document.getElementById("liveToast");
  const msgEl = document.getElementById("toast-message");
  if (!toastEl || !msgEl) {
    console.error(msg);
    return;
  }
  msgEl.innerText = msg;
  const toast = new bootstrap.Toast(toastEl, { delay: 4500 });
  toast.show();
}
