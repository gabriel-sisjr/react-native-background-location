package com.backgroundlocation

import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory

/**
 * Resolves default notification icon, large icon, and color from static configuration.
 *
 * Resolution chain (highest to lowest priority):
 * 1. Runtime TrackingOptions value (handled by caller)
 * 2. AndroidManifest <meta-data> (e.g., com.backgroundlocation.default_notification_icon)
 * 3. Conventional drawable name (e.g., bg_location_notification_icon)
 * 4. Android system default (ic_menu_mylocation)
 *
 * Usage by consuming app (AndroidManifest.xml):
 *   <meta-data android:name="com.backgroundlocation.default_notification_icon"
 *              android:resource="@drawable/ic_notification" />
 *   <meta-data android:name="com.backgroundlocation.default_notification_large_icon"
 *              android:resource="@drawable/ic_logo_large" />
 *   <meta-data android:name="com.backgroundlocation.default_notification_color"
 *              android:resource="@color/notification_accent" />
 *
 * Or simply place a drawable named "bg_location_notification_icon" in res/drawable/.
 */
object NotificationDefaults {

    private const val META_SMALL_ICON = "com.backgroundlocation.default_notification_icon"
    private const val META_LARGE_ICON = "com.backgroundlocation.default_notification_large_icon"
    private const val META_COLOR = "com.backgroundlocation.default_notification_color"

    private const val CONVENTION_SMALL_ICON = "bg_location_notification_icon"
    private const val CONVENTION_LARGE_ICON = "bg_location_notification_large_icon"

    private const val SYSTEM_DEFAULT_ICON = android.R.drawable.ic_menu_mylocation

    // Cached values (-1 = not resolved yet, 0 = not found)
    @Volatile private var cachedSmallIcon: Int = -1
    @Volatile private var cachedLargeIcon: Int = -1
    @Volatile private var cachedColor: Int? = null
    @Volatile private var colorResolved: Boolean = false

    /**
     * Resolves the small icon resource ID.
     * @param context Application context
     * @param runtimeOverride Optional runtime override from TrackingOptions (drawable name)
     * @return Resolved drawable resource ID
     */
    fun getSmallIcon(context: Context, runtimeOverride: String? = null): Int {
        // Priority 1: Runtime override
        runtimeOverride?.let { iconName ->
            val resId = context.resources.getIdentifier(iconName, "drawable", context.packageName)
            if (resId != 0) return resId
            android.util.Log.w("NotificationDefaults", "Drawable resource '$iconName' not found, falling through to defaults")
        }

        // Return cached if already resolved
        if (cachedSmallIcon != -1) return if (cachedSmallIcon != 0) cachedSmallIcon else SYSTEM_DEFAULT_ICON

        // Priority 2: AndroidManifest <meta-data>
        val metaIcon = getMetaDataResource(context, META_SMALL_ICON)
        if (metaIcon != 0) {
            cachedSmallIcon = metaIcon
            android.util.Log.d("NotificationDefaults", "Using small icon from AndroidManifest meta-data")
            return metaIcon
        }

        // Priority 3: Conventional drawable name
        val conventionIcon = context.resources.getIdentifier(CONVENTION_SMALL_ICON, "drawable", context.packageName)
        if (conventionIcon != 0) {
            cachedSmallIcon = conventionIcon
            android.util.Log.d("NotificationDefaults", "Using small icon from convention: $CONVENTION_SMALL_ICON")
            return conventionIcon
        }

        // Priority 4: System default
        cachedSmallIcon = 0
        return SYSTEM_DEFAULT_ICON
    }

    /**
     * Resolves the large icon as a Bitmap.
     * @param context Application context
     * @param runtimeOverride Optional runtime override from TrackingOptions (drawable name)
     * @return Bitmap or null if no large icon configured
     */
    fun getLargeIcon(context: Context, runtimeOverride: String? = null): Bitmap? {
        // Priority 1: Runtime override
        runtimeOverride?.let { iconName ->
            val resId = context.resources.getIdentifier(iconName, "drawable", context.packageName)
            if (resId != 0) return BitmapFactory.decodeResource(context.resources, resId)
            android.util.Log.w("NotificationDefaults", "Large icon drawable '$iconName' not found, falling through to defaults")
        }

        // Return cached if already resolved
        if (cachedLargeIcon != -1) {
            return if (cachedLargeIcon != 0) BitmapFactory.decodeResource(context.resources, cachedLargeIcon) else null
        }

        // Priority 2: AndroidManifest <meta-data>
        val metaIcon = getMetaDataResource(context, META_LARGE_ICON)
        if (metaIcon != 0) {
            cachedLargeIcon = metaIcon
            return BitmapFactory.decodeResource(context.resources, metaIcon)
        }

        // Priority 3: Conventional drawable name
        val conventionIcon = context.resources.getIdentifier(CONVENTION_LARGE_ICON, "drawable", context.packageName)
        if (conventionIcon != 0) {
            cachedLargeIcon = conventionIcon
            return BitmapFactory.decodeResource(context.resources, conventionIcon)
        }

        // No large icon configured
        cachedLargeIcon = 0
        return null
    }

    /**
     * Resolves the notification accent color.
     * @param context Application context
     * @param runtimeOverride Optional runtime override from TrackingOptions (hex string)
     * @return Color integer or null if no color configured
     */
    fun getColor(context: Context, runtimeOverride: String? = null): Int? {
        // Priority 1: Runtime override
        runtimeOverride?.let { colorHex ->
            return try {
                android.graphics.Color.parseColor(colorHex)
            } catch (e: IllegalArgumentException) {
                android.util.Log.w("NotificationDefaults", "Invalid notification color '$colorHex', falling through to defaults")
                null
            }
        }

        // Return cached if already resolved
        if (colorResolved) return cachedColor

        // Priority 2: AndroidManifest <meta-data>
        val metaColor = getMetaDataResource(context, META_COLOR)
        if (metaColor != 0) {
            return try {
                val color = context.resources.getColor(metaColor, context.theme)
                cachedColor = color
                colorResolved = true
                color
            } catch (e: Exception) {
                android.util.Log.w("NotificationDefaults", "Failed to resolve color resource from meta-data", e)
                colorResolved = true
                null
            }
        }

        colorResolved = true
        return null
    }

    /**
     * Reads a resource ID from AndroidManifest <meta-data>.
     */
    private fun getMetaDataResource(context: Context, key: String): Int {
        return try {
            val appInfo = context.packageManager.getApplicationInfo(
                context.packageName, PackageManager.GET_META_DATA
            )
            appInfo.metaData?.getInt(key, 0) ?: 0
        } catch (e: Exception) {
            android.util.Log.w("NotificationDefaults", "Failed to read meta-data '$key'", e)
            0
        }
    }
}
