import Foundation
import CoreData

@objc public class LocationStorage: NSObject {
  @objc public static let shared = LocationStorage()

  private let batchSize = 10
  private let batchTimeoutSeconds: TimeInterval = 5.0
  private let queue = DispatchQueue(label: "com.backgroundlocation.storage", qos: .userInitiated)

  private var buffer: [LocationBufferEntry] = []
  private var batchTimer: DispatchSourceTimer?
  private var nextId: Int64 = 1

  private override init() {
    super.init()
    loadNextId()
    startBatchTimer()
  }

  // MARK: - Location Persistence

  @objc public func saveLocation(
    tripId: String,
    latitude: String,
    longitude: String,
    timestamp: Double,
    accuracy: Double,
    altitude: Double,
    speed: Double,
    bearing: Double,
    verticalAccuracyMeters: Double,
    speedAccuracyMetersPerSecond: Double,
    bearingAccuracyDegrees: Double,
    provider: String?,
    isFromMockProvider: NSNumber?
  ) {
    queue.async { [weak self] in
      guard let self = self else { return }

      let entry = LocationBufferEntry(
        id: self.nextId,
        tripId: tripId,
        latitude: latitude,
        longitude: longitude,
        timestamp: timestamp,
        accuracy: accuracy,
        altitude: altitude,
        speed: speed,
        bearing: bearing,
        verticalAccuracyMeters: verticalAccuracyMeters,
        speedAccuracyMetersPerSecond: speedAccuracyMetersPerSecond,
        bearingAccuracyDegrees: bearingAccuracyDegrees,
        provider: provider,
        isFromMockProvider: isFromMockProvider?.boolValue
      )
      self.nextId += 1
      self.buffer.append(entry)

      if self.buffer.count >= self.batchSize {
        self.flushBuffer()
      }
    }
  }

  @objc public func getLocations(tripId: String) -> [[String: Any]] {
    return queue.sync { [weak self] in
      guard let self = self else { return [] }

      self.flushBuffer()

      let context = CoreDataStack.shared.newBackgroundContext()
      var result: [[String: Any]] = []

      context.performAndWait {
        let request = NSFetchRequest<NSManagedObject>(entityName: "LocationEntity")
        request.predicate = NSPredicate(format: "tripId == %@", tripId)
        request.sortDescriptors = [NSSortDescriptor(key: "timestamp", ascending: true)]

        do {
          let entities = try context.fetch(request)
          result = entities.compactMap { entity -> [String: Any]? in
            // Data integrity: skip entries missing required fields
            guard let lat = entity.value(forKey: "latitude") as? String,
                  let lng = entity.value(forKey: "longitude") as? String,
                  !lat.isEmpty, !lng.isEmpty,
                  let timestamp = entity.value(forKey: "timestamp") as? Double,
                  timestamp > 0 else {
              NSLog("[BackgroundLocation] Skipped corrupt location entry during read")
              return nil
            }
            return self.entityToDict(entity)
          }
        } catch {
          NSLog("[BackgroundLocation] Failed to fetch locations: \(error)")
        }
      }

      return result
    }
  }

  @objc public func clearTrip(tripId: String) {
    queue.async { [weak self] in
      guard let self = self else { return }

      // Remove from buffer
      self.buffer.removeAll { $0.tripId == tripId }

      // Remove from Core Data
      let context = CoreDataStack.shared.newBackgroundContext()
      context.performAndWait {
        let request = NSFetchRequest<NSFetchRequestResult>(entityName: "LocationEntity")
        request.predicate = NSPredicate(format: "tripId == %@", tripId)
        let deleteRequest = NSBatchDeleteRequest(fetchRequest: request)

        do {
          try context.execute(deleteRequest)
          try context.save()
        } catch {
          NSLog("[BackgroundLocation] Failed to clear trip: \(error)")
        }
      }
    }
  }

  @objc public func forceFlush() {
    queue.sync {
      flushBuffer()
    }
  }

  // MARK: - Tracking State Persistence

  @objc public func saveTrackingState(tripId: String?, isActive: Bool, options: TrackingOptions?) {
    queue.async { [weak self] in
      guard self != nil else { return }

      let context = CoreDataStack.shared.newBackgroundContext()
      context.performAndWait {
        let request = NSFetchRequest<NSManagedObject>(entityName: "TrackingStateEntity")
        request.predicate = NSPredicate(format: "id == %d", 1)

        do {
          let results = try context.fetch(request)
          let entity: NSManagedObject

          if let existing = results.first {
            entity = existing
          } else {
            guard let entityDescription = NSEntityDescription.entity(forEntityName: "TrackingStateEntity", in: context) else { return }
            entity = NSManagedObject(entity: entityDescription, insertInto: context)
            entity.setValue(Int16(1), forKey: "id")
          }

          entity.setValue(isActive, forKey: "isActive")
          entity.setValue(tripId, forKey: "tripId")
          entity.setValue(options?.accuracy, forKey: "accuracy")
          entity.setValue(options?.distanceFilter?.doubleValue ?? 0.0, forKey: "distanceFilter")
          entity.setValue(options?.updateInterval?.doubleValue ?? 0.0, forKey: "updateInterval")
          entity.setValue(options?.foregroundOnly?.boolValue, forKey: "foregroundOnly")

          try context.save()
        } catch {
          NSLog("[BackgroundLocation] Failed to save tracking state: \(error)")
        }
      }
    }
  }

  @objc public func saveTrackingStateSync(tripId: String?, isActive: Bool, options: TrackingOptions?) {
    queue.sync {
      let context = CoreDataStack.shared.newBackgroundContext()
      context.performAndWait {
        let request = NSFetchRequest<NSManagedObject>(entityName: "TrackingStateEntity")
        request.predicate = NSPredicate(format: "id == %d", 1)

        do {
          let results = try context.fetch(request)
          let entity: NSManagedObject

          if let existing = results.first {
            entity = existing
          } else {
            guard let entityDescription = NSEntityDescription.entity(forEntityName: "TrackingStateEntity", in: context) else { return }
            entity = NSManagedObject(entity: entityDescription, insertInto: context)
            entity.setValue(Int16(1), forKey: "id")
          }

          entity.setValue(isActive, forKey: "isActive")
          entity.setValue(tripId, forKey: "tripId")
          entity.setValue(options?.accuracy, forKey: "accuracy")
          entity.setValue(options?.distanceFilter?.doubleValue ?? 0.0, forKey: "distanceFilter")
          entity.setValue(options?.updateInterval?.doubleValue ?? 0.0, forKey: "updateInterval")
          entity.setValue(options?.foregroundOnly?.boolValue, forKey: "foregroundOnly")

          try context.save()
        } catch {
          NSLog("[BackgroundLocation] Failed to save tracking state sync: \(error)")
        }
      }
    }
  }

  @objc public func getTrackingState() -> [String: Any] {
    return queue.sync {
      var result: [String: Any] = ["isActive": false]

      let context = CoreDataStack.shared.newBackgroundContext()
      context.performAndWait {
        let request = NSFetchRequest<NSManagedObject>(entityName: "TrackingStateEntity")
        request.predicate = NSPredicate(format: "id == %d", 1)

        do {
          if let entity = try context.fetch(request).first {
            result["isActive"] = entity.value(forKey: "isActive") as? Bool ?? false
            result["tripId"] = entity.value(forKey: "tripId")
            result["accuracy"] = entity.value(forKey: "accuracy")
            result["distanceFilter"] = entity.value(forKey: "distanceFilter")
            result["updateInterval"] = entity.value(forKey: "updateInterval")
            result["foregroundOnly"] = entity.value(forKey: "foregroundOnly")
          }
        } catch {
          NSLog("[BackgroundLocation] Failed to get tracking state: \(error)")
        }
      }

      return result
    }
  }

  // MARK: - Stop Token (Crash Recovery)

  private static let stopTokenKey = "bg_location_stop_token"
  private static let stopTokenTimestampKey = "bg_location_stop_token_ts"
  private static let stopTokenWindowSeconds: TimeInterval = 60.0

  @objc public func setStopToken() {
    UserDefaults.standard.set(true, forKey: LocationStorage.stopTokenKey)
    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: LocationStorage.stopTokenTimestampKey)
    UserDefaults.standard.synchronize()
  }

  @objc public func clearStopToken() {
    UserDefaults.standard.removeObject(forKey: LocationStorage.stopTokenKey)
    UserDefaults.standard.removeObject(forKey: LocationStorage.stopTokenTimestampKey)
    UserDefaults.standard.synchronize()
  }

  @objc public func hasValidStopToken() -> Bool {
    guard UserDefaults.standard.bool(forKey: LocationStorage.stopTokenKey) else {
      return false
    }

    let tokenTimestamp = UserDefaults.standard.double(forKey: LocationStorage.stopTokenTimestampKey)
    guard tokenTimestamp > 0 else {
      return true
    }

    let elapsed = Date().timeIntervalSince1970 - tokenTimestamp
    return elapsed <= LocationStorage.stopTokenWindowSeconds
  }

  // MARK: - Restart Loop Detection

  private static let restartCountKey = "bg_location_restart_count"
  private static let restartWindowStartKey = "bg_location_restart_window_start"
  private static let maxRestartsPerHour = 5
  private static let restartWindowSeconds: TimeInterval = 3600.0

  @objc public func canAttemptRecovery() -> Bool {
    let count = UserDefaults.standard.integer(forKey: LocationStorage.restartCountKey)
    let windowStart = UserDefaults.standard.double(forKey: LocationStorage.restartWindowStartKey)
    let now = Date().timeIntervalSince1970

    if windowStart > 0 && (now - windowStart) > LocationStorage.restartWindowSeconds {
      // Window expired, reset counter
      UserDefaults.standard.set(0, forKey: LocationStorage.restartCountKey)
      UserDefaults.standard.set(now, forKey: LocationStorage.restartWindowStartKey)
      UserDefaults.standard.synchronize()
      return true
    }

    return count < LocationStorage.maxRestartsPerHour
  }

  @objc public func recordRecoveryAttempt() {
    let count = UserDefaults.standard.integer(forKey: LocationStorage.restartCountKey)
    let windowStart = UserDefaults.standard.double(forKey: LocationStorage.restartWindowStartKey)
    let now = Date().timeIntervalSince1970

    if windowStart == 0 {
      UserDefaults.standard.set(now, forKey: LocationStorage.restartWindowStartKey)
    }

    UserDefaults.standard.set(count + 1, forKey: LocationStorage.restartCountKey)
    UserDefaults.standard.synchronize()
  }

  @objc public func resetRecoveryCounter() {
    UserDefaults.standard.set(0, forKey: LocationStorage.restartCountKey)
    UserDefaults.standard.removeObject(forKey: LocationStorage.restartWindowStartKey)
    UserDefaults.standard.synchronize()
  }

  // MARK: - Cleanup

  @objc public func cleanup() {
    queue.async { [weak self] in
      self?.batchTimer?.cancel()
      self?.batchTimer = nil
      self?.flushBuffer()
    }
  }

  // MARK: - Private

  private func loadNextId() {
    let context = CoreDataStack.shared.newBackgroundContext()
    context.performAndWait {
      let request = NSFetchRequest<NSManagedObject>(entityName: "LocationEntity")
      request.sortDescriptors = [NSSortDescriptor(key: "id", ascending: false)]
      request.fetchLimit = 1

      do {
        if let lastEntity = try context.fetch(request).first,
           let lastId = lastEntity.value(forKey: "id") as? Int64 {
          self.nextId = lastId + 1
        }
      } catch {
        NSLog("[BackgroundLocation] Failed to load next id: \(error)")
      }
    }
  }

  private func startBatchTimer() {
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now() + batchTimeoutSeconds, repeating: batchTimeoutSeconds)
    timer.setEventHandler { [weak self] in
      self?.flushBuffer()
    }
    timer.resume()
    batchTimer = timer
  }

  /// Must be called on `queue`
  private func flushBuffer() {
    guard !buffer.isEmpty else { return }

    let entriesToFlush = buffer
    buffer.removeAll()

    let context = CoreDataStack.shared.newBackgroundContext()
    context.performAndWait {
      guard let entityDescription = NSEntityDescription.entity(forEntityName: "LocationEntity", in: context) else {
        NSLog("[BackgroundLocation] Failed to get LocationEntity description")
        return
      }

      for entry in entriesToFlush {
        let entity = NSManagedObject(entity: entityDescription, insertInto: context)
        entity.setValue(entry.id, forKey: "id")
        entity.setValue(entry.tripId, forKey: "tripId")
        entity.setValue(entry.latitude, forKey: "latitude")
        entity.setValue(entry.longitude, forKey: "longitude")
        entity.setValue(entry.timestamp, forKey: "timestamp")
        entity.setValue(entry.accuracy, forKey: "accuracy")
        entity.setValue(entry.altitude, forKey: "altitude")
        entity.setValue(entry.speed, forKey: "speed")
        entity.setValue(entry.bearing, forKey: "bearing")
        entity.setValue(entry.verticalAccuracyMeters, forKey: "verticalAccuracyMeters")
        entity.setValue(entry.speedAccuracyMetersPerSecond, forKey: "speedAccuracyMetersPerSecond")
        entity.setValue(entry.bearingAccuracyDegrees, forKey: "bearingAccuracyDegrees")
        entity.setValue(entry.provider, forKey: "provider")

        if let isMock = entry.isFromMockProvider {
          entity.setValue(NSNumber(value: isMock), forKey: "isFromMockProvider")
        }
      }

      do {
        try context.save()
      } catch {
        NSLog("[BackgroundLocation] Failed to flush location buffer: \(error)")
      }
    }
  }

  private func entityToDict(_ entity: NSManagedObject) -> [String: Any] {
    var dict: [String: Any] = [:]

    dict["latitude"] = entity.value(forKey: "latitude") as? String ?? "0"
    dict["longitude"] = entity.value(forKey: "longitude") as? String ?? "0"
    dict["timestamp"] = entity.value(forKey: "timestamp") as? Double ?? 0

    let accuracy = entity.value(forKey: "accuracy") as? Double ?? -1
    if accuracy >= 0 {
      dict["accuracy"] = accuracy
    }

    dict["altitude"] = entity.value(forKey: "altitude") as? Double ?? 0

    let speed = entity.value(forKey: "speed") as? Double ?? -1
    if speed >= 0 {
      dict["speed"] = speed
    }

    let bearing = entity.value(forKey: "bearing") as? Double ?? -1
    if bearing >= 0 {
      dict["bearing"] = bearing
    }

    let verticalAccuracy = entity.value(forKey: "verticalAccuracyMeters") as? Double ?? -1
    if verticalAccuracy >= 0 {
      dict["verticalAccuracyMeters"] = verticalAccuracy
    }

    let speedAccuracy = entity.value(forKey: "speedAccuracyMetersPerSecond") as? Double ?? -1
    if speedAccuracy >= 0 {
      dict["speedAccuracyMetersPerSecond"] = speedAccuracy
    }

    let bearingAccuracy = entity.value(forKey: "bearingAccuracyDegrees") as? Double ?? -1
    if bearingAccuracy >= 0 {
      dict["bearingAccuracyDegrees"] = bearingAccuracy
    }

    if let isMock = entity.value(forKey: "isFromMockProvider") as? Bool {
      dict["isFromMockProvider"] = isMock
      dict["provider"] = isMock ? "simulated" : "gps"
    } else {
      dict["provider"] = entity.value(forKey: "provider") as? String ?? "gps"
    }

    return dict
  }
}

// MARK: - Buffer Entry

private struct LocationBufferEntry {
  let id: Int64
  let tripId: String
  let latitude: String
  let longitude: String
  let timestamp: Double
  let accuracy: Double
  let altitude: Double
  let speed: Double
  let bearing: Double
  let verticalAccuracyMeters: Double
  let speedAccuracyMetersPerSecond: Double
  let bearingAccuracyDegrees: Double
  let provider: String?
  let isFromMockProvider: Bool?
}
