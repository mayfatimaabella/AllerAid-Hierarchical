import { registerPlugin } from '@capacitor/core';

export interface WatchConnectionResult {
  connected: boolean;
  name?: string;
  nodeId?: string;
}

export interface WatchConnectionPlugin {

  isConnected(): Promise<WatchConnectionResult>;

}

export const WatchConnection = registerPlugin<WatchConnectionPlugin>('WatchConnection');