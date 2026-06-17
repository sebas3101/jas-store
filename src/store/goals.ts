import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MonthlyGoal } from '../types';

interface GoalsStore {
  goals: MonthlyGoal[];
  addGoal:    (g: Omit<MonthlyGoal, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateGoal: (id: string, g: Partial<Omit<MonthlyGoal, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteGoal: (id: string) => void;
}

export const useGoalsStore = create<GoalsStore>()(
  persist(
    (set) => ({
      goals: [],

      addGoal: (g) => {
        const now = new Date().toISOString();
        const newGoal: MonthlyGoal = {
          ...g,
          id:        crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        set(s => ({ goals: [...s.goals, newGoal] }));
      },

      updateGoal: (id, g) => {
        const now = new Date().toISOString();
        set(s => ({
          goals: s.goals.map(x =>
            x.id === id ? { ...x, ...g, updatedAt: now } : x
          ),
        }));
      },

      deleteGoal: (id) => {
        set(s => ({ goals: s.goals.filter(x => x.id !== id) }));
      },
    }),
    { name: 'jas-goals' }
  )
);
