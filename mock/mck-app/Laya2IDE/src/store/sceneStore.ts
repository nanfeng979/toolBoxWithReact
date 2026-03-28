import { create } from 'zustand';
import { HitResult, SceneNode } from '../types/scene';
import { resolveHitByNode } from '../core/Renderer';

interface PropHistoryEntry {
  type: 'props';
  node: SceneNode;
  before: Record<string, any>;
  after: Record<string, any>;
  groupId?: string;
}

interface UpdateNodePropsOptions {
  groupId?: string;
  skipHistory?: boolean;
}

interface SceneStore {
  sceneData: SceneNode | null;
  selectedHit: HitResult | null;
  errorMsg: string | null;
  version: number;
  isDirty: boolean;
  history: PropHistoryEntry[];
  historyCursor: number;
  savedCursor: number;
  setSceneData: (sceneData: SceneNode | null) => void;
  setSelectedHit: (hit: HitResult | null) => void;
  setErrorMsg: (error: string | null) => void;
  setDirty: (dirty: boolean) => void;
  markSaved: () => void;
  bumpVersion: () => void;
  updateSelectedNodeProps: (changes: Record<string, any>, options?: UpdateNodePropsOptions) => void;
  undoLast: () => void;
  redoLast: () => void;
}

export const useSceneStore = create<SceneStore>((set) => ({
  sceneData: null,
  selectedHit: null,
  errorMsg: null,
  version: 0,
  isDirty: false,
  history: [],
  historyCursor: 0,
  savedCursor: 0,
  setSceneData: (sceneData) => set({ sceneData, isDirty: false, history: [], historyCursor: 0, savedCursor: 0 }),
  setSelectedHit: (selectedHit) => set({ selectedHit }),
  setErrorMsg: (errorMsg) => set({ errorMsg }),
  setDirty: (dirty) =>
    set((state) => {
      if (dirty) return { isDirty: true };
      return { isDirty: false, savedCursor: state.historyCursor };
    }),
  markSaved: () => set((state) => ({ isDirty: false, savedCursor: state.historyCursor })),
  bumpVersion: () => set((state) => ({ version: state.version + 1 })),
  updateSelectedNodeProps: (changes, options) =>
    set((state) => {
      if (!state.sceneData || !state.selectedHit?.node) return state;

      const selectedNode = state.selectedHit.node;
      selectedNode.props = selectedNode.props || {};

       const before: Record<string, any> = {};
       const after: Record<string, any> = {};

      for (const [key, value] of Object.entries(changes)) {
        before[key] = selectedNode.props[key];
        selectedNode.props[key] = value;
        after[key] = selectedNode.props[key];
      }

      const recalculatedHit = resolveHitByNode(state.sceneData, selectedNode);

      let history = state.history;
      let historyCursor = state.historyCursor;
      if (!options?.skipHistory) {
        // Discard redo branch if new mutation happens after undo.
        history = state.history.slice(0, state.historyCursor);

        const entry: PropHistoryEntry = {
          type: 'props',
          node: selectedNode,
          before,
          after,
          groupId: options?.groupId
        };

        const last = history[history.length - 1];
        const canMerge =
          !!options?.groupId &&
          !!last &&
          last.type === 'props' &&
          last.node === selectedNode &&
          last.groupId === options.groupId;

        if (canMerge) {
          history = [...history];
          const merged = { ...last, after: { ...last.after, ...after } };
          history[history.length - 1] = merged;
          historyCursor = history.length;
        } else {
          history = [...history, entry];
          historyCursor = history.length;
        }
      }

      return {
        selectedHit: recalculatedHit || { node: selectedNode, x: 0, y: 0, w: 0, h: 0 },
        version: state.version + 1,
        isDirty: historyCursor !== state.savedCursor,
        history,
        historyCursor
      };
    }),
  undoLast: () =>
    set((state) => {
      if (!state.sceneData || state.historyCursor <= 0) return state;

      const entry = state.history[state.historyCursor - 1];
      if (!entry) return state;

      if (entry.type === 'props') {
        const node = entry.node;
        node.props = node.props || {};

        for (const [key, value] of Object.entries(entry.before)) {
          if (value === undefined) {
            delete node.props[key];
          } else {
            node.props[key] = value;
          }
        }

        const nextSelectedHit = state.selectedHit?.node === node ? resolveHitByNode(state.sceneData, node) : state.selectedHit;
        const nextCursor = state.historyCursor - 1;

        return {
          selectedHit: nextSelectedHit || (state.selectedHit?.node === node ? { node, x: 0, y: 0, w: 0, h: 0 } : state.selectedHit),
          version: state.version + 1,
          historyCursor: nextCursor,
          isDirty: nextCursor !== state.savedCursor
        };
      }

      return state;
    }),
  redoLast: () =>
    set((state) => {
      if (!state.sceneData || state.historyCursor >= state.history.length) return state;

      const entry = state.history[state.historyCursor];
      if (!entry) return state;

      if (entry.type === 'props') {
        const node = entry.node;
        node.props = node.props || {};

        for (const [key, value] of Object.entries(entry.after)) {
          if (value === undefined) {
            delete node.props[key];
          } else {
            node.props[key] = value;
          }
        }

        const nextSelectedHit = state.selectedHit?.node === node ? resolveHitByNode(state.sceneData, node) : state.selectedHit;
        const nextCursor = state.historyCursor + 1;

        return {
          selectedHit: nextSelectedHit || (state.selectedHit?.node === node ? { node, x: 0, y: 0, w: 0, h: 0 } : state.selectedHit),
          version: state.version + 1,
          historyCursor: nextCursor,
          isDirty: nextCursor !== state.savedCursor
        };
      }

      return state;
    })
}));
