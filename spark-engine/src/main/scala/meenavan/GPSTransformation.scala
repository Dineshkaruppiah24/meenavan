package meenavan

import org.apache.spark.sql.DataFrame
import org.apache.spark.sql.functions._

object GPSTransformation {
  def transform(input: DataFrame): DataFrame = {
    println("GPS Transformations Completed")
    input
      .withColumn("eventTime", to_timestamp(col("timestamp")))
      .withColumn("eventDate", to_date(col("eventTime")))
      .withColumn("movementStatus", when(col("speed") <= 0, "STATIONARY").otherwise("MOVING"))
      .withColumn("distanceFromPreviousKm", lit(0.0))
      .select("boatId", "fishermanId", "latitude", "longitude", "timestamp", "eventTime", "eventDate", "speed", "engineStatus", "batteryLevel", "gpsStatus", "journeyStatus", "movementStatus", "distanceFromPreviousKm")
  }
}
