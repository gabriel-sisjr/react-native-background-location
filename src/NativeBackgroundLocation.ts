import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Coords {
  latitude: string;
  longitude: string;
  timestamp: number;
}

export interface TrackingStatus {
  active: boolean;
  tripId?: string;
}

export interface Spec extends TurboModule {
  /**
   * Starts location tracking in background for a specific trip
   * @param tripId Optional trip identifier. If omitted, a new one will be generated
   * @returns The effective tripId (received or generated)
   */
  startTracking(tripId?: string): Promise<string>;

  /**
   * Stops all location tracking and terminates the background service
   */
  stopTracking(): Promise<void>;

  /**
   * Checks if location tracking is currently active
   * @returns Object with active status and current tripId if tracking
   */
  isTracking(): Promise<TrackingStatus>;

  /**
   * Retrieves all stored location points for a specific trip
   * @param tripId The trip identifier
   * @returns Array of location coordinates
   */
  getLocations(tripId: string): Promise<Coords[]>;

  /**
   * Clears all stored location data for a specific trip
   * @param tripId The trip identifier to clear
   */
  clearTrip(tripId: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BackgroundLocation');
