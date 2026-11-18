# MEENAVAN

MEENAVAN is a local academic prototype for simulated fishing-boat safety monitoring. It demonstrates React/Vite, Node.js/Express, Socket.IO, Leaflet/OpenStreetMap, and a Scala/Spark processing module.

## Run the web prototype

```powershell
cd backend
npm install
npm start
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

Demo accounts:

| Role | Username | Password |
|---|---|---|
| Coastal Guard | `admin` | `admin123` |
| Fisherman | `F001`, `F002`, or `F003` | `fish123` |

Coordinates and boundary lines are explicitly illustrative and simulated; they are not a legally surveyed maritime boundary.

## Demonstration controls

After signing in as `admin`, use the Simulation control panel to select a boat and run:

- Move Boat Normally
- Move Towards Boundary
- Cross Boundary
- Return to Safe Zone

These controls advance the same predefined route simulator used by the three-second GPS loop. Each update is written as JSON under `data/incoming/gps`, and every boat keeps a visible movement-history polyline.

## Spark engine

Install Java 17, Scala/SBT, and Apache Spark 3.5.x. From `spark-engine`, run:

```powershell
sbt "runMain meenavan.GPSStreamProcessor"
```

The engine reads JSON from `data/incoming/gps`, applies schema validation, DataFrame transformations, Spark SQL, geofencing, aggregations, and Structured Streaming, then writes JSON under `data/processed`. The Node backend watches `data/processed/gps` and forwards Spark-produced records over Socket.IO when the stream is running.

To generate one sample batch with Scala:

```powershell
sbt "runMain meenavan.GPSDataGenerator"
```

The map boundary is an explicitly illustrative, configurable prototype geofence. It is not presented as a legally surveyed maritime boundary.

## Big Data Analytics dashboard

Sign in as the Coastal Guard and select **Big Data Analytics**. The dashboard provides:

- Actual Spark batch execution and captured Scala logs.
- Start/stop controls for Structured Streaming.
- Seven visible processing stages.
- Metrics from `analytics_summary.json`.
- Boat analytics and boundary anomaly tables.
- Download links for cleaned, transformed, geofence, border-alert, SOS, and boat-analytics outputs.
- A ZIP download containing the generated result directories and summary.

The backend launches Spark non-blockingly through SBT:

```powershell
cd "C:\Users\dines\OneDrive\Desktop\ssf project\backend"
npm start
```

Then use the dashboard's **RUN COMPLETE SPARK PIPELINE** action. On Windows, the Spark module includes Java 17 module-opening options and a local CSV fallback when Hadoop's optional `winutils.exe` is not installed; all filtering, transformations, geofencing, SQL, and aggregations still execute in Apache Spark.
