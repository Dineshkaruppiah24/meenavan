package meenavan

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._

object BoatAnalytics {
  def aggregate(spark: SparkSession, gps: DataFrame, borders: DataFrame, sos: DataFrame): DataFrame = {
    gps.createOrReplaceTempView("GPS_RECORDS")
    gps.filter(col("engineStatus") === "ON").createOrReplaceTempView("ACTIVE_BOATS")
    borders.createOrReplaceTempView("BOUNDARY_EVENTS")
    sos.createOrReplaceTempView("SOS_EVENTS")
    spark.sql("""SELECT g.boatId, count(*) AS gpsRecords, round(avg(g.speed), 2) AS averageSpeed,
      |round(max(g.speed), 2) AS maximumSpeed, round(sum(g.distanceFromPreviousKm), 2) AS distanceTravelledKm,
      |coalesce(max(b.borderEvents), 0) AS borderEvents, coalesce(max(s.sosEvents), 0) AS sosEvents
      |FROM GPS_RECORDS g
      |LEFT JOIN (SELECT boatId, count(*) AS borderEvents FROM BOUNDARY_EVENTS GROUP BY boatId) b ON g.boatId = b.boatId
      |LEFT JOIN (SELECT boatId, count(*) AS sosEvents FROM SOS_EVENTS GROUP BY boatId) s ON g.boatId = s.boatId
      |GROUP BY g.boatId""".stripMargin)
  }
}
