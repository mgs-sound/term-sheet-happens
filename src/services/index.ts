/**
 * Service wiring. UI code imports `services` from here and never instantiates
 * platform implementations directly. This is the one place that knows whether
 * it's running in the Capacitor shell or a browser.
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorStorageService, WebStorageService, type StorageService } from './StorageService';
import { CapacitorShareService, WebShareService, type ShareService } from './ShareService';
import {
  CapacitorHapticsService,
  NoopHapticsService,
  type HapticsService,
} from './HapticsService';
import { WebAudioService, type AudioService, type SfxId } from './AudioService';

export interface Services {
  storage: StorageService;
  share: ShareService;
  haptics: HapticsService;
  audio: AudioService;
}

const native = Capacitor.isNativePlatform();

export const services: Services = {
  storage: native ? new CapacitorStorageService() : new WebStorageService(),
  share: native ? new CapacitorShareService() : new WebShareService(),
  haptics: native ? new CapacitorHapticsService() : new NoopHapticsService(),
  // Web Audio works unchanged in the native web view.
  audio: new WebAudioService(),
};

export type { StorageService, ShareService, HapticsService, AudioService, SfxId };
