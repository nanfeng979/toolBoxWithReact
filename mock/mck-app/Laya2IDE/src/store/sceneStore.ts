import { create } from 'zustand';
import { HitResult, SceneNode } from '../types/scene';
import { resolveHitByNode } from '../core/Renderer';

interface SceneStore {
  sceneData: SceneNode | null;
  selectedHit: HitResult | null;
  errorMsg: string | null;
  version: number;
  isDirty: boolean;
  setSceneData: (sceneData: SceneNode | null) => void;
  setSelectedHit: (hit: HitResult | null) => void;
  setErrorMsg: (error: string | null) => void;
  setDirty: (dirty: boolean) => void;
  bumpVersion: () => void;
  updateSelectedNodeProps: (changes: Record<string, any>) => void;
}

export const useSceneStore = create<SceneStore>((set) => ({
  sceneData: null,
  selectedHit: null,
  errorMsg: null,
  version: 0,
  isDirty: false,
  setSceneData: (sceneData) => set({ sceneData, isDirty: false }),
  setSelectedHit: (selectedHit) => set({ selectedHit }),
  setErrorMsg: (errorMsg) => set({ errorMsg }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  bumpVersion: () => set((state) => ({ version: state.version + 1 })),
  updateSelectedNodeProps: (changes) =>
    set((state) => {
      if (!state.sceneData || !state.selectedHit?.node) return state;

      const selectedNode = state.selectedHit.node;
      selectedNode.props = selectedNode.props || {};

      for (const [key, value] of Object.entries(changes)) {
        selectedNode.props[key] = value;
      }

      const recalculatedHit = resolveHitByNode(state.sceneData, selectedNode);

      return {
        selectedHit: recalculatedHit || { node: selectedNode, x: 0, y: 0, w: 0, h: 0 },
        version: state.version + 1,
        isDirty: true
      };
    })
}));
