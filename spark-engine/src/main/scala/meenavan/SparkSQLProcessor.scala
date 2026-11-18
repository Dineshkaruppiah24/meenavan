package meenavan

import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.functions._

object SparkSQLProcessor {
  def run(spark: SparkSession, inputPath: String): Unit = {
    val gps = spark.read.json(inputPath)
      .filter(col("latitude").between(-90, 90) && col("longitude").between(-180, 180))
      .withColumn("boundaryDistanceKm", abs(col("latitude") - lit(GeofenceDetector.boundaryLatitude)) * 111.0)
    gps.createOrReplaceTempView("GPS_DATA")
    spark.sql("SELECT boatId, count(*) AS records FROM GPS_DATA GROUP BY boatId").show(false)
    spark.sql("SELECT * FROM GPS_DATA WHERE boundaryDistanceKm <= 15 ORDER BY timestamp DESC").show(false)
  }
}
