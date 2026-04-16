import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

const features = [
  {
    title: 'Background Tracking',
    icon: '📍',
    description:
      'Track user location even when the app is minimized. Foreground service on Android, CLLocationManager on iOS.',
  },
  {
    title: 'Geofencing',
    icon: '🚧',
    description:
      'Monitor circular regions with ENTER, EXIT, and DWELL transitions. Up to 100 geofences on Android, 20 on iOS.',
  },
  {
    title: 'TurboModule Performance',
    icon: '⚡',
    description:
      'Built on React Native New Architecture with TurboModules for synchronous, type-safe native communication.',
  },
  {
    title: 'Custom Notifications',
    icon: '🔔',
    description:
      'Fully customizable foreground notifications with action buttons, dynamic updates, and per-platform priority controls.',
  },
  {
    title: 'Cross-Platform',
    icon: '📱',
    description:
      'Unified TypeScript API with platform-specific optimizations. Room DB on Android, Core Data on iOS.',
  },
];

function HeroBanner() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary')}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className="install-command">
          yarn add @gabriel-sisjr/react-native-background-location
        </div>
        <div className="buttons">
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/introduction"
          >
            Get Started
          </Link>
          <Link
            className="button button--lg hero-api-button"
            to="/docs/api-reference/functions"
          >
            API Reference
          </Link>
        </div>
        <div className="badges">
          <img
            alt="npm version"
            src="https://img.shields.io/npm/v/@gabriel-sisjr/react-native-background-location"
          />
          <img
            alt="license"
            src="https://img.shields.io/npm/l/@gabriel-sisjr/react-native-background-location"
          />
          <img
            alt="platforms"
            src="https://img.shields.io/badge/platforms-Android%20%7C%20iOS-blue"
          />
          <img
            alt="new architecture"
            src="https://img.shields.io/badge/New%20Architecture-supported-green"
          />
        </div>
      </div>
    </header>
  );
}

function Feature({
  title,
  icon,
  description,
}: {
  title: string;
  icon: string;
  description: string;
}) {
  return (
    <div className="feature">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section className="features">
      <div className="container">
        <div className="row">
          {features.map((props, idx) => (
            <div key={idx} className={clsx('col col--3')}>
              <Feature {...props} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HooksPreview() {
  return (
    <section style={{ padding: '3rem 0', background: 'var(--ifm-color-emphasis-100)' }}>
      <div className="container">
        <div className="row">
          <div className="col col--6">
            <Heading as="h2">React Hooks API</Heading>
            <p>
              7 purpose-built hooks for every location use case. From simple
              tracking status to real-time event streams and geofence
              management.
            </p>
            <ul>
              <li>
                <code>useBackgroundLocation</code> &mdash; Full tracking control
              </li>
              <li>
                <code>useLocationUpdates</code> &mdash; Real-time location stream
              </li>
              <li>
                <code>useLocationPermissions</code> &mdash; Permission management
              </li>
              <li>
                <code>useGeofencing</code> &mdash; Geofence CRUD operations
              </li>
              <li>
                <code>useGeofenceEvents</code> &mdash; Transition event listener
              </li>
            </ul>
            <Link
              className="button button--primary"
              to="/docs/api-reference/hooks/useBackgroundLocation"
            >
              Explore Hooks
            </Link>
          </div>
          <div className="col col--6">
            <pre
              style={{
                padding: '1.5rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                overflow: 'auto',
              }}
            >
              <code>{`import {
  useBackgroundLocation,
  useLocationPermissions,
} from '@gabriel-sisjr/react-native-background-location';

function TrackingScreen() {
  const { requestPermissions } = useLocationPermissions();
  const { isTracking, startTracking, stopTracking, locations } =
    useBackgroundLocation();

  const handleStart = async () => {
    await requestPermissions();
    await startTracking({ distanceFilter: 50 });
  };

  return (
    <View>
      <Text>Status: {isTracking ? 'Active' : 'Idle'}</Text>
      <Text>Locations: {locations.length}</Text>
      <Button
        title={isTracking ? 'Stop' : 'Start'}
        onPress={isTracking ? stopTracking : handleStart}
      />
    </View>
  );
}`}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description={siteConfig.tagline}
    >
      <HeroBanner />
      <main>
        <FeaturesSection />
        <HooksPreview />
      </main>
    </Layout>
  );
}
