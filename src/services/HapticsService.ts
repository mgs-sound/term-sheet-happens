/**
 * HapticsService — haptic feedback behind an interface: a no-op on the web,
 * the Taptic Engine via Capacitor Haptics in the shell (wired in ./index.ts).
 *
 * Web implementation is a deliberate no-op (per design doc); the interface
 * still gets called at the right moments, so the native swap is wiring only.
 */

import {
  Haptics,
  ImpactStyle as CapImpactStyle,
  NotificationType as CapNotificationType,
} from '@capacitor/haptics';

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

const IMPACT_STYLES: Record<ImpactStyle, CapImpactStyle> = {
  light: CapImpactStyle.Light,
  medium: CapImpactStyle.Medium,
  heavy: CapImpactStyle.Heavy,
};

const NOTIFICATION_TYPES: Record<NotificationStyle, CapNotificationType> = {
  success: CapNotificationType.Success,
  warning: CapNotificationType.Warning,
  error: CapNotificationType.Error,
};

/** Native haptics. Failures are swallowed: a missed buzz must never break a swipe. */
export class CapacitorHapticsService implements HapticsService {
  /** iOS only ticks on selectionChanged after a selectionStart has primed it. */
  private selectionPrimed = false;

  tap(): Promise<void> {
    return this.impact('light');
  }

  async impact(style: ImpactStyle): Promise<void> {
    try {
      await Haptics.impact({ style: IMPACT_STYLES[style] });
    } catch {
      // Ignore, see class doc.
    }
  }

  async notify(style: NotificationStyle): Promise<void> {
    try {
      await Haptics.notification({ type: NOTIFICATION_TYPES[style] });
    } catch {
      // Ignore, see class doc.
    }
  }

  async selection(): Promise<void> {
    try {
      if (!this.selectionPrimed) {
        await Haptics.selectionStart();
        this.selectionPrimed = true;
      }
      await Haptics.selectionChanged();
    } catch {
      // Ignore, see class doc.
    }
  }
}
