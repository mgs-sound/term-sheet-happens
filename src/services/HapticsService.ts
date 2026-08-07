/**
 * HapticsService — haptic feedback behind an interface so Capacitor Haptics
 * can replace it later without touching game or UI code.
 *
 * Web implementation is a deliberate no-op (per design doc); the interface
 * still gets called at the right moments so the native swap is wiring only.
 */

export type ImpactStyle = 'light' | 'medium' | 'heavy';
export type NotificationStyle = 'success' | 'warning' | 'error';

export interface HapticsService {
  /** The default beat: stamp commits, signings. Alias for a light impact. */
  tap(): Promise<void>;
  /** Physical tap, e.g. card leaves the deck, stamp lands. */
  impact(style: ImpactStyle): Promise<void>;
  /** Semantic buzz, e.g. exit lands (success) or founder walks (error). */
  notify(style: NotificationStyle): Promise<void>;
  /** Tiny tick for slider detents. */
  selection(): Promise<void>;
}

export class NoopHapticsService implements HapticsService {
  async tap(): Promise<void> {}
  async impact(): Promise<void> {}
  async notify(): Promise<void> {}
  async selection(): Promise<void> {}
}
