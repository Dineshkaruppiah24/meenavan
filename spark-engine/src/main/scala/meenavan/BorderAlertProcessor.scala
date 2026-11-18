package meenavan

import org.apache.spark.sql.DataFrame
import org.apache.spark.sql.functions._

object BorderAlertProcessor {
  def detect(input: DataFrame): DataFrame = {
    println("Border Detection Completed")
    input.filter(col("boundaryStatus") =!= "SAFE").withColumn("alertId", sha2(concat_ws("|", col("boatId"), col("timestamp"), col("boundaryStatus")), 256))
      .withColumn("alertType", when(col("boundaryStatus") === "CRITICAL", "CRITICAL BORDER CROSSING").otherwise("BORDER WARNING"))
      .withColumn("severity", when(col("boundaryStatus") === "CRITICAL", "CRITICAL").otherwise("HIGH"))
      .withColumn("description", when(col("boundaryStatus") === "CRITICAL", "Configured illustrative boundary crossed. Return immediately.").otherwise("Boat is approaching the illustrative boundary."))
      .withColumn("alertStatus", lit("ACTIVE"))
      .select("alertId", "boatId", "fishermanId", "alertType", "severity", "latitude", "longitude", "timestamp", "description", "alertStatus")
  }
}
