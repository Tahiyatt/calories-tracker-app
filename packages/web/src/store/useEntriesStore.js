import { create } from 'zustand';
import { sumNutrients, localDateFor } from '@ct/shared';
import { api } from '../api.js';

/**
 * Zustand for the day's log — frequently changing, read by a few components.
 *
 * Totals are recomputed locally with sumNutrients from @ct/shared, the same
 * function the server uses. That lets a delete update the totals instantly
 * without waiting for a round trip, and guarantees the optimistic number
 * matches what the server would have said.
 */
const recompute = (entries) => sumNutrients(entries);

export const useEntriesStore = create((set, get) => ({
  date: localDateFor(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
  entries: [],
  totals: recompute([]),
  status: 'idle', // idle | loading | ready | error
  error: null,

  setDate: (date) => {
    set({ date });
    return get().load();
  },

  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const { entries } = await api.entriesFor(get().date);
      set({ entries, totals: recompute(entries), status: 'ready' });
    } catch (err) {
      set({ status: 'error', error: err.message });
    }
  },

  quickAdd: async (input) => {
    const { entry } = await api.quickAdd(input);
    // Only splice it in if it belongs to the day being viewed.
    if (entry.localDate === get().date) {
      const entries = [...get().entries, entry];
      set({ entries, totals: recompute(entries) });
    }
    return entry;
  },

  remove: async (id) => {
    const previous = get().entries;
    // Optimistic: drop it immediately, restore if the server disagrees.
    const entries = previous.filter((e) => e._id !== id);
    set({ entries, totals: recompute(entries) });

    try {
      await api.deleteEntry(id);
    } catch (err) {
      set({ entries: previous, totals: recompute(previous), error: err.message });
      throw err;
    }
  },

  updateEntry: async (id, patch) => {
    const { entry } = await api.updateEntry(id, patch);
    const entries = get().entries.map((e) => (e._id === id ? entry : e));
    set({ entries, totals: recompute(entries) });
    return entry;
  },

  reset: () => set({ entries: [], totals: recompute([]), status: 'idle', error: null }),
}));
