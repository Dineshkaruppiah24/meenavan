import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync, watch } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { attachAnalyticsRoutes } from "./analytics.js";

const root = join(process.cwd(), "..");
const dataRoot = join(root, "data");
const incomingRoot = join(dataRoot, "incoming", "gps");
const alertFile = join(dataRoot, "processed", "alerts.json");
const alertCountFile = join(dataRoot, "processed", "alert_counts.json");
mkdirSync(incomingRoot, { recursive: true });
mkdirSync(join(dataRoot, "processed"), { recursive: true });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "http://localhost:5173" } });
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
attachAnalyticsRoutes(app);

const boundary = [
  [8.88, 79.85], [9.05, 79.76], [9.18, 79.68], [9.33, 79.57], [9.5, 79.43]
];
const routes = {
  BOAT001: [[9.02, 79.62], [9.07, 79.64], [9.12, 79.66], [9.18, 79.68], [9.24, 79.70], [9.12, 79.66]],
  BOAT002: [[9.08, 79.48], [9.12, 79.51], [9.16, 79.54], [9.20, 79.56], [9.24, 79.58], [9.16, 79.54]],
  BOAT003: [[9.04, 79.38], [9.08, 79.41], [9.12, 79.44], [9.16, 79.47], [9.20, 79.50], [9.12, 79.44]]
};
const boats = Object.entries(routes).map(([boatId, route], index) => ({
  boatId, fishermanId: `F00${index + 1}`, route, routeIndex: 0, mode: "normal",
  latitude: route[0][0], longitude: route[0][1], speed: index === 2 ? 10 : 12,
  engineStatus: "ON", gpsStatus: "CONNECTED", batteryLevel: 92 - index * 8,
  journeyStatus: "ACTIVE", zone: "SAFE", history: [route[0]]
}));
const storedAlerts = existsSync(alertFile) ? JSON.parse(readFileSync(alertFile, "utf8")) : [];
const alerts = storedAlerts.slice(0, 500);
const storedAlertCounts = existsSync(alertCountFile) ? JSON.parse(readFileSync(alertCountFile, "utf8")) : {};
let boundaryAlertCount = Number(storedAlertCounts.boundaryAlerts) || storedAlerts.filter((alert) => alert.type?.includes("BORDER")).length;
const processedGpsRoot = join(dataRoot, "processed", "gps");
mkdirSync(processedGpsRoot, { recursive: true });
function saveAlerts() {
  if (alerts.length > 500) alerts.splice(500);
  writeFileSync(alertFile, JSON.stringify(alerts, null, 2));
  writeFileSync(alertCountFile, JSON.stringify({ boundaryAlerts: boundaryAlertCount }, null, 2));
}
function distanceToBoundary(latitude, longitude) {
  return Math.min(...boundary.map(([lat, lon]) => Math.hypot((latitude - lat) * 111, (longitude - lon) * 106)));
}
function zoneFor(boat) {
  if (boat.latitude >= 9.18) return "CRITICAL";
  if (distanceToBoundary(boat.latitude, boat.longitude) <= 15) return "WARNING";
  return "SAFE";
}
function publicBoat(boat) {
  const { route, routeIndex, mode, history, ...details } = boat;
  return { ...details, mode, history, boundaryDistanceKm: Number(distanceToBoundary(boat.latitude, boat.longitude).toFixed(2)), boundaryStatus: boat.zone, timestamp: new Date().toISOString() };
}
function writeGpsRecord(boat) {
  const record = { boatId: boat.boatId, fishermanId: boat.fishermanId, latitude: boat.latitude, longitude: boat.longitude, timestamp: new Date().toISOString(), speed: boat.speed, engineStatus: boat.engineStatus, batteryLevel: boat.batteryLevel };
  appendFileSync(join(incomingRoot, `${boat.boatId}-${Date.now()}.json`), `${JSON.stringify(record)}\n`);
}
function transitionAlert(boat, previous, current, force = false) {
  if ((!force && previous === current) || current === "SAFE") return;
  const alert = {
    id: randomUUID(), type: current === "CRITICAL" ? "CRITICAL BORDER CROSSING" : "BORDER WARNING",
    severity: current === "CRITICAL" ? "CRITICAL" : "WARNING", status: "ACTIVE",
    boatId: boat.boatId, fishermanId: boat.fishermanId, latitude: boat.latitude,
    longitude: boat.longitude, boundaryStatus: current, timestamp: new Date().toISOString(),
    description: current === "CRITICAL"
      ? "Your boat has crossed the configured boundary. Return immediately."
      : "Your boat is approaching the maritime boundary. Please return towards the Indian side."
  };
  boundaryAlertCount += 1;
  alerts.unshift(alert); saveAlerts();
  io.to("guard").emit("alert", alert);
  io.to(`boat_${boat.boatId}`).emit("alert", alert);
  io.to(`boat_${boat.boatId}`).emit("boat:alert", alert);
  return alert;
}
function advance(boat, forceAlert = false) {
  const previous = boat.zone;
  if (boat.mode === "normal") boat.routeIndex = (boat.routeIndex + 1) % boat.route.length;
  else if (boat.mode === "towards" || boat.mode === "cross") boat.routeIndex = Math.min(boat.route.length - 1, boat.routeIndex + 1);
  else if (boat.mode === "return") boat.routeIndex = Math.max(0, boat.routeIndex - 1);
  const [latitude, longitude] = boat.route[boat.routeIndex];
  boat.latitude = latitude; boat.longitude = longitude; boat.zone = zoneFor(boat);
  boat.history = [...boat.history.slice(-29), [latitude, longitude]];
  boat.speed = boat.engineStatus === "ON" ? (boat.mode === "cross" ? 16 : 12) : 0;
  writeGpsRecord(boat);
  const generatedAlert = transitionAlert(boat, previous, boat.zone, forceAlert);
  io.emit("boat:update", publicBoat(boat));
  return generatedAlert;
}
setInterval(() => boats.forEach(advance), 3000);
boats.forEach((boat) => { boat.zone = zoneFor(boat); writeGpsRecord(boat); });
watch(processedGpsRoot, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  const processedPath = join(processedGpsRoot, filename.toString());
  if (!existsSync(processedPath)) return;
  const records = readFileSync(processedPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
  const latest = records[records.length - 1];
  if (latest) io.emit("spark:processed", JSON.parse(latest));
});

app.get("/api/boats", (_req, res) => res.json(boats.map(publicBoat)));
app.get("/api/alerts", (_req, res) => res.json(alerts));
app.get("/api/alert-counts", (_req, res) => res.json({ boundaryAlerts: boundaryAlertCount }));
app.post("/api/simulation", (req, res) => {
  const boat = boats.find((item) => item.boatId === req.body.boatId);
  const allowed = ["normal", "towards", "cross", "return"];
  if (!boat || !allowed.includes(req.body.action)) return res.status(400).json({ error: "Choose a valid boat and simulation action." });
  boat.mode = req.body.action;
  if (boat.mode === "towards") {
    boat.routeIndex = boat.route.length - 3;
    if (boat.zone === "CRITICAL") boat.zone = "WARNING";
  }
  if (boat.mode === "cross") {
    boat.routeIndex = boat.route.length - 3;
    if (boat.zone === "CRITICAL") boat.zone = "WARNING";
  }
  if (boat.mode === "return") boat.routeIndex = 1;
  const generatedAlert = advance(boat, true);
  return res.json({ ...publicBoat(boat), generatedAlert });
});
app.post("/api/weather-alerts", (req, res) => {
  const fields = ["title", "condition", "severity", "description", "region", "instructions"];
  if (!fields.every((field) => typeof req.body[field] === "string" && req.body[field].trim())) return res.status(400).json({ error: "All weather alert fields are required." });
  const alert = { id: randomUUID(), type: "WEATHER ALERT", status: "ACTIVE", ...Object.fromEntries(fields.map((field) => [field, req.body[field].trim()])), timestamp: new Date().toISOString() };
  alerts.unshift(alert); saveAlerts();
  io.to("fishermen").emit("weather:alert", alert);
  io.to("fishermen").emit("alert", alert);
  io.to("guard").emit("alert", alert);
  return res.status(201).json(alert);
});
app.post("/api/sos", (req, res) => {
  const boat = boats.find((item) => item.boatId === req.body.boatId && item.fishermanId === req.body.fishermanId);
  if (!boat) return res.status(404).json({ error: "Assigned boat was not found." });
  const alert = { id: randomUUID(), type: "EMERGENCY SOS", severity: "CRITICAL", status: "PENDING", boatId: boat.boatId, fishermanId: boat.fishermanId, latitude: boat.latitude, longitude: boat.longitude, timestamp: new Date().toISOString(), description: "Emergency assistance requested by fisherman." };
  alerts.unshift(alert); saveAlerts();
  io.to("guard").emit("sos:alert", alert);
  io.to("fishermen").emit("sos:alert", alert);
  io.to(`boat_${boat.boatId}`).emit("sos:alert", alert);
  return res.status(201).json(alert);
});
app.post("/api/alerts/:id/acknowledge", (req, res) => {
  const alert = alerts.find((item) => item.id === req.params.id && item.type === "EMERGENCY SOS");
  if (!alert) return res.status(404).json({ error: "SOS alert was not found." });
  alert.status = "ACKNOWLEDGED"; saveAlerts(); io.to("guard").emit("sos:acknowledged", alert); io.to(`boat_${alert.boatId}`).emit("sos:acknowledged", alert);
  return res.json(alert);
});
io.on("connection", (socket) => {
  socket.on("authenticate", ({ role, fishermanId }) => {
    if (role === "guard") socket.join("guard");
    if (role === "fisherman" && fishermanId) { socket.join("fishermen"); socket.join(`boat_${fishermanId === "F001" ? "BOAT001" : fishermanId === "F002" ? "BOAT002" : "BOAT003"}`); }
    socket.emit("boats:initial", boats.map(publicBoat));
    socket.emit("alerts:initial", alerts);
  });
});
httpServer.listen(3001, () => console.log("MEENAVAN backend listening on http://localhost:3001"));
