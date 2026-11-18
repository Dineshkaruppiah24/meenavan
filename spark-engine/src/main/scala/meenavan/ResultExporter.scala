package meenavan

import java.nio.file.{Files, Path, Paths}
import org.apache.spark.sql.{DataFrame, Row}

object ResultExporter {
  def reset(path: Path): Unit = {
    if (Files.exists(path)) {
      val stream = Files.walk(path)
      try {
        stream.sorted(java.util.Comparator.reverseOrder()).forEach { item =>
          try Files.setAttribute(item, "dos:readonly", false)
          catch { case _: java.nio.file.FileSystemException => () }
          Files.deleteIfExists(item)
        }
      } finally stream.close()
    }
    Files.createDirectories(path)
  }
  def csv(frame: DataFrame, path: String): Unit = {
    val target = Paths.get(path)
    reset(target)
    try {
      frame.coalesce(1).write.mode("overwrite").option("header", "true").csv(path)
    } catch {
      case error: Exception =>
        println(s"Spark CSV writer unavailable on this Windows host (${error.getClass.getSimpleName}); using Spark-collected local CSV fallback.")
        reset(target)
        val values = frame.collect().map { row: Row =>
          row.toSeq.map(value => if (value == null) "" else value.toString.replace("\"", "\"\"")).map(value => s""""$value"""").mkString(",")
        }
        val content = (frame.columns.mkString(",") +: values).mkString(System.lineSeparator()) + System.lineSeparator()
        Files.write(target.resolve("part-00000.csv"), content.getBytes("UTF-8"))
    }
  }
}
