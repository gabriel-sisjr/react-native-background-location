import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'React Native Background Location',
  tagline:
    'Cross-platform background location tracking with TurboModules, geofencing, and real-time updates for React Native',
  favicon: 'img/favicon.svg',

  url: 'https://gabriel-sisjr.github.io',
  baseUrl: '/react-native-background-location/',

  organizationName: 'gabriel-sisjr',
  projectName: 'react-native-background-location',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'keywords',
        content:
          'react native, background location, location tracking, geofencing, turbomodule, GPS, foreground service, hooks, android, ios, typescript',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:type',
        content: 'website',
      },
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/gabriel-sisjr/react-native-background-location/tree/develop/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['en'],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
    '@docusaurus/theme-mermaid',
  ],

  themeConfig: {
    image: 'img/social-card.png',
    metadata: [
      {
        name: 'description',
        content:
          'React Native library for background location tracking using TurboModules. Supports Android & iOS with geofencing, real-time updates, crash recovery, and persistent storage.',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
    ],
    navbar: {
      title: 'RN Background Location',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/api-reference/functions',
          label: 'API',
          position: 'left',
        },
        {
          href: 'https://github.com/gabriel-sisjr/react-native-background-location',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/@gabriel-sisjr/react-native-background-location',
          label: 'npm',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/docs/getting-started/introduction' },
            { label: 'API Reference', to: '/docs/api-reference/functions' },
            { label: 'Guides', to: '/docs/guides/background-tracking' },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/gabriel-sisjr/react-native-background-location',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/@gabriel-sisjr/react-native-background-location',
            },
            {
              label: 'Issues',
              href: 'https://github.com/gabriel-sisjr/react-native-background-location/issues',
            },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Gabriel Santana.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['kotlin', 'swift', 'bash', 'json', 'markup', 'typescript', 'tsx', 'jsonc'],
    },
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
