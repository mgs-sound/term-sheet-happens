/**
 * Service wiring. UI code imports `services` from here and never instantiates
 * platform implementations directly — Capacitor builds will swap these
 * constructors and nothing else.
 */

import { WebStorageService, type StorageService } from './StorageService';
import { WebShareService, type ShareService } from './ShareService';
import { NoopHapticsService, type HapticsService } from './HapticsService';

export interface Services {
  storage: StorageService;
  share: ShareService;
  haptics: HapticsService;
}

export const services: Services = {
  storage: new WebStorageService(),
  share: new WebShareService(),
  haptics: new NoopHapticsService(),
};

export type { StorageService, ShareService, HapticsService };
