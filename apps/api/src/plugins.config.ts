import type { PluginEntry } from '@hdt/core';
import body from '@hdt/plugin-body';
import chat from '@hdt/plugin-chat';
import family from '@hdt/plugin-family';
import profile from '@hdt/plugin-profile';
import tuvi from '@hdt/plugin-tuvi';

/**
 * The one place that decides which features run. Add a plugin here to ship
 * it, set enabled: false to switch it off. Order doesn't matter: the kernel
 * sorts by dependsOn.
 */
export const plugins: PluginEntry[] = [
  { plugin: profile },
  { plugin: tuvi, config: { chartOptions: { ratHourNextDay: true, leapMonth: 'same' } } },
  { plugin: body },
  { plugin: family },
  { plugin: chat },
  // Next phases (see README roadmap):
  // { plugin: importer },   // CSV / Excel / JSON → facts
  // { plugin: vector },     // embeddings + similarity matching
  // { plugin: community },  // moderated rooms
  // { plugin: llm },        // LLM extractor + tuvi.interpreter
];
