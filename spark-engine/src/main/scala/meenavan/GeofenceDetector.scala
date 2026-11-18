package meenavan

object GeofenceDetector {
  val boundaryLatitude = 9.18
  val warningDistanceKm = 15.0
  val configuredBoundary: Seq[(Double, Double)] = Seq((8.88, 79.85), (9.05, 79.76), (9.18, 79.68), (9.33, 79.57), (9.5, 79.43))
  def calculateDistance(latitude: Double): Double = math.abs(latitude - boundaryLatitude) * 111.0
  def checkWarningZone(latitude: Double): Boolean = calculateDistance(latitude) <= warningDistanceKm
  def checkBoundaryCrossing(latitude: Double): Boolean = latitude >= boundaryLatitude
  def determineBoatStatus(latitude: Double, engineStatus: String): String =
    if (engineStatus == "OFF") "INACTIVE" else if (checkBoundaryCrossing(latitude)) "CRITICAL" else if (checkWarningZone(latitude)) "WARNING" else "SAFE"
}
