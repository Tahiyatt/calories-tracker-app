import { create } from 'zustand';
import { api } from '../api.js';

export const useGoalStore = create((set) => ({
  goal: null,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const { goal } = await api.activeGoal();
      set({ goal, status: 'ready' });
    } catch (err) {
      set({ status: 'error', error: err.message });
    }
  },

  save: async (payload) => {
    const { goal } = await api.setGoal(payload);
    set({ goal });
    return goal;
  },
}));
