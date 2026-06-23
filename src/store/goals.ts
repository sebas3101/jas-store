// Las metas mensuales ahora viven en useAppStore (Supabase, compartidas entre dispositivos).
// Este shim mantiene compatibilidad con imports existentes.
import { useAppStore } from './index';

export function useGoalsStore() {
  const { goals, addGoal, updateGoal, deleteGoal } = useAppStore();
  return { goals, addGoal, updateGoal, deleteGoal };
}
