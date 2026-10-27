package com.backgroundlocation.motion

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Looper
import androidx.core.content.ContextCompat
import com.backgroundlocation.BuildConfig
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability

/**
 * Pure permission rules of the motion activity feature.
 *
 * Android 10+ (API 29) needs the runtime `android.permission.ACTIVITY_RECOGNITION`.
 * Android 9 and older need the install-time Play services permission instead, which the
 * app must declare (`android:maxSdkVersion="28"`). The library manifest declares neither.
 */
internal object MotionPermissions {
  const val PLATFORM_PERMISSION = "android.permission.ACTIVITY_RECOGNITION"
  const val PLAY_SERVICES_PERMISSION = "com.google.android.gms.permission.ACTIVITY_RECOGNITION"

  /** First API level of the runtime platform permission. */
  const val PLATFORM_PERMISSION_MIN_SDK = 29

  /** Permission that gates Activity Recognition on [sdkInt]. */
  fun requiredPermission(sdkInt: Int): String =
    if (sdkInt >= PLATFORM_PERMISSION_MIN_SDK) PLATFORM_PERMISSION else PLAY_SERVICES_PERMISSION

  /** Status reported by `checkMotionPermission()`; Android never reports UNDETERMINED. */
  fun status(playServicesAvailable: Boolean, granted: Boolean): MotionPermissionStatus = when {
    !playServicesAvailable -> MotionPermissionStatus.UNAVAILABLE
    granted -> MotionPermissionStatus.GRANTED
    else -> MotionPermissionStatus.DENIED
  }

  /** Warning message when [requiredPermission] is not granted on [sdkInt]. */
  fun notGrantedMessage(sdkInt: Int): String =
    if (sdkInt >= PLATFORM_PERMISSION_MIN_SDK) {
      MotionWarnings.PLATFORM_PERMISSION_NOT_GRANTED
    } else {
      MotionWarnings.PLAY_SERVICES_PERMISSION_NOT_DECLARED
    }
}

/** [MotionPlatform] backed by the device. Creates no Activity Recognition client. */
internal class AndroidMotionPlatform(private val context: Context) : MotionPlatform {
  override val sdkInt: Int
    get() = Build.VERSION.SDK_INT

  override fun isPlayServicesAvailable(): Boolean =
    try {
      GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
    } catch (e: Exception) {
      false
    }

  override fun isGranted(permission: String): Boolean =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

  override fun assertMainThread() {
    if (BuildConfig.DEBUG) {
      check(Looper.myLooper() == Looper.getMainLooper()) { "Motion activity work must run on the main thread" }
    }
  }

  /** Status reported by `checkMotionPermission()` / `requestMotionPermission()`. */
  fun permissionStatus(): MotionPermissionStatus {
    if (!isPlayServicesAvailable()) return MotionPermissionStatus.UNAVAILABLE
    return MotionPermissions.status(
      playServicesAvailable = true,
      granted = isGranted(MotionPermissions.requiredPermission(sdkInt))
    )
  }
}
