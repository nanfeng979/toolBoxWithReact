import { create } from 'zustand';
import { HitResult, SceneNode } from '../types/scene';
import { resolveHitByNode } from '../core/Renderer.ts';

interface PropHistoryEntry {
  type: 'props';
  node: SceneNode;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  groupId?: string;
}

interface UpdateNodePropsOptions {
  groupId?: string;
  skipHistory?: boolean;
}

type PrivateNodeSettingsPatch = Partial<
  Pick<NodePrivateState, 'nodeVisible' | 'nodeOpacity' | 'referenceVisible' | 'referenceOpacity' | 'affectChildren'>
>;

export interface PrivateReferenceSettings {
  referenceVisible: boolean;
  referenceOpacity: number;
}

export interface NodeVisualPrivateSettings {
  nodeVisible: boolean;
  nodeOpacity: number;
}

export interface PrivateInheritanceSettings {
  affectChildren: boolean;
}

export interface NodePrivateState extends NodeVisualPrivateSettings, PrivateReferenceSettings, PrivateInheritanceSettings {
  id: string;
  path: string;
}

export interface PersistedPrivateNodeState {
  byId: Record<string, NodePrivateState>;
  pathToId: Record<string, string>;
}

const DEFAULT_PRIVATE_REFERENCE: PrivateReferenceSettings = {
  referenceVisible: true,
  referenceOpacity: 1
};

const DEFAULT_NODE_VISUAL: NodeVisualPrivateSettings = {
  nodeVisible: true,
  nodeOpacity: 1
};

const DEFAULT_PRIVATE_INHERITANCE: PrivateInheritanceSettings = {
  affectChildren: true
};

let privateIdSeed = 0;
function createPrivateNodeId() {
  privateIdSeed += 1;
  return `node-${Date.now()}-${privateIdSeed}`;
}

function normalizeOpacity(value: number) {
  return Math.min(1, Math.max(0, Number(value || 0)));
}

function normalizeNodePrivateState(existing: Partial<NodePrivateState> | undefined, id: string, path: string): NodePrivateState {
  return {
    id,
    path,
    nodeVisible: existing?.nodeVisible ?? DEFAULT_NODE_VISUAL.nodeVisible,
    nodeOpacity: normalizeOpacity(existing?.nodeOpacity ?? DEFAULT_NODE_VISUAL.nodeOpacity),
    referenceVisible: existing?.referenceVisible ?? DEFAULT_PRIVATE_REFERENCE.referenceVisible,
    referenceOpacity: normalizeOpacity(existing?.referenceOpacity ?? DEFAULT_PRIVATE_REFERENCE.referenceOpacity),
    affectChildren: existing?.affectChildren ?? DEFAULT_PRIVATE_INHERITANCE.affectChildren
  };
}

function collectNodePaths(root: SceneNode) {
  const map = new Map<SceneNode, string>();
  const walk = (node: SceneNode, path: string) => {
    map.set(node, path);
    if (!node.child) return;
    node.child.forEach((child, index) => walk(child, `${path}.${index}`));
  };
  walk(root, '0');
  return map;
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
  nodePathMap: Map<SceneNode, string>;
  privateNodeState: PersistedPrivateNodeState;
  setSceneData: (sceneData: SceneNode | null) => void;
  setSelectedHit: (hit: HitResult | null) => void;
  setErrorMsg: (error: string | null) => void;
  setDirty: (dirty: boolean) => void;
  initializePrivateNodeState: (sceneData: SceneNode, persisted?: PersistedPrivateNodeState | null) => void;
  updateNodePrivateSettingsByPath: (path: string, partial: PrivateNodeSettingsPatch) => void;
  updateSelectedNodePrivateSettings: (partial: PrivateNodeSettingsPatch) => void;
  markSaved: () => void;
  bumpVersion: () => void;
  updateSelectedNodeProps: (changes: Record<string, unknown>, options?: UpdateNodePropsOptions) => void;
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
  nodePathMap: new Map(),
  privateNodeState: {
    byId: {},
    pathToId: {}
  },
  setSceneData: (sceneData) =>
    set({
      sceneData,
      isDirty: false,
      history: [],
      historyCursor: 0,
      savedCursor: 0,
      nodePathMap: sceneData ? collectNodePaths(sceneData) : new Map(),
      privateNodeState: { byId: {}, pathToId: {} }
    }),
  setSelectedHit: (selectedHit) => set({ selectedHit }),
  setErrorMsg: (errorMsg) => set({ errorMsg }),
  setDirty: (dirty) =>
    set((state) => {
      if (dirty) return { isDirty: true };
      return { isDirty: false, savedCursor: state.historyCursor };
    }),
  initializePrivateNodeState: (sceneData, persisted) =>
    set(() => ({
      nodePathMap: collectNodePaths(sceneData),
      privateNodeState: (() => {
        const nodePathMap = collectNodePaths(sceneData);
        const byId: Record<string, NodePrivateState> = {};
        const pathToId: Record<string, string> = {};
        const savedById = persisted?.byId || {};
        const savedPathToId = persisted?.pathToId || {};

        nodePathMap.forEach((path) => {
          const existingId = savedPathToId[path];
          const existing = existingId ? savedById[existingId] : undefined;

          if (existing && existing.path === path) {
            const normalized = normalizeNodePrivateState(existing, existing.id, path);
            byId[normalized.id] = normalized;
            pathToId[path] = normalized.id;
            return;
          }

          const id = createPrivateNodeId();
          byId[id] = normalizeNodePrivateState(undefined, id, path);
          pathToId[path] = id;
        });

        return { byId, pathToId };
      })()
    })),
  updateNodePrivateSettingsByPath: (path, partial) =>
    set((state) => {
      if (!path) return state;

      const currentId = state.privateNodeState.pathToId[path];
      const current = currentId ? state.privateNodeState.byId[currentId] : undefined;
      if (!current) return state;

      const next: NodePrivateState = {
        ...current,
        ...partial,
        nodeVisible: partial.nodeVisible ?? current.nodeVisible,
        nodeOpacity: normalizeOpacity(partial.nodeOpacity ?? current.nodeOpacity),
        referenceVisible: partial.referenceVisible ?? current.referenceVisible,
        referenceOpacity: normalizeOpacity(partial.referenceOpacity ?? current.referenceOpacity),
        affectChildren: partial.affectChildren ?? current.affectChildren
      };

      return {
        privateNodeState: {
          ...state.privateNodeState,
          byId: {
            ...state.privateNodeState.byId,
            [current.id]: next
          }
        },
        version: state.version + 1
      };
    }),
  updateSelectedNodePrivateSettings: (partial) =>
    set((state) => {
      const selectedNode = state.selectedHit?.node;
      if (!selectedNode) return state;

      const path = state.nodePathMap.get(selectedNode);
      if (!path) return state;

      const currentId = state.privateNodeState.pathToId[path];
      const current = currentId ? state.privateNodeState.byId[currentId] : undefined;
      if (!current) return state;

      const next: NodePrivateState = {
        ...current,
        ...partial,
        nodeVisible: partial.nodeVisible ?? current.nodeVisible,
        nodeOpacity: normalizeOpacity(partial.nodeOpacity ?? current.nodeOpacity),
        referenceVisible: partial.referenceVisible ?? current.referenceVisible,
        referenceOpacity: normalizeOpacity(partial.referenceOpacity ?? current.referenceOpacity),
        affectChildren: partial.affectChildren ?? current.affectChildren
      };

      return {
        privateNodeState: {
          ...state.privateNodeState,
          byId: {
            ...state.privateNodeState.byId,
            [current.id]: next
          }
        },
        version: state.version + 1
      };
    }),
  markSaved: () => set((state) => ({ isDirty: false, savedCursor: state.historyCursor })),
  bumpVersion: () => set((state) => ({ version: state.version + 1 })),
  updateSelectedNodeProps: (changes, options) =>
    set((state) => {
      if (!state.sceneData || !state.selectedHit?.node) return state;

      const selectedNode = state.selectedHit.node;
      selectedNode.props = selectedNode.props || {};

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};

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
