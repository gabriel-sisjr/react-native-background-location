require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "BackgroundLocation"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => '16.0' }
  s.source       = { :git => "https://github.com/gabriel-sisjr/react-native-background-location.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.private_header_files = "ios/**/*.h"

  # Motion activity (CoreMotion) is compiled in only when the app's Podfile sets
  # `$BackgroundLocationMotionActivity = true` before its first `target`.
  motion_activity = defined?($BackgroundLocationMotionActivity) && $BackgroundLocationMotionActivity == true
  s.frameworks = motion_activity ? ["CoreLocation", "CoreData", "CoreMotion"] : ["CoreLocation", "CoreData"]
  # Must be set before install_modules_dependencies(s), which merges and then reassigns pod_target_xcconfig.
  s.pod_target_xcconfig = { "OTHER_SWIFT_FLAGS" => "$(inherited) -DBACKGROUND_LOCATION_MOTION" } if motion_activity

  s.resource_bundles = {
    'BackgroundLocationPrivacy' => ['ios/PrivacyInfo.xcprivacy'],
    'BackgroundLocationCoreData' => ['ios/Database/BackgroundLocationModel.xcdatamodeld']
  }

  install_modules_dependencies(s)
end
