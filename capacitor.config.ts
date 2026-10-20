import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell config. The web build in `dist/` is copied into the iOS
 * project by `npx cap sync ios`; nothing here changes the web deploy.
 */
const config: CapacitorConfig = {
  // Reverse of termsheethappens.game. Must match the App Store Connect record.
  appId: 'game.termsheethappens',
  appName: 'Term Sheet Happens',
  webDir: 'dist',
  // Paper, so there's no white flash before the first paint.
  backgroundColor: '#F7F5EE',
  ios: {
    // The web view runs edge to edge; the CSS handles env(safe-area-inset-*).
    contentInset: 'never',
    // No rubber-band on the page itself; inner overflow containers still scroll.
    scrollEnabled: false,
  },
};

export default config;
