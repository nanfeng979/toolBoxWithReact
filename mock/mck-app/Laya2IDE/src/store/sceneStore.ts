import { create } from 'zustand';
import { HitResult, SceneNode } from '../types/scene';

interface SceneStore {
  sceneData: SceneNode | null;
  selectedHit: HitResult | null;
  errorMsg: string | null;
  version: number;
  setSceneData: (sceneData: SceneNode | null) => void;
  setSelectedHit: (hit: HitResult | null) => void;
  setErrorMsg: (error: string | null) => void;
  bumpVersion: () => void;
}

export const useSceneStore = create<SceneStore>((set) => ({
  sceneData: null,
  selectedHit: null,
  errorMsg: null,
  version: 0,
  setSceneData: (sceneData) => set({ sceneData }),
  setSelectedHit: (selectedHit) => set({ selectedHit }),
  setErrorMsg: (errorMsg) => set({ errorMsg }),
  bumpVersion: () => set((state) => ({ version: state.version + 1 }))
}));
