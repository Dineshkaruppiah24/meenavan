package meenavan

import org.apache.spark.sql.{DataFrame, SparkSession}
import java.nio.file.{Files, Paths}
import scala.collection.JavaConverters._

object GPSDataIngestion {
  def read(spark: SparkSession, input: String): DataFrame = {
    println("GPS Data Ingestion Started")
    val directory = Paths.get("../data/incoming/gps")
    val lines = if (Files.exists(directory)) Files.list(directory).iterator().asScala
      .filter(_.toString.endsWith(".json")).flatMap(path => Files.readAllLines(path).asScala).toSeq else Seq.empty
    val frame = spark.read.option("mode", "PERMISSIVE").json(spark.sparkContext.parallelize(lines))
    println(s"GPS Records Loaded: ${frame.count()}")
    frame
  }
}
