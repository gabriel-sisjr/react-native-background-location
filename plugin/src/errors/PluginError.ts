export type PluginErrorCode =
  | 'INVALID_PROPS_TYPE'
  | 'UNKNOWN_PROP'
  | 'INVALID_USAGE_DESCRIPTION'
  | 'INVALID_TEMPORARY_USAGE_DESCRIPTIONS'
  | 'INVALID_TEMPORARY_USAGE_DESCRIPTION_VALUE'
  | 'INVALID_MOTION_ACTIVITY'
  | 'NEW_ARCHITECTURE_DISABLED';

export class PluginError extends Error {
  readonly code: PluginErrorCode;
  readonly detail?: unknown;

  constructor(code: PluginErrorCode, message: string, detail?: unknown) {
    super(`[react-native-background-location/plugin] ${code}: ${message}`);
    this.name = 'PluginError';
    this.code = code;
    this.detail = detail;
  }
}
