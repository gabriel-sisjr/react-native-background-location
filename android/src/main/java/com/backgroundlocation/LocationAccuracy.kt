package com.backgroundlocation

/**
 * Enum representing location accuracy priority levels
 * Maps to Android LocationRequest Priority constants
 */
enum class LocationAccuracy(val value: String) {
  HIGH_ACCURACY("HIGH_ACCURACY"),
  BALANCED_POWER_ACCURACY("BALANCED_POWER_ACCURACY"),
  LOW_POWER("LOW_POWER"),
  NO_POWER("NO_POWER"),
  PASSIVE("PASSIVE");

  companion object {
    /**
     * Converts string value to LocationAccuracy enum
     * Returns HIGH_ACCURACY as default if value is invalid
     */
    fun fromString(value: String?): LocationAccuracy {
      return values().find { it.value == value } ?: HIGH_ACCURACY
    }
  }
}

