import { create } from 'zustand';
import { api } from '../api.js';

/**
 * Zustand for frequently-changing state, per the roadmap. Auth and user
 * profile will go in Context instead — they change rarely and are read
 * almost everywhere.
 */
export const useHealthStore = create((set) => ({
  status: 'idle', // idle | loading | ok | error
  data: null,
  error: null,

  check: async () => {
    set({ status: 'loading', error: null });
    try {
      const data = await api.health();
      set({ status: 'ok', data });
    } catch (err) {
      set({ status: 'error', error: err.message, data: null });
    }
  },
}));
