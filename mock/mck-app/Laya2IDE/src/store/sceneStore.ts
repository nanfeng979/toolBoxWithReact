import { create } from 'zustand';
import { HitResult, SceneNode } from '../types/scene';
import { resolveHitByNode } from '../core/Renderer.ts';

interface PropHistoryEntry {
  type: 'props';
  node: SceneNode;
  beforeProps: Record<string, unknown>;
  afterProps: Record<string, unknown>;
  beforeNode: Record<string, unknown>;
  afterNode: Record<string, unknown>;
  groupId?: string;
}

interface DeleteHistoryEntry {
  type: 'delete';
  parentNode: SceneNode;
  removedNode: SceneNode;
  index: number;
  beforeParentHasChild: boolean;
  beforeParentIsDirectory: boolean;
}

type HistoryEntry = PropHistoryEntry | DeleteHistoryEntry;

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

function hasOwn(obj: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function toStringOrEmpty(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function isValidIdentityValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 && !/^\d/.test(trimmed);
}

function normalizeIdentityChanges(node: SceneNode, changes: Record<string, unknown>) {
  const propChanges: Record<string, unknown> = { ...changes };
  const nodeChanges: Record<string, unknown> = {};

  if (!hasOwn(changes, 'name') && !hasOwn(changes, 'var')) {
    return { propChanges, nodeChanges };
  }

  const props = node.props || {};
  const currentName = toStringOrEmpty(props.name);
  const currentVar = toStringOrEmpty(props.var);
  const nextName = hasOwn(changes, 'name') ? toStringOrEmpty(changes.name).trim() : currentName;
  const nextVar = hasOwn(changes, 'var') ? toStringOrEmpty(changes.var).trim() : currentVar;
  const effectiveName = isValidIdentityValue(nextName) ? nextName : '';
  const effectiveVar = isValidIdentityValue(nextVar) ? nextVar : '';

  const searchKeyParts = [node.type, effectiveName, effectiveVar].filter((part) => part);
  nodeChanges.searchKey = searchKeyParts.join(',');
  nodeChanges.label = effectiveName || node.type;

  // Ensure legacy nested keys are removed from props, searchKey/label must stay at node root level.
  if (hasOwn(props, 'searchKey')) {
    propChanges.searchKey = undefined;
  }

  if (hasOwn(changes, 'name')) {
    if (!effectiveName) {
      propChanges.name = undefined;
    }
    propChanges.label = undefined;
  }

  if (hasOwn(changes, 'var')) {
    if (!effectiveVar) {
      propChanges.var = undefined;
    }
  }

  return { propChanges, nodeChanges };
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
  history: HistoryEntry[];
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
  deleteNodeByPath: (path: string) => void;
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
      const nodeRecord = selectedNode as unknown as Record<string, unknown>;
      const { propChanges, nodeChanges } = normalizeIdentityChanges(selectedNode, changes);

      const beforeProps: Record<string, unknown> = {};
      const afterProps: Record<string, unknown> = {};
      const beforeNode: Record<string, unknown> = {};
      const afterNode: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(propChanges)) {
        beforeProps[key] = selectedNode.props[key];
        if (value === undefined) {
          delete selectedNode.props[key];
          afterProps[key] = undefined;
        } else {
          selectedNode.props[key] = value;
          afterProps[key] = selectedNode.props[key];
        }
      }

      for (const [key, value] of Object.entries(nodeChanges)) {
        beforeNode[key] = nodeRecord[key];
        nodeRecord[key] = value;
        afterNode[key] = nodeRecord[key];
      }

      const recalculatedHit = resolveHitByNode(state.sceneData, selectedNode);
      const fallbackPath = state.nodePathMap.get(selectedNode) || '0';

      let history = state.history;
      let historyCursor = state.historyCursor;
      if (!options?.skipHistory) {
        // Discard redo branch if new mutation happens after undo.
        history = state.history.slice(0, state.historyCursor);

        const entry: PropHistoryEntry = {
          type: 'props',
          node: selectedNode,
          beforeProps,
          afterProps,
          beforeNode,
          afterNode,
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
          const merged = {
            ...last,
            afterProps: { ...last.afterProps, ...afterProps },
            afterNode: { ...last.afterNode, ...afterNode }
          };
          history[history.length - 1] = merged;
          historyCursor = history.length;
        } else {
          history = [...history, entry];
          historyCursor = history.length;
        }
      }

      return {
        selectedHit: recalculatedHit || { node: selectedNode, x: 0, y: 0, w: 0, h: 0, path: fallbackPath },
        version: state.version + 1,
        isDirty: historyCursor !== state.savedCursor,
        history,
        historyCursor
      };
    }),
  deleteNodeByPath: (path) =>
    set((state) => {
      if (!state.sceneData) return state;
      if (!path || path === '0') return state;

      const parts = path.split('.').map((part) => Number(part));
      if (parts.some((n) => Number.isNaN(n))) return state;

      const removeIndex = parts[parts.length - 1];
      const parentPathParts = parts.slice(1, -1);

      let parentNode: SceneNode = state.sceneData;
      for (const childIndex of parentPathParts) {
        if (!Array.isArray(parentNode.child) || !parentNode.child[childIndex]) return state;
        parentNode = parentNode.child[childIndex];
      }

      if (!Array.isArray(parentNode.child)) return state;
      if (removeIndex < 0 || removeIndex >= parentNode.child.length) return state;

      const beforeParentHasChild = !!parentNode.hasChild;
      const beforeParentIsDirectory = !!parentNode.isDirectory;
      const removedNode = parentNode.child[removeIndex];
      parentNode.child.splice(removeIndex, 1);

      const hasChild = parentNode.child.length > 0;
      parentNode.hasChild = hasChild;
      parentNode.isDirectory = hasChild;

      const nextSelectedHit = resolveHitByNode(state.sceneData, parentNode);
      const fallbackPath = state.nodePathMap.get(parentNode) || '0';

      const historyBase = state.history.slice(0, state.historyCursor);
      const entry: DeleteHistoryEntry = {
        type: 'delete',
        parentNode,
        removedNode,
        index: removeIndex,
        beforeParentHasChild,
        beforeParentIsDirectory
      };
      const nextHistory = [...historyBase, entry];
      const nextCursor = nextHistory.length;

      return {
        selectedHit: nextSelectedHit || { node: parentNode, x: 0, y: 0, w: 0, h: 0, path: fallbackPath },
        version: state.version + 1,
        history: nextHistory,
        historyCursor: nextCursor,
        isDirty: nextCursor !== state.savedCursor,
        nodePathMap: collectNodePaths(state.sceneData)
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
        const nodeRecord = node as unknown as Record<string, unknown>;

        for (const [key, value] of Object.entries(entry.beforeProps)) {
          if (value === undefined) {
            delete node.props[key];
          } else {
            node.props[key] = value;
          }
        }

        for (const [key, value] of Object.entries(entry.beforeNode)) {
          if (value === undefined) {
            delete nodeRecord[key];
          } else {
            nodeRecord[key] = value;
          }
        }

        const nextSelectedHit = state.selectedHit?.node === node ? resolveHitByNode(state.sceneData, node) : state.selectedHit;
        const fallbackPath = state.nodePathMap.get(node) || '0';
        const nextCursor = state.historyCursor - 1;

        return {
          selectedHit: nextSelectedHit || (state.selectedHit?.node === node ? { node, x: 0, y: 0, w: 0, h: 0, path: fallbackPath } : state.selectedHit),
          version: state.version + 1,
          historyCursor: nextCursor,
          isDirty: nextCursor !== state.savedCursor
        };
      }

      if (entry.type === 'delete') {
        const parentNode = entry.parentNode;
        if (!Array.isArray(parentNode.child)) {
          parentNode.child = [];
        }

        const insertIndex = Math.max(0, Math.min(entry.index, parentNode.child.length));
        parentNode.child.splice(insertIndex, 0, entry.removedNode);
        parentNode.hasChild = entry.beforeParentHasChild;
        parentNode.isDirectory = entry.beforeParentIsDirectory;

        const restoredHit = resolveHitByNode(state.sceneData, entry.removedNode);
        const fallbackPath = state.nodePathMap.get(entry.removedNode) || '0';
        const nextCursor = state.historyCursor - 1;

        return {
          selectedHit: restoredHit || { node: entry.removedNode, x: 0, y: 0, w: 0, h: 0, path: fallbackPath },
          version: state.version + 1,
          historyCursor: nextCursor,
          isDirty: nextCursor !== state.savedCursor,
          nodePathMap: collectNodePaths(state.sceneData)
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
        const nodeRecord = node as unknown as Record<string, unknown>;

        for (const [key, value] of Object.entries(entry.afterProps)) {
          if (value === undefined) {
            delete node.props[key];
          } else {
            node.props[key] = value;
          }
        }

        for (const [key, value] of Object.entries(entry.afterNode)) {
          if (value === undefined) {
            delete nodeRecord[key];
          } else {
            nodeRecord[key] = value;
          }
        }

        const nextSelectedHit = state.selectedHit?.node === node ? resolveHitByNode(state.sceneData, node) : state.selectedHit;
        const fallbackPath = state.nodePathMap.get(node) || '0';
        const nextCursor = state.historyCursor + 1;

        return {
          selectedHit: nextSelectedHit || (state.selectedHit?.node === node ? { node, x: 0, y: 0, w: 0, h: 0, path: fallbackPath } : state.selectedHit),
          version: state.version + 1,
          historyCursor: nextCursor,
          isDirty: nextCursor !== state.savedCursor
        };
      }

      if (entry.type === 'delete') {
        const parentNode = entry.parentNode;
        if (!Array.isArray(parentNode.child) || parentNode.child.length === 0) return state;

        let removeIndex = entry.index;
        if (parentNode.child[removeIndex] !== entry.removedNode) {
          removeIndex = parentNode.child.indexOf(entry.removedNode);
        }
        if (removeIndex < 0) return state;

        parentNode.child.splice(removeIndex, 1);
        const hasChild = parentNode.child.length > 0;
        parentNode.hasChild = hasChild;
        parentNode.isDirectory = hasChild;

        const parentHit = resolveHitByNode(state.sceneData, parentNode);
        const fallbackPath = state.nodePathMap.get(parentNode) || '0';
        const nextCursor = state.historyCursor + 1;

        return {
          selectedHit: parentHit || { node: parentNode, x: 0, y: 0, w: 0, h: 0, path: fallbackPath },
          version: state.version + 1,
          historyCursor: nextCursor,
          isDirty: nextCursor !== state.savedCursor,
          nodePathMap: collectNodePaths(state.sceneData)
        };
      }

      return state;
    })
}));
