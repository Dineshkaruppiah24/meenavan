package meenavan

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._

object SOSAlertProcessor {
  def read(spark: SparkSession, path: String): DataFrame = {
    val schema = "id STRING, type STRING, status STRING, boatId STRING, fishermanId STRING, latitude DOUBLE, longitude DOUBLE, timestamp STRING, description STRING"
    try {
      spark.read.option("multiline", "true").schema(schema).json(path).filter(col("type") === "EMERGENCY SOS")
    } catch {
      case _: Exception => spark.emptyDataFrame
    }
  }
}
