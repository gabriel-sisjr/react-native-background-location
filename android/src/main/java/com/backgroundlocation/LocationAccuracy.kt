package com.backgroundlocation

/**
 * Enum representing location accuracy priority levels
 * Maps to Android LocationRequest Priority constants
 *
 * Uses Kotlin's built-in [Enum.name] for serialization — the enum constant
 * name IS the string passed across the bridge (e.g. "HIGH_ACCURACY").
 */
enum class LocationAccuracy {
  HIGH_ACCURACY,
  BALANCED_POWER_ACCURACY,
  LOW_POWER,
  NO_POWER,
  PASSIVE;

  companion object {
    /**
     * Converts string value to LocationAccuracy enum
     * Returns HIGH_ACCURACY as default if value is invalid
     */
    fun fromString(value: String?): LocationAccuracy {
      return entries.find { it.name == value } ?: HIGH_ACCURACY
    }
  }
}

