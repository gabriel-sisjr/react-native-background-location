#import "BackgroundLocation.h"
#import <CoreLocation/CoreLocation.h>
#import <UserNotifications/UserNotifications.h>
#import <React/RCTBridge.h>

#if __has_include("BackgroundLocation-Swift.h")
#import "BackgroundLocation-Swift.h"
#else
#import <BackgroundLocation/BackgroundLocation-Swift.h>
#endif

@implementation BackgroundLocation

@synthesize bridge = _bridge;

// MARK: - Lifecycle

- (instancetype)init
{
  self = [super init];
  if (self) {
    // Attempt crash recovery on module initialization
    dispatch_async(dispatch_get_main_queue(), ^{
      [self performRecoveryCheck];
    });
  }
  return self;
}

- (void)performRecoveryCheck
{
  [self configureEventEmitters];
  [[RecoveryManager shared] attemptRecoveryIfNeeded];

  // If recovery resumed tracking, register lifecycle observers
  NSDictionary *trackingStatus = [[LocationManagerWrapper shared] isTracking];
  BOOL isActive = [trackingStatus[@"active"] boolValue];
  if (isActive) {
    [self registerLifecycleObservers];
  }

  // Restore geofences after crash/restart
  [[GeofenceManager shared] restoreGeofences];
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)registerLifecycleObservers
{
  // Remove any existing observers first to avoid duplicates
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:UIApplicationDidEnterBackgroundNotification
                                                object:nil];
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:UIApplicationWillEnterForegroundNotification
                                                object:nil];
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:UIApplicationDidBecomeActiveNotification
                                                object:nil];

  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handleAppDidEnterBackground:)
                                               name:UIApplicationDidEnterBackgroundNotification
                                             object:nil];
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handleAppWillEnterForeground:)
                                               name:UIApplicationWillEnterForegroundNotification
                                             object:nil];
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handleAppDidBecomeActive:)
                                               name:UIApplicationDidBecomeActiveNotification
                                             object:nil];
}

- (void)unregisterLifecycleObservers
{
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:UIApplicationDidEnterBackgroundNotification
                                                object:nil];
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:UIApplicationWillEnterForegroundNotification
                                                object:nil];
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:UIApplicationDidBecomeActiveNotification
                                                object:nil];
}

- (void)handleAppDidEnterBackground:(NSNotification *)notification
{
  [[LocationManagerWrapper shared] pauseTrackingForBackground];
}

- (void)handleAppWillEnterForeground:(NSNotification *)notification
{
  [[LocationManagerWrapper shared] resumeTrackingFromBackground];
}

- (void)handleAppDidBecomeActive:(NSNotification *)notification
{
  // Scheduled recovery on app resume (matches Android onHostResume pattern)
  NSDictionary *trackingStatus = [[LocationManagerWrapper shared] isTracking];
  BOOL isActive = [trackingStatus[@"active"] boolValue];
  if (!isActive) {
    [[RecoveryManager shared] attemptRecoveryIfNeeded];

    // If recovery started tracking, register lifecycle observers
    NSDictionary *statusAfterRecovery = [[LocationManagerWrapper shared] isTracking];
    if ([statusAfterRecovery[@"active"] boolValue]) {
      [self configureEventEmitters];
      [self registerLifecycleObservers];
    }
  }
}

// MARK: - Options Parsing

- (NSDictionary *)optionsDictionaryFrom:(JS::NativeBackgroundLocation::TrackingOptionsSpec &)options
{
  NSMutableDictionary *dict = [NSMutableDictionary new];

  NSString *accuracy = options.accuracy();
  if (accuracy) {
    dict[@"accuracy"] = accuracy;
  }

  auto distanceFilter = options.distanceFilter();
  if (distanceFilter.has_value()) {
    dict[@"distanceFilter"] = @(distanceFilter.value());
  }

  auto updateInterval = options.updateInterval();
  if (updateInterval.has_value()) {
    dict[@"updateInterval"] = @(updateInterval.value());
  }

  auto foregroundOnly = options.foregroundOnly();
  if (foregroundOnly.has_value()) {
    dict[@"foregroundOnly"] = @(foregroundOnly.value());
  }

  auto waitForAccurateLocation = options.waitForAccurateLocation();
  if (waitForAccurateLocation.has_value()) {
    dict[@"waitForAccurateLocation"] = @(waitForAccurateLocation.value());
  }

  // Notification options — no-op on iOS (no foreground service notification concept)
  // Passed through as JSON string to avoid crashes when consumers pass Android notification options
  NSString *notificationOptions = options.notificationOptions();
  if (notificationOptions) {
    dict[@"notificationOptions"] = notificationOptions;
  }

  return dict;
}

- (void)emitEventWithName:(NSString *)name body:(NSDictionary *)body
{
  if (_bridge) {
    [_bridge enqueueJSCall:@"RCTDeviceEventEmitter"
                    method:@"emit"
                      args:@[name, body ?: [NSNull null]]
                completion:nil];
  }
}

- (void)configureEventEmitters
{
  __weak __typeof(self) weakSelf = self;

  [LocationManagerWrapper shared].onLocationUpdate = ^(NSDictionary *eventData) {
    [weakSelf emitEventWithName:@"onLocationUpdate" body:eventData];
  };

  [LocationManagerWrapper shared].onLocationWarning = ^(NSDictionary *eventData) {
    [weakSelf emitEventWithName:@"onLocationWarning" body:eventData];
  };

  [GeofenceEventBroadcaster shared].onGeofenceTransition = ^(NSDictionary *eventData) {
    [weakSelf emitEventWithName:@"onGeofenceTransition" body:eventData];
  };
}

- (void)startTracking:(NSString *)tripId
              options:(JS::NativeBackgroundLocation::TrackingOptionsSpec &)options
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  @try {
    // Check permission before starting
    NSDictionary *permStatus = [[LocationManagerWrapper shared] checkLocationPermission];
    NSString *status = permStatus[@"status"];
    if ([status isEqualToString:@"denied"] || [status isEqualToString:@"blocked"]) {
      reject(@"PERMISSION_DENIED", @"Location permission is not granted. Request permission before starting tracking.", nil);
      return;
    }

    [self configureEventEmitters];

    NSDictionary *optionsDict = [self optionsDictionaryFrom:options];
    TrackingOptions *trackingOptions = [[TrackingOptions alloc] initWithDictionary:optionsDict];

    // Register for app lifecycle notifications (foregroundOnly mode support)
    __weak __typeof(self) weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{
      [weakSelf registerLifecycleObservers];
    });

    NSString *resultTripId = [[LocationManagerWrapper shared] startTrackingWithTripId:tripId
                                                                              options:trackingOptions];
    resolve(resultTripId);
  } @catch (NSException *exception) {
    reject(@"START_TRACKING_ERROR", [NSString stringWithFormat:@"Failed to start tracking: %@", exception.reason], nil);
  }
}

- (void)stopTracking:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  @try {
    // Force flush any buffered locations before stopping
    [[LocationStorage shared] forceFlush];

    // Unregister lifecycle observers before stopping
    __weak __typeof(self) weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{
      [weakSelf unregisterLifecycleObservers];
    });

    [[LocationManagerWrapper shared] stopTracking];
    resolve(nil);
  } @catch (NSException *exception) {
    reject(@"STOP_TRACKING_ERROR", [NSString stringWithFormat:@"Failed to stop tracking: %@", exception.reason], nil);
  }
}

- (void)isTracking:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  @try {
    NSDictionary *status = [[LocationManagerWrapper shared] isTracking];
    resolve(status);
  } @catch (NSException *exception) {
    reject(@"IS_TRACKING_ERROR", [NSString stringWithFormat:@"Failed to get tracking state: %@", exception.reason], nil);
  }
}

- (void)getLocations:(NSString *)tripId
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  if (!tripId || [tripId length] == 0) {
    reject(@"INVALID_TRIP_ID", @"Trip ID cannot be empty", nil);
    return;
  }

  @try {
    NSArray *locations = [[LocationManagerWrapper shared] getLocationsWithTripId:tripId];
    resolve(locations);
  } @catch (NSException *exception) {
    reject(@"GET_LOCATIONS_ERROR", [NSString stringWithFormat:@"Failed to get locations: %@", exception.reason], nil);
  }
}

- (void)clearTrip:(NSString *)tripId
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  if (!tripId || [tripId length] == 0) {
    reject(@"INVALID_TRIP_ID", @"Trip ID cannot be empty", nil);
    return;
  }

  @try {
    [[LocationManagerWrapper shared] clearTripWithTripId:tripId];
    resolve(nil);
  } @catch (NSException *exception) {
    reject(@"CLEAR_TRIP_ERROR", [NSString stringWithFormat:@"Failed to clear trip: %@", exception.reason], nil);
  }
}

- (void)updateNotification:(NSString *)title
                      text:(NSString *)text
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  // No-op on iOS: no foreground service notification concept
  resolve(nil);
}

- (void)checkLocationPermission:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  @try {
    NSDictionary *result = [[LocationManagerWrapper shared] checkLocationPermission];
    resolve(result);
  } @catch (NSException *exception) {
    reject(@"CHECK_PERMISSION_ERROR", [NSString stringWithFormat:@"Failed to check permission: %@", exception.reason], nil);
  }
}

- (void)addListener:(NSString *)eventName
{
  // Required by NativeEventEmitter — no-op on iOS (events emitted via RCTDeviceEventEmitter)
}

- (void)removeListeners:(double)count
{
  // Required by NativeEventEmitter — no-op
}

- (void)requestLocationPermission:(BOOL)foregroundOnly
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
  @try {
    [[LocationManagerWrapper shared] requestLocationPermissionWithForegroundOnly:foregroundOnly completion:^(NSDictionary * _Nonnull result) {
      resolve(result);
    }];
  } @catch (NSException *exception) {
    reject(@"REQUEST_PERMISSION_ERROR", [NSString stringWithFormat:@"Failed to request permission: %@", exception.reason], nil);
  }
}

// MARK: - Notification Permission Methods

- (void)checkNotificationPermission:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject
{
  [[UNUserNotificationCenter currentNotificationCenter] getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings * _Nonnull settings) {
    NSString *status;
    switch (settings.authorizationStatus) {
      case UNAuthorizationStatusAuthorized:
      case UNAuthorizationStatusProvisional:
      case UNAuthorizationStatusEphemeral:
        status = @"granted";
        break;
      case UNAuthorizationStatusDenied:
        status = @"denied";
        break;
      case UNAuthorizationStatusNotDetermined:
      default:
        status = @"undetermined";
        break;
    }
    resolve(status);
  }];
}

- (void)requestNotificationPermission:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject
{
  [[UNUserNotificationCenter currentNotificationCenter] requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
                                                                     completionHandler:^(BOOL granted, NSError * _Nullable error) {
    if (granted) {
      resolve(@"granted");
    } else {
      resolve(@"denied");
    }
  }];
}

// MARK: - Geofencing Methods

- (void)addGeofence:(NSString *)regionJson
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [[GeofenceManager shared] addGeofenceWithRegionJson:regionJson
                                              resolve:^(id result) { resolve(result); }
                                               reject:^(NSString *code, NSString *message, NSError *error) { reject(code, message, error); }];
}

- (void)addGeofences:(NSString *)regionsJson
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [[GeofenceManager shared] addGeofencesWithRegionsJson:regionsJson
                                                resolve:^(id result) { resolve(result); }
                                                 reject:^(NSString *code, NSString *message, NSError *error) { reject(code, message, error); }];
}

- (void)removeGeofence:(NSString *)identifier
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[GeofenceManager shared] removeGeofenceWithIdentifier:identifier
                                                 resolve:^(id result) { resolve(result); }
                                                  reject:^(NSString *code, NSString *message, NSError *error) { reject(code, message, error); }];
}

- (void)removeGeofences:(NSString *)identifiersJson
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  [[GeofenceManager shared] removeGeofencesWithIdentifiersJson:identifiersJson
                                                       resolve:^(id result) { resolve(result); }
                                                        reject:^(NSString *code, NSString *message, NSError *error) { reject(code, message, error); }];
}

- (void)removeAllGeofences:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  [[GeofenceManager shared] removeAllGeofencesWithResolve:^(id result) { resolve(result); }
                                                   reject:^(NSString *code, NSString *message, NSError *error) { reject(code, message, error); }];
}

- (void)getActiveGeofences:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  [[GeofenceManager shared] getActiveGeofencesWithResolve:^(id result) { resolve(result); }
                                                   reject:^(NSString *code, NSString *message, NSError *error) { reject(code, message, error); }];
}

- (void)getMaxGeofences:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  [[GeofenceManager shared] getMaxGeofencesWithResolve:^(id result) { resolve(result); }
                                                reject:^(NSString *code, NSString *message, NSError *error) { reject(code, message, error); }];
}

- (void)getGeofenceTransitions:(NSString *)identifier
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  [[GeofenceManager shared] getGeofenceTransitionsWithIdentifier:identifier
                                                         resolve:^(id result) { resolve(result); }
                                                          reject:^(NSString *code, NSString *message, NSError *error) { reject(code, message, error); }];
}

- (void)clearGeofenceTransitions:(NSString *)identifier
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject
{
  [[GeofenceManager shared] clearGeofenceTransitionsWithIdentifier:identifier
                                                           resolve:^(id result) { resolve(result); }
                                                            reject:^(NSString *code, NSString *message, NSError *error) { reject(code, message, error); }];
}

- (void)configureGeofenceNotifications:(NSString *)configJson
                               resolve:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject
{
  GeofenceNotificationConfig *config = [GeofenceNotificationConfig fromJsonString:configJson];
  if (config) {
    [[GeofenceNotificationConfigStore shared] save:config];
    resolve(nil);
  } else {
    reject(@"CONFIG_ERROR", @"Failed to parse notification config", nil);
  }
}

- (void)getGeofenceNotificationConfig:(RCTPromiseResolveBlock)resolve
                               reject:(RCTPromiseRejectBlock)reject
{
  GeofenceNotificationConfig *config = [[GeofenceNotificationConfigStore shared] load];
  resolve([config toJsonString]);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeBackgroundLocationSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"BackgroundLocation";
}

@end
