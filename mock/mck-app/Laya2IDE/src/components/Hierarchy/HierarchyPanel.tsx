import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { SceneNode } from '../../types/scene';
import { resolveHitByNode } from '../../core/Renderer.ts';
import { createImageUIComponent } from '../../core/componentCreators';

interface TreeRow {
  path: string;
  depth: number;
  node: SceneNode;
  hasChildren: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  row: TreeRow;
}

function toNumberOrZero(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}

function getNodeLabel(node: SceneNode) {
  const props = node.props || {};
  const name = String(props.name || node.type || '');
  const varName = String(props.var || '').trim();
  return varName ? `${name} (${varName})` : name;
}

function flattenTree(node: SceneNode, depth: number, path: string, collapsed: Set<string>, rows: TreeRow[]) {
  const hasChildren = !!node.child?.length;
  rows.push({ path, depth, node, hasChildren });

  if (!hasChildren || collapsed.has(path)) return;

  node.child!.forEach((child, index) => {
    flattenTree(child, depth + 1, `${path}.${index}`, collapsed, rows);
  });
}

export function HierarchyPanel() {
  const sceneData = useSceneStore((state) => state.sceneData);
  const version = useSceneStore((state) => state.version);
  const selectedHit = useSceneStore((state) => state.selectedHit);
  const setSelectedHit = useSceneStore((state) => state.setSelectedHit);
  const updateSelectedNodeProps = useSceneStore((state) => state.updateSelectedNodeProps);
  const setDirty = useSceneStore((state) => state.setDirty);
  const bumpVersion = useSceneStore((state) => state.bumpVersion);

  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const editingInputRef = useRef<HTMLInputElement | null>(null);

  const rows = useMemo(() => {
    if (!sceneData) return [] as TreeRow[];
    const nextRows: TreeRow[] = [];
    flattenTree(sceneData, 0, '0', collapsedPaths, nextRows);
    return nextRows;
  }, [sceneData, collapsedPaths, version]);

  const toggleCollapse = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleSelectNode = (node: SceneNode) => {
    if (!sceneData) return;
    const hit = resolveHitByNode(sceneData, node);
    if (hit) setSelectedHit(hit);
    else setSelectedHit({ node, x: 0, y: 0, w: 0, h: 0 });
  };

  const selectedRow = useMemo(() => {
    if (!selectedHit?.node) return null;
    return rows.find((row) => row.node === selectedHit.node) || null;
  }, [rows, selectedHit]);

  const beginRenameSelectedNode = () => {
    if (!selectedRow) return;
    const props = selectedRow.node.props || {};
    const currentName = String(props.name || '');
    setEditingPath(selectedRow.path);
    setEditingName(currentName);
  };

  const commitRename = (row: TreeRow) => {
    const trimmed = editingName.trim();
    const props = row.node.props || {};
    const fallback = String(props.name || '');
    const nextName = trimmed || fallback;

    handleSelectNode(row.node);
    updateSelectedNodeProps({ name: nextName });
    setEditingPath(null);
  };

  const cancelRename = () => {
    setEditingPath(null);
  };

  const createImageUIAtRow = (row: TreeRow) => {
    if (!sceneData) return;

    if (!Array.isArray(row.node.child)) {
      row.node.child = [];
    }

    const rootRecord = sceneData as unknown as Record<string, unknown>;
    const currentMaxId = toNumberOrZero(rootRecord.maxID);
    const nextCompId = currentMaxId;
    rootRecord.maxID = currentMaxId + 1;

    const parentCompId = toNumberOrZero(row.node.compId);
    const nextNode = createImageUIComponent({
      compId: nextCompId,
      parentCompId,
      depth: row.depth + 1
    });
    row.node.child.push(nextNode);
    row.node.hasChild = true;
    row.node.isDirectory = row.node.hasChild;

    const nextCollapsed = new Set(collapsedPaths);
    nextCollapsed.delete(row.path);
    setCollapsedPaths(nextCollapsed);

    const hit = resolveHitByNode(sceneData, nextNode);
    if (hit) setSelectedHit(hit);
    else setSelectedHit({ node: nextNode, x: 0, y: 0, w: 0, h: 0 });

    setDirty(true);
    bumpVersion();
    setContextMenu(null);
  };

  useEffect(() => {
    if (!editingPath) return;
    editingInputRef.current?.focus();
    editingInputRef.current?.select();
  }, [editingPath]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F2') return;
      if (isEditableTarget(e.target)) return;
      if (!selectedRow) return;

      e.preventDefault();
      beginRenameSelectedNode();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRow]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  if (!sceneData) {
    return (
      <div
        style={{
          margin: 12,
          border: '1px solid #3f3f46',
          borderRadius: 6,
          height: 'calc(100% - 24px)',
          background: '#2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9aa0a6',
          fontSize: 12
        }}
      >
        Waiting for scene data...
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100% - 1px)', overflow: 'auto', padding: '6px 0' }}>
      {rows.map((row) => {
        const isSelected = selectedHit?.node === row.node;
        const isCollapsed = collapsedPaths.has(row.path);
        const label = getNodeLabel(row.node);

        return (
          <div
            key={row.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 24,
              paddingLeft: 8 + row.depth * 14,
              paddingRight: 8,
              background: isSelected ? '#37373d' : 'transparent',
              color: isSelected ? '#ffffff' : '#d4d4d4',
              borderTop: isSelected ? '1px solid #4b4b4b' : '1px solid transparent',
              borderBottom: isSelected ? '1px solid #4b4b4b' : '1px solid transparent',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onClick={() => handleSelectNode(row.node)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelectNode(row.node);
              setContextMenu({ x: e.clientX, y: e.clientY, row });
            }}
            title={`${label} (${row.node.type})`}
          >
            <div
              style={{
                width: 14,
                fontSize: 10,
                color: '#a9a9a9',
                textAlign: 'center',
                flexShrink: 0
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (row.hasChildren) toggleCollapse(row.path);
              }}
            >
              {row.hasChildren ? (isCollapsed ? '▶' : '▼') : ''}
            </div>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
              {editingPath === row.path ? (
                <input
                  ref={editingInputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => commitRename(row)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename(row);
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    height: 20,
                    background: '#1f1f1f',
                    border: '1px solid #4b4b4b',
                    color: '#ffffff',
                    borderRadius: 4,
                    padding: '0 6px',
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
              ) : (
                label
              )}
            </span>
          </div>
        );
      })}

      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            minWidth: 140,
            background: '#2a2a2a',
            border: '1px solid #3f3f46',
            borderRadius: 6,
            boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
            zIndex: 9999,
            padding: 4
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              createImageUIAtRow(contextMenu.row);
            }}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: '#d4d4d4',
              textAlign: 'left',
              fontSize: 12,
              padding: '6px 8px',
              cursor: 'pointer'
            }}
          >
            创建 ImageUI
          </button>
        </div>
      )}
    </div>
  );
}
