import Foundation
import CoreData
import CoreLocation

/// Persistent storage for geofence regions and transition events using Core Data
/// Singleton pattern consistent with LocationStorage.swift
@objc public class GeofenceStorage: NSObject {

    @objc public static let shared = GeofenceStorage()

    private let queue = DispatchQueue(label: "com.backgroundlocation.geofencestorage", qos: .userInitiated)

    private override init() {
        super.init()
    }

    // MARK: - Geofence Persistence

    /// Saves a single geofence to Core Data
    @objc public func saveGeofence(_ region: GeofenceRegionMapper.GeofenceRegionData) {
        queue.async {
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                guard let entity = NSEntityDescription.entity(forEntityName: "GeofenceEntity", in: context) else {
                    NSLog("[BackgroundLocation] GeofenceEntity not found in Core Data model")
                    return
                }

                let obj = NSManagedObject(entity: entity, insertInto: context)
                self.populateGeofenceEntity(obj, from: region)

                do {
                    try context.save()
                } catch {
                    NSLog("[BackgroundLocation] Failed to save geofence: \(error)")
                }
            }
        }
    }

    /// Saves a single geofence synchronously (used during batch operations)
    public func saveGeofenceSync(_ region: GeofenceRegionMapper.GeofenceRegionData) {
        queue.sync {
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                guard let entity = NSEntityDescription.entity(forEntityName: "GeofenceEntity", in: context) else {
                    NSLog("[BackgroundLocation] GeofenceEntity not found in Core Data model")
                    return
                }

                let obj = NSManagedObject(entity: entity, insertInto: context)
                self.populateGeofenceEntity(obj, from: region)

                do {
                    try context.save()
                } catch {
                    NSLog("[BackgroundLocation] Failed to save geofence sync: \(error)")
                }
            }
        }
    }

    /// Saves multiple geofences synchronously (atomic batch)
    public func saveGeofencesSync(_ regions: [GeofenceRegionMapper.GeofenceRegionData]) {
        queue.sync {
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                guard let entityDesc = NSEntityDescription.entity(forEntityName: "GeofenceEntity", in: context) else {
                    NSLog("[BackgroundLocation] GeofenceEntity not found in Core Data model")
                    return
                }

                for region in regions {
                    let obj = NSManagedObject(entity: entityDesc, insertInto: context)
                    self.populateGeofenceEntity(obj, from: region)
                }

                do {
                    try context.save()
                } catch {
                    NSLog("[BackgroundLocation] Failed to save geofences batch: \(error)")
                }
            }
        }
    }

    /// Removes a geofence by identifier
    @objc public func removeGeofence(_ identifier: String) {
        queue.async {
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                let request = NSFetchRequest<NSFetchRequestResult>(entityName: "GeofenceEntity")
                request.predicate = NSPredicate(format: "identifier == %@", identifier)
                let deleteRequest = NSBatchDeleteRequest(fetchRequest: request)

                do {
                    try context.execute(deleteRequest)
                    try context.save()
                } catch {
                    NSLog("[BackgroundLocation] Failed to remove geofence: \(error)")
                }
            }
        }
    }

    /// Removes multiple geofences by identifiers
    @objc public func removeGeofences(_ identifiers: [String]) {
        queue.async {
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                let request = NSFetchRequest<NSFetchRequestResult>(entityName: "GeofenceEntity")
                request.predicate = NSPredicate(format: "identifier IN %@", identifiers)
                let deleteRequest = NSBatchDeleteRequest(fetchRequest: request)

                do {
                    try context.execute(deleteRequest)
                    try context.save()
                } catch {
                    NSLog("[BackgroundLocation] Failed to remove geofences: \(error)")
                }
            }
        }
    }

    /// Removes all geofences
    @objc public func removeAllGeofences() {
        queue.async {
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                let request = NSFetchRequest<NSFetchRequestResult>(entityName: "GeofenceEntity")
                let deleteRequest = NSBatchDeleteRequest(fetchRequest: request)

                do {
                    try context.execute(deleteRequest)
                    try context.save()
                } catch {
                    NSLog("[BackgroundLocation] Failed to remove all geofences: \(error)")
                }
            }
        }
    }

    /// Returns all active geofences as dictionaries
    @objc public func getActiveGeofences() -> [[String: Any]] {
        return queue.sync {
            var result: [[String: Any]] = []
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                let request = NSFetchRequest<NSManagedObject>(entityName: "GeofenceEntity")
                request.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: true)]

                do {
                    let entities = try context.fetch(request)
                    result = entities.compactMap { self.geofenceEntityToDict($0) }
                } catch {
                    NSLog("[BackgroundLocation] Failed to fetch geofences: \(error)")
                }
            }
            return result
        }
    }

    /// Returns all active geofences as GeofenceRegionData objects (for recovery)
    @objc public func getActiveGeofenceRegions() -> [GeofenceRegionMapper.GeofenceRegionData] {
        return queue.sync {
            var result: [GeofenceRegionMapper.GeofenceRegionData] = []
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                let request = NSFetchRequest<NSManagedObject>(entityName: "GeofenceEntity")

                do {
                    let entities = try context.fetch(request)
                    result = entities.compactMap { self.geofenceEntityToRegionData($0) }
                } catch {
                    NSLog("[BackgroundLocation] Failed to fetch geofence regions: \(error)")
                }
            }
            return result
        }
    }

    /// Returns a geofence by identifier
    @objc public func getGeofenceByIdentifier(_ identifier: String) -> GeofenceRegionMapper.GeofenceRegionData? {
        return queue.sync {
            var result: GeofenceRegionMapper.GeofenceRegionData? = nil
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                let request = NSFetchRequest<NSManagedObject>(entityName: "GeofenceEntity")
                request.predicate = NSPredicate(format: "identifier == %@", identifier)
                request.fetchLimit = 1

                do {
                    if let entity = try context.fetch(request).first {
                        result = self.geofenceEntityToRegionData(entity)
                    }
                } catch {
                    NSLog("[BackgroundLocation] Failed to fetch geofence by identifier: \(error)")
                }
            }
            return result
        }
    }

    /// Returns the count of active geofences
    @objc public func getGeofenceCount() -> Int {
        return queue.sync {
            var count = 0
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                let request = NSFetchRequest<NSManagedObject>(entityName: "GeofenceEntity")

                do {
                    count = try context.count(for: request)
                } catch {
                    NSLog("[BackgroundLocation] Failed to count geofences: \(error)")
                }
            }
            return count
        }
    }

    // MARK: - Transition Persistence

    /// Saves a geofence transition event
    @objc public func saveTransition(
        geofenceId: String,
        transitionType: String,
        latitude: Double,
        longitude: Double,
        distanceFromCenter: Double,
        timestamp: Date,
        metadata: String?
    ) {
        queue.async {
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                guard let entity = NSEntityDescription.entity(forEntityName: "GeofenceTransitionEntity", in: context) else {
                    NSLog("[BackgroundLocation] GeofenceTransitionEntity not found in Core Data model")
                    return
                }

                let obj = NSManagedObject(entity: entity, insertInto: context)
                obj.setValue(UUID().uuidString, forKey: "id")
                obj.setValue(geofenceId, forKey: "geofenceId")
                obj.setValue(transitionType, forKey: "transitionType")
                obj.setValue(latitude, forKey: "latitude")
                obj.setValue(longitude, forKey: "longitude")
                obj.setValue(distanceFromCenter, forKey: "distanceFromCenter")
                obj.setValue(timestamp, forKey: "timestamp")
                obj.setValue(metadata, forKey: "metadata")

                do {
                    try context.save()
                } catch {
                    NSLog("[BackgroundLocation] Failed to save transition: \(error)")
                }
            }
        }
    }

    /// Returns geofence transitions, optionally filtered by geofence identifier
    @objc public func getTransitions(_ geofenceId: String?) -> [[String: Any]] {
        return queue.sync {
            var result: [[String: Any]] = []
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                let request = NSFetchRequest<NSManagedObject>(entityName: "GeofenceTransitionEntity")
                if let id = geofenceId {
                    request.predicate = NSPredicate(format: "geofenceId == %@", id)
                }
                request.sortDescriptors = [NSSortDescriptor(key: "timestamp", ascending: true)]

                do {
                    let entities = try context.fetch(request)
                    result = entities.compactMap { self.transitionEntityToDict($0) }
                } catch {
                    NSLog("[BackgroundLocation] Failed to fetch transitions: \(error)")
                }
            }
            return result
        }
    }

    /// Clears geofence transitions, optionally filtered by geofence identifier
    @objc public func clearTransitions(_ geofenceId: String?) {
        queue.async {
            let context = CoreDataStack.shared.newBackgroundContext()
            context.performAndWait {
                let request = NSFetchRequest<NSFetchRequestResult>(entityName: "GeofenceTransitionEntity")
                if let id = geofenceId {
                    request.predicate = NSPredicate(format: "geofenceId == %@", id)
                }
                let deleteRequest = NSBatchDeleteRequest(fetchRequest: request)

                do {
                    try context.execute(deleteRequest)
                    try context.save()
                } catch {
                    NSLog("[BackgroundLocation] Failed to clear transitions: \(error)")
                }
            }
        }
    }

    // MARK: - Private Helpers

    private func populateGeofenceEntity(_ obj: NSManagedObject, from region: GeofenceRegionMapper.GeofenceRegionData) {
        obj.setValue(region.identifier, forKey: "identifier")
        obj.setValue(region.latitude, forKey: "latitude")
        obj.setValue(region.longitude, forKey: "longitude")
        obj.setValue(region.radius, forKey: "radius")
        obj.setValue(region.transitionTypes, forKey: "transitionTypes")
        obj.setValue(region.loiteringDelay, forKey: "loiteringDelay")
        if let exp = region.expirationDuration {
            obj.setValue(exp, forKey: "expirationDuration")
        }
        obj.setValue(region.metadata, forKey: "metadata")
        obj.setValue(Date(), forKey: "createdAt")
    }

    private func geofenceEntityToDict(_ entity: NSManagedObject) -> [String: Any]? {
        guard let identifier = entity.value(forKey: "identifier") as? String else { return nil }

        let latitude = entity.value(forKey: "latitude") as? Double ?? 0
        let longitude = entity.value(forKey: "longitude") as? Double ?? 0
        let radius = entity.value(forKey: "radius") as? Double ?? 0
        let transitionTypes = entity.value(forKey: "transitionTypes") as? Int32 ?? 3
        let loiteringDelay = entity.value(forKey: "loiteringDelay") as? Int32 ?? 30000
        let expirationDuration = entity.value(forKey: "expirationDuration") as? NSNumber
        let metadata = entity.value(forKey: "metadata") as? String

        return GeofenceRegionMapper.entityToDict(
            identifier: identifier,
            latitude: latitude,
            longitude: longitude,
            radius: radius,
            transitionTypes: transitionTypes,
            loiteringDelay: loiteringDelay,
            expirationDuration: expirationDuration,
            metadata: metadata
        )
    }

    private func geofenceEntityToRegionData(_ entity: NSManagedObject) -> GeofenceRegionMapper.GeofenceRegionData? {
        guard let identifier = entity.value(forKey: "identifier") as? String else { return nil }

        return GeofenceRegionMapper.GeofenceRegionData(
            identifier: identifier,
            latitude: entity.value(forKey: "latitude") as? Double ?? 0,
            longitude: entity.value(forKey: "longitude") as? Double ?? 0,
            radius: entity.value(forKey: "radius") as? Double ?? 0,
            transitionTypes: entity.value(forKey: "transitionTypes") as? Int32 ?? 3,
            loiteringDelay: entity.value(forKey: "loiteringDelay") as? Int32 ?? 30000,
            expirationDuration: entity.value(forKey: "expirationDuration") as? NSNumber,
            metadata: entity.value(forKey: "metadata") as? String,
            createdAt: entity.value(forKey: "createdAt") as? Date
        )
    }

    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private func transitionEntityToDict(_ entity: NSManagedObject) -> [String: Any]? {
        guard let geofenceId = entity.value(forKey: "geofenceId") as? String else { return nil }

        var dict: [String: Any] = [
            "geofenceId": geofenceId,
            "transitionType": entity.value(forKey: "transitionType") as? String ?? "ENTER",
            "latitude": entity.value(forKey: "latitude") as? Double ?? 0,
            "longitude": entity.value(forKey: "longitude") as? Double ?? 0,
            "distanceFromCenter": entity.value(forKey: "distanceFromCenter") as? Double ?? 0,
        ]

        if let timestamp = entity.value(forKey: "timestamp") as? Date {
            dict["timestamp"] = GeofenceStorage.isoFormatter.string(from: timestamp)
        } else {
            dict["timestamp"] = GeofenceStorage.isoFormatter.string(from: Date())
        }

        if let metadata = entity.value(forKey: "metadata") as? String,
           let metaData = metadata.data(using: .utf8),
           let metaObj = try? JSONSerialization.jsonObject(with: metaData) as? [String: Any] {
            dict["metadata"] = metaObj
        }

        return dict
    }
}
