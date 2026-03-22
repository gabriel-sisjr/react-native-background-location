import Foundation
import CoreData

@objc public class CoreDataStack: NSObject {
  @objc public static let shared = CoreDataStack()

  private static let modelName = "BackgroundLocationModel"

  private lazy var persistentContainer: NSPersistentContainer = {
    guard let modelURL = findModelURL(),
          let model = NSManagedObjectModel(contentsOf: modelURL) else {
      fatalError("[BackgroundLocation] Failed to load Core Data model '\(CoreDataStack.modelName)'")
    }

    let container = NSPersistentContainer(name: CoreDataStack.modelName, managedObjectModel: model)

    let description = container.persistentStoreDescriptions.first ?? NSPersistentStoreDescription()
    description.shouldMigrateStoreAutomatically = true
    description.shouldInferMappingModelAutomatically = true
    container.persistentStoreDescriptions = [description]

    container.loadPersistentStores { _, error in
      if let error = error as NSError? {
        NSLog("[BackgroundLocation] Core Data store failed to load: \(error), \(error.userInfo)")
      }
    }

    container.viewContext.automaticallyMergesChangesFromParent = true
    container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy

    return container
  }()

  @objc public var viewContext: NSManagedObjectContext {
    return persistentContainer.viewContext
  }

  @objc public func newBackgroundContext() -> NSManagedObjectContext {
    let context = persistentContainer.newBackgroundContext()
    context.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    return context
  }

  private override init() {
    super.init()
  }

  private func findModelURL() -> URL? {
    let modelName = CoreDataStack.modelName

    // Check all bundles for the .momd (compiled model)
    for bundle in Bundle.allBundles + [Bundle.main] {
      if let url = bundle.url(forResource: modelName, withExtension: "momd") {
        return url
      }
    }

    // Check resource bundles (CocoaPods bundles the model here)
    for bundle in Bundle.allBundles {
      if let resourceBundleURL = bundle.url(forResource: "BackgroundLocationCoreData", withExtension: "bundle"),
         let resourceBundle = Bundle(url: resourceBundleURL),
         let url = resourceBundle.url(forResource: modelName, withExtension: "momd") {
        return url
      }
    }

    // Fallback: search for .mom file directly
    for bundle in Bundle.allBundles + [Bundle.main] {
      if let url = bundle.url(forResource: modelName, withExtension: "mom") {
        return url
      }
    }

    return nil
  }
}
