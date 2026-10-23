// Project Q — Persistence Layer: Factory & Exports
// Automatically chooses Supabase if environment variables are configured,
// or falls back safely to InMemoryBotRepository.

import { BotRepository } from './types';
import { InMemoryBotRepository } from './in-memory-bot-repository';
import { SupabaseBotRepository } from './supabase-bot-repository';

export * from './types';
export * from './in-memory-bot-repository';
export * from './supabase-bot-repository';

/**
 * Creates the appropriate BotRepository instance based on environment variables.
 */
export function createBotRepository(): BotRepository {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http') && !supabaseKey.includes('placeholder')) {
    try {
      console.log(`[Persistence] Initializing SupabaseBotRepository at ${supabaseUrl}`);
      return new SupabaseBotRepository({
        supabaseUrl,
        supabaseKey,
      });
    } catch (err) {
      console.warn('[Persistence] Failed to initialize Supabase client, falling back to InMemoryBotRepository:', err);
    }
  }

  // Fallback to in-memory repository
  return new InMemoryBotRepository();
}

/**
 * Singleton instance of the persistence repository.
 */
let sharedRepoInstance: BotRepository | null = null;

export function getSharedBotRepository(): BotRepository {
  if (!sharedRepoInstance) {
    sharedRepoInstance = createBotRepository();
  }
  return sharedRepoInstance;
}
