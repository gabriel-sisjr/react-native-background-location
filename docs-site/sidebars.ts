import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/introduction',
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/ios-setup',
        'getting-started/permissions',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/background-tracking',
        'guides/real-time-updates',
        'guides/geofencing',
        'guides/geofencing-advanced',
        'guides/notification-customization',
        'guides/permission-handling',
        'guides/crash-recovery',
        'guides/battery-optimization',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api-reference/functions',
        'api-reference/geofencing-functions',
        {
          type: 'category',
          label: 'Hooks',
          items: [
            'api-reference/hooks/useBackgroundLocation',
            'api-reference/hooks/useLocationTracking',
            'api-reference/hooks/useLocationUpdates',
            'api-reference/hooks/useLocationPermissions',
            'api-reference/hooks/useGeofencing',
            'api-reference/hooks/useGeofenceEvents',
          ],
        },
        'api-reference/types',
        'api-reference/enums',
        'api-reference/errors',
      ],
    },
    {
      type: 'category',
      label: 'Production',
      items: [
        'production/google-play-compliance',
        'production/app-store-compliance',
        'production/platform-comparison',
        'production/ios-background-behavior',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/data-flow',
        'architecture/android-native',
        'architecture/ios-native',
      ],
    },
    {
      type: 'category',
      label: 'Migration',
      items: ['migration/v0-14-0', 'migration/v0-12-0'],
    },
    {
      type: 'category',
      label: 'Development',
      items: [
        'development/contributing',
        'development/testing',
        'development/ci-cd',
        'development/publishing',
        'development/debugging',
      ],
    },
    'troubleshooting',
  ],
};

export default sidebars;
