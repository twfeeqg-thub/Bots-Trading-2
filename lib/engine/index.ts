// Project Q — Bot Engine: Exports & Singleton
export * from './types';
export * from './bot-engine';

import { BotEngine } from './bot-engine';

let sharedEngineInstance: BotEngine | null = null;

export async function getSharedBotEngine(): Promise<BotEngine> {
  if (!sharedEngineInstance) {
    sharedEngineInstance = new BotEngine();
    await sharedEngineInstance.initialize();
  }
  return sharedEngineInstance;
}
