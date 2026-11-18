package meenavan

import java.nio.file.{Files, Paths}
import java.time.Instant
import scala.util.Random

object GPSDataGenerator {
  private val routes = Map(
    "BOAT001" -> (9.02, 79.62),
    "BOAT002" -> (9.08, 79.48),
    "BOAT003" -> (9.38, 79.38)
  )

  def main(args: Array[String]): Unit = {
    val output = Paths.get("../data/incoming/gps")
    Files.createDirectories(output)
    routes.foreach { case (boatId, (latitude, longitude)) =>
      val fishermanId = boatId.replace("BOAT", "F")
      val record = s"""{"boatId":"$boatId","fishermanId":"$fishermanId","latitude":$latitude,"longitude":$longitude,"timestamp":"${Instant.now}","speed":${8 + Random.nextInt(5)},"engineStatus":"ON","batteryLevel":85}"""
      Files.write(output.resolve(s"$boatId-${System.currentTimeMillis}.json"), record.getBytes("UTF-8"))
    }
  }
}
