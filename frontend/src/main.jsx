import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const API = "http://localhost:3001";
const accounts = {
  admin: { password: "admin123", role: "guard" },
  F001: { password: "fish123", role: "fisherman", boatId: "BOAT001" },
  F002: { password: "fish123", role: "fisherman", boatId: "BOAT002" },
  F003: { password: "fish123", role: "fisherman", boatId: "BOAT003" }
};
const initialBoatDisplay = [
  { boatId: "BOAT001", fishermanId: "F001", latitude: 9.02, longitude: 79.62, speed: 12, engineStatus: "ON", gpsStatus: "CONNECTED", batteryLevel: 92, journeyStatus: "ACTIVE", boundaryStatus: "SAFE", boundaryDistanceKm: 20, history: [[9.02, 79.62]] },
  { boatId: "BOAT002", fishermanId: "F002", latitude: 9.08, longitude: 79.48, speed: 12, engineStatus: "ON", gpsStatus: "CONNECTED", batteryLevel: 84, journeyStatus: "ACTIVE", boundaryStatus: "SAFE", boundaryDistanceKm: 24, history: [[9.08, 79.48]] },
  { boatId: "BOAT003", fishermanId: "F003", latitude: 9.04, longitude: 79.38, speed: 12, engineStatus: "ON", gpsStatus: "CONNECTED", batteryLevel: 76, journeyStatus: "ACTIVE", boundaryStatus: "SAFE", boundaryDistanceKm: 30, history: [[9.04, 79.38]] }
];

function Login({ onLogin }) {
  const [role, setRole] = useState("guard");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  function chooseRole(nextRole) {
    setRole(nextRole);
    setUsername(nextRole === "guard" ? "admin" : "F001");
    setPassword(nextRole === "guard" ? "admin123" : "fish123");
    setError("");
  }
  function submit(event) {
    event.preventDefault();
    const account = accounts[username];
    if (!account || account.role !== role || account.password !== password) return setError("Use the credentials shown for the selected portal.");
    onLogin({ username, ...account });
  }
  return <main className="login"><div className="login-card"><p className="eyebrow">COASTAL SAFETY NETWORK</p><h1>MEENAVAN</h1><p>Smart fishermen safety and coastal communication system</p><div className="login-options"><button className={role === "guard" ? "selected" : ""} onClick={() => chooseRole("guard")}>COASTAL GUARD LOGIN<small>Monitor every vessel</small></button><button className={role === "fisherman" ? "selected" : ""} onClick={() => chooseRole("fisherman")}>FISHERMAN LOGIN<small>View assigned boat only</small></button></div><form onSubmit={submit}><label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="error">{error}</div>}<button>Sign in securely</button></form><small>Guard: admin / admin123 · Fishermen: F001, F002, F003 / fish123</small></div></main>;
}

function BoatMap({ boats, selectedId, onSelect }) {
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const pathRef = useRef(null);
  const [leaflet, setLeaflet] = useState(null);
  useEffect(() => {
    import("leaflet").then(({ default: L }) => {
      const map = L.map(mapRef.current).setView([9.22, 79.57], 9);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
      L.polygon([[8.95, 78.9], [9.58, 78.9], [9.58, 79.28], [8.95, 79.28]], { color: "#2f80ed", fillColor: "#2f80ed", fillOpacity: 0.08 }).addTo(map).bindTooltip("Indian side · Tamil Nadu / Rameswaram");
      L.polygon([[8.7, 79.85], [9.58, 79.85], [9.58, 80.4], [8.7, 80.4]], { color: "#9b51e0", fillColor: "#9b51e0", fillOpacity: 0.08 }).addTo(map).bindTooltip("Sri Lankan side · Northern Sri Lanka");
      L.polygon([[8.95, 79.52], [9.48, 79.35], [9.55, 79.72], [9.02, 79.82]], { color: "#f4b942", fillColor: "#f4b942", fillOpacity: 0.1, dashArray: "5 5" }).addTo(map).bindTooltip("Warning zone · illustrative prototype geofence");
      L.polyline([[8.88, 79.85], [9.05, 79.76], [9.18, 79.68], [9.33, 79.57], [9.5, 79.43]], { color: "#ef476f", weight: 3, dashArray: "9 7" }).addTo(map).bindTooltip("India–Sri Lanka boundary · illustrative configurable prototype line");
      layerRef.current = L.layerGroup().addTo(map);
      pathRef.current = L.layerGroup().addTo(map);
      mapRef.current._leaflet = map;
      setLeaflet(L);
      return () => map.remove();
    });
  }, []);
  useEffect(() => {
    if (!leaflet || !mapRef.current?._leaflet) return;
    const map = mapRef.current._leaflet;
    layerRef.current.clearLayers();
    pathRef.current.clearLayers();
    const mapBoats = boats.length ? boats : initialBoatDisplay;
    mapBoats.forEach((boat) => {
      const color = boat.boundaryStatus === "CRITICAL" ? "#ef476f" : boat.boundaryStatus === "WARNING" ? "#f4b942" : "#20c997";
      const body = leaflet.circleMarker([boat.latitude, boat.longitude], { radius: boat.boatId === selectedId ? 13 : 10, color: "#06131f", weight: 3, fillColor: color, fillOpacity: 1 }).addTo(layerRef.current);
      body.bindTooltip(`${boat.boatId} · ${boat.boundaryStatus}`, { direction: "top", offset: [0, -10] });
      body.on("click", () => onSelect(boat.boatId));
      const icon = leaflet.divIcon({ className: `boat-icon ${boat.boatId === selectedId ? "selected" : ""}`, html: `<span style="color:${color}">⛵</span><b>${boat.boatId}</b>`, iconSize: [92, 38], iconAnchor: [14, 18] });
      const marker = leaflet.marker([boat.latitude, boat.longitude], { icon }).addTo(layerRef.current);
      marker.bindPopup(`<strong>BOAT INFORMATION</strong><br>Boat ID: ${boat.boatId}<br>Fisherman ID: ${boat.fishermanId}<br>Latitude: ${boat.latitude.toFixed(6)}<br>Longitude: ${boat.longitude.toFixed(6)}<br>Speed: ${boat.speed} km/h<br>Engine: ${boat.engineStatus}<br>GPS: ${boat.gpsStatus}<br>Battery: ${boat.batteryLevel}%<br>Boundary: ${boat.boundaryStatus}<br>Last updated: ${new Date(boat.timestamp).toLocaleTimeString()}`);
      marker.on("click", () => onSelect(boat.boatId));
      leaflet.polyline(boat.history, { color, weight: boat.boatId === selectedId ? 5 : 2, opacity: boat.boatId === selectedId ? 0.9 : 0.35 }).addTo(pathRef.current);
    });
    if (mapBoats.length) map.fitBounds(leaflet.latLngBounds(mapBoats.map((boat) => [boat.latitude, boat.longitude])), { padding: [35, 35], maxZoom: 10 });
    map.invalidateSize();
  }, [boats, selectedId, onSelect, leaflet]);
  return <div ref={mapRef} className="map" />;
}

function BoatDetails({ boat }) {
  if (!boat) return <section className="panel"><p className="muted">Select a boat to inspect live telemetry.</p></section>;
  const details = [["Boat ID", boat.boatId], ["Fisherman ID", boat.fishermanId], ["Latitude", boat.latitude.toFixed(6)], ["Longitude", boat.longitude.toFixed(6)], ["Speed", `${boat.speed} km/h`], ["Engine", boat.engineStatus], ["GPS", boat.gpsStatus], ["Battery", `${boat.batteryLevel}%`], ["Journey", boat.journeyStatus], ["Boundary", boat.boundaryStatus]];
  return <section className="panel details"><div className="panel-heading"><h2>{boat.boatId}</h2><span className={`status ${boat.boundaryStatus.toLowerCase()}`}>{boat.boundaryStatus}</span></div><div className="metric-grid">{details.map(([label, value]) => <div className="metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><p className="muted">Boundary distance: {boat.boundaryDistanceKm} km · Updated: {new Date(boat.timestamp).toLocaleTimeString()}</p></section>;
}

function mergeAlerts(current, incoming) {
  const merged = [...incoming, ...current];
  return Array.from(new Map(merged.map((alert) => [alert.id, alert])).values()).slice(0, 500);
}

function BigDataAnalytics({ onBack }) {
  const [boats, setBoats] = useState(initialBoatDisplay);
  const [selectedBoatId, setSelectedBoatId] = useState("BOAT001");
  const [tab, setTab] = useState("overview");
  const [status, setStatus] = useState({ status: "IDLE" });
  const [metrics, setMetrics] = useState({});
  const [visuals, setVisuals] = useState({ boats: [], boundaries: [] });
  const [anomalies, setAnomalies] = useState([]);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [demoAction, setDemoAction] = useState("towards");
  const [weather, setWeather] = useState({ title: "Heavy Rain Warning", condition: "Heavy rain and strong winds", severity: "HIGH", description: "Strong winds and heavy rainfall are expected.", region: "Palk Strait", instructions: "Return to shore immediately." });
  useEffect(() => {
    fetch(`${API}/api/boats`).then((response) => response.json()).then(setBoats);
    const socket = io(API);
    socket.emit("authenticate", { role: "guard", fishermanId: "admin" });
    socket.on("boats:initial", setBoats);
    socket.on("boat:update", (boat) => setBoats((items) => items.map((item) => item.boatId === boat.boatId ? boat : item)));
    return () => socket.disconnect();
  }, []);
  async function refresh() {
    const responses = await Promise.all(["status", "metrics", "visualizations", "anomalies", "logs", "results"].map((path) => fetch(`${API}/api/analytics/${path}`).then((response) => response.json())));
    setStatus(responses[0]); setMetrics(responses[1]); setVisuals(responses[2]); setAnomalies(responses[3]); setLogs(responses[4].logs || []); setResults(responses[5]);
  }
  useEffect(() => { refresh(); const timer = setInterval(refresh, 3000); return () => clearInterval(timer); }, []);
  async function start(path, message) {
    const response = await fetch(`${API}/api/analytics/${path}`, { method: "POST" });
    if (!response.ok) { setError((await response.json()).error || "Unable to start Spark."); return; }
    setError(message);
    refresh();
  }
  async function applySimulation(boatId = selectedBoatId) {
    if (!boatId) return;
    const response = await fetch(`${API}/api/simulation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boatId, action: demoAction }) });
    if (response.ok) {
      const updatedBoat = await response.json();
      setBoats((items) => items.map((item) => item.boatId === updatedBoat.boatId ? updatedBoat : item));
      setSelectedBoatId(updatedBoat.boatId);
      setError(`${demoAction} applied to ${updatedBoat.boatId}. ${updatedBoat.boundaryStatus} at ${updatedBoat.latitude.toFixed(5)}, ${updatedBoat.longitude.toFixed(5)}`);
      return;
    }
    const body = await response.json().catch(() => ({}));
    setError(body.error || `Simulation failed for ${boatId}.`);
  }
  async function sendWeather(event) {
    event.preventDefault();
    const response = await fetch(`${API}/api/weather-alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(weather) });
    setError(response.ok ? "Weather alert broadcast to fishermen." : "Complete every weather alert field.");
  }
  async function downloadResult(name) {
    try {
      const endpoint = name === "meenavan-results.zip"
        ? `${API}/api/analytics/download-all`
        : `${API}/api/analytics/download/${encodeURIComponent(name)}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || `Unable to download ${name}.`);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name === "meenavan-results.zip"
        ? name
        : name.includes("summary") ? "analytics_summary.json" : `${name.replace(/\.csv$/, "")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(`Unable to download ${name}. Check that the backend is running.`);
    }
  }
  const cards = [["Total GPS Records", metrics.totalInputRecords ?? "—"], ["Boats Monitored", metrics.totalBoats ?? "—"], ["Valid Records", metrics.validRecords ?? "—"], ["Warning Events", metrics.totalBorderEvents ?? "—"], ["SOS Events", metrics.totalSosEvents ?? "—"], ["Invalid Records", metrics.invalidRecords ?? "—"], ["Total Distance", `${metrics.totalDistance ?? "—"} km`], ["Duration", `${metrics.processingDurationMs ?? "—"} ms`]];
  const stages = ["GPS Data Ingestion", "GPS Data Cleaning", "GPS Transformations", "Maritime Geofencing", "Alert & Anomaly Detection", "Boat & Maritime Analytics", "Result Storage"];
  const selectedBoat = boats.find((boat) => boat.boatId === selectedBoatId) || boats[0];
  return <main className="analytics-page"><header><div><p className="eyebrow">MEENAVAN / SPARK + SCALA</p><h1>Big Data Processing Centre</h1><p className="muted">Actual GPS records from the MEENAVAN simulator · illustrative geofence analytics</p></div><button className="secondary" onClick={onBack}>Back to command dashboard</button></header><section className="analytics-live panel"><div className="panel-heading"><div><h2>Live fleet tracking</h2><p className="muted">The same boats, GPS stream, selection, and movement history used by Coastal Guard Command.</p></div><span className="badge">SIMULATED GPS · 3 SEC</span></div><div className="analytics-live-grid"><div><BoatMap boats={boats} selectedId={selectedBoat?.boatId} onSelect={setSelectedBoatId} /><div className="analytics-fleet-list">{boats.map((boat) => <button className={boat.boatId === selectedBoat?.boatId ? "boat-row selected" : "boat-row"} key={boat.boatId} onClick={() => setSelectedBoatId(boat.boatId)}><span>⛵ {boat.boatId}</span><span className={`status ${boat.boundaryStatus.toLowerCase()}`}>{boat.boundaryStatus}</span></button>)}</div></div><BoatDetails boat={selectedBoat} /></div><div className="analytics-command-grid">  <section><h2>Simulation control panel</h2><p className="muted">Select BOAT001, BOAT002, or BOAT003, then apply an action. The selected boat updates immediately on the map and in the fleet.</p>  <div className="simulation-boats">{boats.map((boat) => <button type="button" className={boat.boatId === selectedBoat?.boatId ? "simulation-boat selected" : "simulation-boat"} key={boat.boatId} onClick={() => setSelectedBoatId(boat.boatId)}><span className="boat-shape">⛵</span><strong>{boat.boatId}</strong><small>{boat.boundaryStatus}</small></button>)}</div><select value={demoAction} onChange={(event) => setDemoAction(event.target.value)}><option value="normal">Move Boat Normally</option><option value="towards">Move Towards Boundary</option><option value="cross">Cross Boundary</option><option value="return">Return to Safe Zone</option></select><button onClick={applySimulation}>Apply simulation action</button></section><section><h2>Broadcast weather alert</h2><form onSubmit={sendWeather}>{["title", "condition", "severity", "description", "region", "instructions"].map((key) => <input key={key} placeholder={key[0].toUpperCase() + key.slice(1)} value={weather[key]} onChange={(event) => setWeather({ ...weather, [key]: event.target.value })} required />)}<button>Send alert to fishermen</button></form></section></div></section><nav className="analytics-tabs">{[["overview", "Pipeline"], ["visuals", "Visualizations"], ["anomalies", "Detected anomalies"], ["logs", "Scala execution logs"], ["downloads", "Downloads & metrics"]].map(([value, label]) => <button className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}>{label}</button>)}</nav><section className="analytics-toolbar"><div><span className={`engine-status ${status.status.toLowerCase()}`}>{status.status}</span>{status.error && <span className="error">{status.error}</span>}</div><div className="analytics-actions"><button onClick={() => start("run", "Spark pipeline started.")}>Run complete Spark pipeline</button><button className="secondary" onClick={() => start("stream/start", "Structured Streaming started.")}>Start Structured Streaming</button><button className="secondary" onClick={() => start("stream/stop", "Structured Streaming stopped.")}>Stop streaming</button></div></section>{error && <div className="notice">{error}</div>}{tab === "overview" && <><div className="analytics-metrics">{cards.map(([label, value]) => <div className="analytics-card" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><section className="stage-grid">{stages.map((stage, index) => <article className="stage-card" key={stage}><span>0{index + 1}</span><div><h3>{stage}</h3><p>{index === 0 ? "JSON GPS input from all three boats" : index === 3 ? "SAFE · WARNING · CRITICAL classification" : "Spark DataFrame processing stage"}</p></div><b className={status.status === "COMPLETED" ? "done" : ""}>{status.status === "COMPLETED" ? "COMPLETE" : "READY"}</b></article>)}</section></>}{tab === "visuals" && <section className="analytics-content"><h2>Boat-wise GPS and movement analysis</h2><div className="bar-chart">{visuals.boats.map((boat) => <div className="bar-row" key={boat.boatId}><b>{boat.boatId}</b><div><span style={{ width: `${Math.min(100, Number(boat.gpsRecords || 0) * 5)}%` }} /></div><small>{boat.gpsRecords || 0} records · {boat.distanceTravelledKm || 0} km · avg {boat.averageSpeed || 0}</small></div>)}</div><h2>Boundary outcomes</h2><div className="analytics-table"><table><thead><tr><th>Boat</th><th>Records</th><th>Average speed</th><th>Maximum speed</th><th>Border events</th><th>SOS</th></tr></thead><tbody>{visuals.boats.map((boat) => <tr key={boat.boatId}><td>{boat.boatId}</td><td>{boat.gpsRecords}</td><td>{boat.averageSpeed}</td><td>{boat.maximumSpeed}</td><td>{boat.borderEvents}</td><td>{boat.sosEvents}</td></tr>)}</tbody></table></div></section>}{tab === "anomalies" && <section className="analytics-content"><h2>Detected anomalies</h2><div className="analytics-table"><table><thead><tr><th>Alert ID</th><th>Boat</th><th>Fisherman</th><th>Type</th><th>Severity</th><th>Location</th><th>Timestamp</th></tr></thead><tbody>{anomalies.map((item) => <tr key={item.alertId}><td>{(item.alertId || "").slice(0, 10)}</td><td>{item.boatId}</td><td>{item.fishermanId}</td><td>{item.alertType}</td><td><span className="status critical">{item.severity}</span></td><td>{item.latitude}, {item.longitude}</td><td>{item.timestamp}</td></tr>)}</tbody></table>{!anomalies.length && <p className="muted">Run the Spark pipeline to populate anomaly results.</p>}</div></section>}{tab === "logs" && <section className="analytics-content log-console">{logs.length ? logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : <p>Scala execution logs will appear here after the pipeline starts.</p>}</section>  }{tab === "downloads" && <section className="analytics-content"><h2>Final step: downloads & result files</h2><div className="download-grid">{[...results, { name: "analytics_summary" }].map((result) => <button className="download-card" onClick={() => downloadResult(result.name)} key={result.name}><strong>{result.name}</strong><small>{result.records ?? "JSON summary"} · Download generated Spark output</small></button>)}</div><button className="download-all" onClick={() => downloadResult("meenavan-results.zip")}>Download all results (.ZIP)</button><h2>Processing metrics & summary</h2><pre>{JSON.stringify(metrics, null, 2)}</pre></section>}</main>;
}

function Dashboard({ user, onLogout }) {
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [boats, setBoats] = useState(initialBoatDisplay);
  const [alerts, setAlerts] = useState([]);
  const [boundaryAlertCount, setBoundaryAlertCount] = useState(0);
  const [selectedId, setSelectedId] = useState(user.boatId || "BOAT001");
  const [notice, setNotice] = useState("");
  const [weather, setWeather] = useState({ title: "Heavy Rain Warning", condition: "Heavy rain and strong winds", severity: "HIGH", description: "Strong winds and heavy rainfall are expected.", region: "Palk Strait", instructions: "Return to shore immediately." });
  const [demoAction, setDemoAction] = useState("towards");
  useEffect(() => {
    fetch(`${API}/api/boats`).then((response) => response.json()).then(setBoats);
    fetch(`${API}/api/alert-counts`).then((response) => response.json()).then((counts) => setBoundaryAlertCount(counts.boundaryAlerts || 0));
    const socket = io(API);
    const authenticate = () => socket.emit("authenticate", { role: user.role, fishermanId: user.username });
    socket.on("connect", authenticate);
    socket.on("boats:initial", setBoats);
    socket.on("alerts:initial", (incoming) => setAlerts((items) => mergeAlerts(items, incoming)));
    socket.on("boat:update", (boat) => setBoats((items) => items.map((item) => item.boatId === boat.boatId ? boat : item)));
    socket.on("alert", (alert) => { setAlerts((items) => [alert, ...items.filter((item) => item.id !== alert.id)]); setNotice(alert.description); });
    socket.on("boat:alert", (alert) => { setAlerts((items) => [alert, ...items.filter((item) => item.id !== alert.id)]); setNotice(alert.description); });
    socket.on("weather:alert", (alert) => { setAlerts((items) => [alert, ...items.filter((item) => item.id !== alert.id)]); setNotice(`${alert.title} broadcast to all fishermen.`); });
    socket.on("sos:alert", (alert) => { setAlerts((items) => [alert, ...items.filter((item) => item.id !== alert.id)]); setNotice(`SOS received from ${alert.boatId}.`); });
    socket.on("sos:acknowledged", (alert) => setAlerts((items) => items.map((item) => item.id === alert.id ? alert : item)));
    const poll = setInterval(() => {
      fetch(`${API}/api/boats`).then((response) => response.json()).then(setBoats);
      fetch(`${API}/api/alert-counts`).then((response) => response.json()).then((counts) => setBoundaryAlertCount(counts.boundaryAlerts || 0));
      fetch(`${API}/api/alerts`).then((response) => response.json()).then((incoming) => setAlerts((items) => mergeAlerts(items, incoming)));
    }, 3000);
    return () => { clearInterval(poll); socket.disconnect(); };
  }, [user]);
  const visibleBoats = user.role === "guard" ? (boats.length ? boats : initialBoatDisplay) : (boats.length ? boats.filter((boat) => boat.boatId === user.boatId) : initialBoatDisplay.filter((boat) => boat.boatId === user.boatId));
  const boat = visibleBoats.find((item) => item.boatId === selectedId) || visibleBoats[0];
  const visibleAlerts = user.role === "guard" ? alerts : alerts.filter((alert) => alert.fishermanId === user.username || alert.type === "WEATHER ALERT");
  async function sendWeather(event) {
    event.preventDefault();
    const response = await fetch(`${API}/api/weather-alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(weather) });
    if (!response.ok) {
      setNotice("Complete every weather alert field.");
      return;
    }
    const alert = await response.json();
    setAlerts((items) => [alert, ...items.filter((item) => item.id !== alert.id)]);
    setNotice("Weather alert broadcast to all fishermen.");
  }
  async function runDemo() {
    const requestedBoatId = selectedId;
    const response = await fetch(`${API}/api/simulation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boatId: requestedBoatId, action: demoAction }) });
    if (response.ok) {
      const updatedBoat = await response.json();
      setBoats((items) => items.map((item) => item.boatId === updatedBoat.boatId ? updatedBoat : item));
      if (updatedBoat.generatedAlert) setAlerts((items) => [updatedBoat.generatedAlert, ...items.filter((item) => item.id !== updatedBoat.generatedAlert.id)]);
      setSelectedId(updatedBoat.boatId);
      setNotice(`${demoAction} applied to ${updatedBoat.boatId}. ${updatedBoat.boundaryStatus} at ${updatedBoat.latitude.toFixed(5)}, ${updatedBoat.longitude.toFixed(5)}`);
      return;
    }
    setNotice("Simulation failed. Confirm the backend is running on port 3001.");
  }
  async function sendSos() {
    const response = await fetch(`${API}/api/sos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boatId: user.boatId, fishermanId: user.username }) });
    if (!response.ok) {
      setNotice("Unable to send SOS.");
      return;
    }
    const alert = await response.json();
    setAlerts((items) => [alert, ...items.filter((item) => item.id !== alert.id)]);
    setNotice("SOS sent to Coastal Guard and displayed in your alert stream.");
  }
  async function acknowledge(id) {
    await fetch(`${API}/api/alerts/${id}/acknowledge`, { method: "POST" });
    setAlerts((items) => items.map((item) => item.id === id ? { ...item, status: "ACKNOWLEDGED" } : item));
  }
  if (analyticsOpen && user.role === "guard") return <BigDataAnalytics onBack={() => setAnalyticsOpen(false)} />;
  return <main className={user.role === "guard" ? "app guard" : "app fisherman"}><header><div><p className="eyebrow">MEENAVAN / LIVE OPERATIONS</p><h1>{user.role === "guard" ? "Coastal Guard Command" : `Fisherman Dashboard · ${user.username}`}</h1><p className="muted">All location data is simulated for demonstration; future ESP32/GPS input can use the same pipeline.</p></div><div className="header-actions">{user.role === "guard" && <button onClick={() => setAnalyticsOpen(true)}>Big Data Analytics</button>}<button className="secondary" onClick={onLogout}>Log out</button></div></header>{notice && <div className="notice">{notice}</div>}<div className="overview">{(user.role === "guard" ? [["Total boats", boats.length], ["Active boats", boats.filter((item) => item.engineStatus === "ON").length], ["Boundary alerts", boundaryAlertCount], ["SOS alerts", alerts.filter((item) => item.type === "EMERGENCY SOS").length]] : [["My boat", user.boatId], ["Boundary", boat?.boundaryStatus || "—"], ["GPS status", boat?.gpsStatus || "—"], ["Journey", boat?.journeyStatus || "—"]]).map(([label, value]) => <div className="stat" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><div className="layout"><div><section className="panel map-panel">  <div className="panel-heading"><h2>Live Palk Strait maritime picture</h2><span className="badge">3 BOATS ACTIVE · SIMULATED GPS · 3 SEC</span></div><BoatMap boats={visibleBoats} selectedId={boat?.boatId} onSelect={setSelectedId} /></section><BoatDetails boat={boat} />{user.role === "guard" && <section className="panel boat-list"><div className="panel-heading"><h2>Fleet</h2><span className="muted">Select to track</span></div>{boats.map((item) => <button className={item.boatId === boat?.boatId ? "boat-row selected" : "boat-row"} key={item.boatId} onClick={() => setSelectedId(item.boatId)}><span>⛵ {item.boatId}</span><span className={`status ${item.boundaryStatus.toLowerCase()}`}>{item.boundaryStatus}</span></button>)}</section>}</div><aside><section className="panel"><div className="panel-heading"><h2>Alert stream</h2></div>{visibleAlerts.slice(0, 10).map((alert) => <article className={`alert ${alert.severity?.toLowerCase()}`} key={alert.id}><div><strong>{alert.type === "WEATHER ALERT" ? alert.title : alert.type}</strong><small>{alert.boatId || alert.region || "All vessels"} · {new Date(alert.timestamp).toLocaleTimeString()}</small></div><p>{alert.description || alert.instructions}</p>{alert.status && <small>Status: {alert.status}</small>}{user.role === "guard" && alert.type === "EMERGENCY SOS" && alert.status === "PENDING" && <button onClick={() => acknowledge(alert.id)}>Acknowledge SOS</button>}</article>)}{!visibleAlerts.length && <p className="muted">No alerts yet.</p>}</section>{user.role === "guard" ? <><section className="panel"><h2>Simulation control panel</h2><p className="muted">Testing control: actions emit GPS records through the same incoming stream used by Spark.</p>    <label className="simulation-label">Selected boat<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{boats.map((item) => <option value={item.boatId} key={item.boatId}>{item.boatId}</option>)}</select></label><div className="simulation-boats">{boats.map((item) => <button type="button" className={item.boatId === boat?.boatId ? "simulation-boat selected" : "simulation-boat"} key={item.boatId} onClick={() => setSelectedId(item.boatId)}><span className="boat-shape">⛵</span><strong>{item.boatId}</strong><small>{item.boundaryStatus}</small></button>)}</div><select value={demoAction} onChange={(event) => setDemoAction(event.target.value)}><option value="normal">Move Boat Normally</option><option value="towards">Move Towards Boundary</option><option value="cross">Cross Boundary</option><option value="return">Return to Safe Zone</option></select><button onClick={runDemo}>Apply simulation action</button></section><section className="panel"><h2>Broadcast weather alert</h2><form onSubmit={sendWeather}>{["title", "condition", "severity", "description", "region", "instructions"].map((key) => <input key={key} placeholder={key[0].toUpperCase() + key.slice(1)} value={weather[key]} onChange={(event) => setWeather({ ...weather, [key]: event.target.value })} required />)}<button>Send alert to fishermen</button></form></section></> : <button className="sos" onClick={sendSos}>SOS<br /><small>Send emergency position</small></button>}</aside></div></main>;
}

function App() { const [user, setUser] = useState(null); return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />; }
createRoot(document.getElementById("root")).render(<App />);
