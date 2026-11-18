import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "..");
const sparkRoot = join(root, "spark-engine");
const resultsRoot = join(root, "results");
mkdirSync(resultsRoot, { recursive: true });

const state = {
  status: "IDLE",
  pid: null,
  startedAt: null,
  completedAt: null,
  logs: [],
  error: null,
  stream: null
};

function commandFor(mainClass) {
  return process.platform === "win32" ? "sbt.bat" : "sbt";
}
function sparkArguments(mainClass) {
  return ["-batch", "-Dsbt.server.autostart=false", `runMain ${mainClass}`];
}
function spawnSpark(mainClass) {
  if (process.platform === "win32") {
    return spawn(`${commandFor(mainClass)} -batch -Dsbt.server.autostart=false "runMain ${mainClass}"`, [], { cwd: sparkRoot, shell: true, windowsHide: true });
  }
  return spawn(commandFor(mainClass), sparkArguments(mainClass), { cwd: sparkRoot });
}
function runSpark(mainClass, onComplete) {
  if (state.status === "RUNNING") return false;
  state.status = "RUNNING";
  state.startedAt = new Date().toISOString();
  state.completedAt = null;
  state.error = null;
  state.logs = [];
  const child = spawnSpark(mainClass);
  state.pid = child.pid;
  const capture = (chunk) => {
    const text = chunk.toString();
    state.logs.push(...text.split(/\r?\n/).filter(Boolean).map((line) => `[${new Date().toLocaleTimeString()}] ${line}`));
    if (state.logs.length > 500) state.logs = state.logs.slice(-500);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  child.on("error", (error) => { state.error = error.message; state.status = "FAILED"; });
  child.on("close", (code) => {
    state.pid = null;
    state.completedAt = new Date().toISOString();
    const failedLog = state.logs.some((line) => /IllegalAccessError|Exception in thread|error/i.test(line));
    state.status = code === 0 && !failedLog ? "COMPLETED" : "FAILED";
    if (code !== 0) state.error = `Spark process exited with code ${code}.`;
    if (failedLog && !state.error) state.error = "Spark emitted an execution error. Review the Scala execution logs.";
    if (onComplete) onComplete(code);
  });
  return true;
}
function stopStream() {
  if (!state.stream) return false;
  state.stream.kill();
  state.stream = null;
  state.status = "IDLE";
  state.pid = null;
  return true;
}
function readResultDirectories() {
  if (!existsSync(resultsRoot)) return [];
  return readdirSync(resultsRoot).filter((name) => statSync(join(resultsRoot, name)).isDirectory()).map((name) => {
    const files = readdirSync(join(resultsRoot, name)).filter((file) => file.endsWith(".csv"));
    return { name, records: files.length ? Math.max(0, requireLineCount(join(resultsRoot, name, files[0])) - 1) : 0 };
  });
}
function readSummary() {
  const path = join(resultsRoot, "analytics_summary.json");
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}
function readCsv(name) {
  const directory = join(resultsRoot, name);
  if (!existsSync(directory)) return [];
  const part = readdirSync(directory).find((file) => file.endsWith(".csv"));
  if (!part) return [];
  const rows = readFileSync(join(directory, part), "utf8").trim().split(/\r?\n/);
  if (rows.length < 2) return [];
  const headers = rows[0].split(",");
  return rows.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, (line.split(",")[index] ?? "").replace(/^"|"$/g, "")])));
}
function requireLineCount(path) {
  try { return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).length; } catch { return 0; }
}

export function attachAnalyticsRoutes(app) {
  app.post("/api/analytics/run", (_req, res) => {
    if (!runSpark("meenavan.MeenavanSparkMain")) return res.status(409).json({ error: "A Spark pipeline is already running." });
    return res.status(202).json({ status: state.status });
  });
  app.post("/api/analytics/stream/start", (_req, res) => {
    if (state.stream) return res.status(409).json({ error: "Structured Streaming is already running." });
    const child = spawnSpark("meenavan.GPSStreamProcessor");
    state.stream = child; state.status = "RUNNING"; state.pid = child.pid;
    const capture = (chunk) => state.logs.push(...chunk.toString().split(/\r?\n/).filter(Boolean).map((line) => `[${new Date().toLocaleTimeString()}] ${line}`));
    child.stdout.on("data", capture); child.stderr.on("data", capture);
    child.on("close", () => { state.stream = null; state.pid = null; if (state.status === "RUNNING") state.status = "IDLE"; });
    return res.status(202).json({ status: "RUNNING" });
  });
  app.post("/api/analytics/stream/stop", (_req, res) => res.json({ stopped: stopStream(), status: state.status }));
  app.get("/api/analytics/status", (_req, res) => res.json({ status: state.status, pid: state.pid, startedAt: state.startedAt, completedAt: state.completedAt, error: state.error }));
  app.get("/api/analytics/metrics", (_req, res) => res.json(readSummary() || {}));
  app.get("/api/analytics/visualizations", (_req, res) => {
    const boundaries = readCsv("geofence_results.csv").reduce((counts, row) => {
      const status = row.boundaryStatus || "SAFE";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    return res.json({ boats: readCsv("boat_analytics.csv"), boundaries });
  });
  app.get("/api/analytics/anomalies", (_req, res) => res.json(readCsv("border_alert_results.csv")));
  app.get("/api/analytics/logs", (_req, res) => res.json({ logs: state.logs, error: state.error }));
  app.get("/api/analytics/results", (_req, res) => res.json(readResultDirectories()));
  app.get("/api/analytics/download/:name", (req, res) => {
    const requestedName = req.params.name;
    const safeName = requestedName.replace(/[^a-zA-Z0-9_.-]/g, "");
    if (safeName !== requestedName) return res.status(400).json({ error: "Invalid result name." });
    if (safeName === "analytics_summary" || safeName === "analytics_summary.json") {
      return res.download(join(resultsRoot, "analytics_summary.json"), "analytics_summary.json");
    }
    const baseName = safeName.endsWith(".csv") ? safeName.slice(0, -4) : safeName;
    const directFile = join(resultsRoot, safeName);
    if (safeName.endsWith(".csv") && existsSync(directFile) && statSync(directFile).isFile()) {
      return res.download(directFile, safeName);
    }
    const directory = existsSync(join(resultsRoot, safeName))
      ? join(resultsRoot, safeName)
      : join(resultsRoot, baseName);
    if (!existsSync(directory) || !statSync(directory).isDirectory()) return res.status(404).json({ error: "Result has not been generated yet." });
    const part = readdirSync(directory).find((file) => file.endsWith(".csv"));
    if (!part) return res.status(404).json({ error: "Result file has not been generated yet." });
    return res.download(join(directory, part), `${baseName}.csv`);
  });
  app.get("/api/analytics/download-all", (_req, res) => {
    const zip = join(resultsRoot, "meenavan-results.zip");
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${resultsRoot}\\*' -DestinationPath '${zip}' -Force`], { windowsHide: true });
    child.on("close", (code) => code === 0 && existsSync(zip) ? res.download(zip, "meenavan-results.zip") : res.status(500).json({ error: "Unable to package Spark results." }));
  });
}

export { resultsRoot, state };
