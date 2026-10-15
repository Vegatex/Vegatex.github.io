# VegaWx | Live Weather Dashboard & Doppler Radar

A modern, responsive US weather dashboard powered by the **National Weather Service (NWS)**, **RainViewer Radar API**, and **Open-Meteo Geocoding**.

Hosted live on GitHub Pages: **[vegatex.github.io](https://vegatex.github.io)**

---

## Features

- **Live Doppler Radar**:
  - Interactive Leaflet map on a high-contrast CartoDB Dark Matter basemap.
  - Animated radar reflectivity loop powered by the RainViewer API.
  - Interactive controls: Play / Pause, timeline scrubber, opacity slider, and radar color palette options (NEXRAD Level III, Universal Blue, Smooth Rainbow, Classic).
- **Severe Weather Alerts**:
  - Live active alerts (Watches, Warnings, Advisories) fetched directly from NWS alerts API.
  - Severity-coded banners with expandable precautionary actions and detailed meteorologist statements.
- **Current Conditions**:
  - Live temperature, condition icon, daily high/low, and dynamic nearest observation station identifier.
  - 6-metric atmospheric grid: Feels Like (Heat Index & Wind Chill formulas), Wind Speed & Direction, Humidity, Dew Point, and Rain Probability.
- **24-Hour Hourly Forecast**:
  - Smooth horizontal scrolling carousel showing temperature trend, weather icons, rain chance %, and wind speed for each hour.
- **7-Day Weather Outlook**:
  - Multi-day forecast with conditions summary, weather icons, and visual temperature range bars.
- **Location & Search**:
  - Instant city and ZIP code search with US geocoding.
  - 1-click **GPS Geolocation** ("Locate Me").
  - Quick-pick city chips for instant navigation.
  - **°F / °C Unit Toggle** with persistent preference saved to local storage.
- **Meteorological Info**:
  - Forecast Office identifier, grid coordinates, and direct links to official NWS Area Forecast Discussions (AFD).

---

## APIs & Libraries

- **Forecast & Alerts**: [National Weather Service API (api.weather.gov)](https://www.weather.gov/documentation/services-web-api)
- **Radar Imagery**: [RainViewer API](https://www.rainviewer.com/api.html)
- **Geocoding**: [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- **Mapping**: [Leaflet.js](https://leafletjs.com/) with CartoDB Dark Matter tiles
- **Styling**: [Bootstrap 5.3](https://getbootstrap.com/) and [Bootstrap Icons](https://icons.getbootstrap.com/)