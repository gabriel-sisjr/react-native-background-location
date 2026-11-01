package com.backgroundlocation.motion

import org.junit.Assert.assertEquals
import org.junit.Test

class MotionPermissionsTest {

  @Test
  fun `API 28 and older require the Play services permission`() {
    for (sdkInt in listOf(24, 26, 28)) {
      assertEquals(
        "com.google.android.gms.permission.ACTIVITY_RECOGNITION",
        MotionPermissions.requiredPermission(sdkInt)
      )
    }
  }

  @Test
  fun `API 29 and newer require the platform permission`() {
    for (sdkInt in listOf(29, 31, 34, 36)) {
      assertEquals("android.permission.ACTIVITY_RECOGNITION", MotionPermissions.requiredPermission(sdkInt))
    }
  }

  @Test
  fun `status is unavailable without Play services, otherwise granted or denied`() {
    assertEquals(MotionPermissionStatus.UNAVAILABLE, MotionPermissions.status(playServicesAvailable = false, granted = true))
    assertEquals(MotionPermissionStatus.UNAVAILABLE, MotionPermissions.status(playServicesAvailable = false, granted = false))
    assertEquals(MotionPermissionStatus.GRANTED, MotionPermissions.status(playServicesAvailable = true, granted = true))
    assertEquals(MotionPermissionStatus.DENIED, MotionPermissions.status(playServicesAvailable = true, granted = false))
  }

  @Test
  fun `status wire values match the TypeScript enum`() {
    assertEquals(
      listOf("granted", "denied", "undetermined", "unavailable"),
      MotionPermissionStatus.entries.map { it.wireValue }
    )
  }

  @Test
  fun `the not-granted warning names the permission of the API level`() {
    assertEquals(
      "ACTIVITY_RECOGNITION permission is not granted. Call requestMotionPermission() before startTracking(). " +
        "Location tracking continues at full accuracy.",
      MotionPermissions.notGrantedMessage(29)
    )
    assertEquals(
      "com.google.android.gms.permission.ACTIVITY_RECOGNITION is not declared in AndroidManifest.xml. " +
        "Location tracking continues at full accuracy.",
      MotionPermissions.notGrantedMessage(28)
    )
  }
}
