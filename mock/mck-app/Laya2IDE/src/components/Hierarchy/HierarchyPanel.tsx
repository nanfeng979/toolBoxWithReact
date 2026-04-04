import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { SceneNode } from '../../types/scene';
import { resolveHitByNode } from '../../core/Renderer.ts';
import { createBoxUIComponent, createImageUIComponent, createLabelUIComponent } from '../../core/componentCreators';
import type { ComponentCreator } from '../../core/componentCreators';
import {
  hierarchyContextMenuStyle,
  hierarchyMenuButtonDangerDisabledStyle,
  hierarchyMenuButtonDangerStyle,
  hierarchyMenuButtonStyle,
  hierarchyPanelEmptyStyle,
  hierarchyPanelRootStyle,
  hierarchyRowInputStyle,
  hierarchyRowLabelStyle,
  hierarchyRowSelectedStyle,
  hierarchyRowStyle,
  hierarchyRowToggleStyle
} from './HierarchyPanel.styles';

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
  const deleteNodeByPath = useSceneStore((state) => state.deleteNodeByPath);
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
    else setSelectedHit({ node, x: 0, y: 0, w: 0, h: 0, path: '0' });
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
    createUIAtRow(row, createImageUIComponent);
  };

  const createLabelUIAtRow = (row: TreeRow) => {
    createUIAtRow(row, createLabelUIComponent);
  };

  const createBoxUIAtRow = (row: TreeRow) => {
    createUIAtRow(row, createBoxUIComponent);
  };

  const createUIAtRow = (row: TreeRow, creator: ComponentCreator) => {
    if (!sceneData) return;

    if (!Array.isArray(row.node.child)) {
      row.node.child = [];
    }

    const rootRecord = sceneData as unknown as Record<string, unknown>;
    const currentMaxId = toNumberOrZero(rootRecord.maxID);
    const nextCompId = currentMaxId;
    rootRecord.maxID = currentMaxId + 1;

    const parentCompId = toNumberOrZero(row.node.compId);
    const nextNode = creator({
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
    else setSelectedHit({ node: nextNode, x: 0, y: 0, w: 0, h: 0, path: row.path });

    setDirty(true);
    bumpVersion();
    setContextMenu(null);
  };

  const deleteNodeAtRow = (row: TreeRow) => {
    // Root node is the scene container, do not allow deleting it.
    if (row.path === '0') return;
    deleteNodeByPath(row.path);
    setEditingPath((prev) => (prev === row.path ? null : prev));
    setContextMenu(null);
  };

  const deleteSelectedNode = () => {
    if (!selectedRow) return;
    deleteNodeAtRow(selectedRow);
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
      if (isEditableTarget(e.target)) return;

      if (e.key === 'F2') {
        if (!selectedRow) return;
        e.preventDefault();
        beginRenameSelectedNode();
        return;
      }

      if (e.key === 'Delete') {
        if (!selectedRow) return;
        if (editingPath) return;
        e.preventDefault();
        deleteSelectedNode();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRow, editingPath]);

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
      <div style={hierarchyPanelEmptyStyle}>
        Waiting for scene data...
      </div>
    );
  }

  return (
    <div style={hierarchyPanelRootStyle}>
      {rows.map((row) => {
        const isSelected = selectedHit?.node === row.node;
        const isCollapsed = collapsedPaths.has(row.path);
        const label = getNodeLabel(row.node);
        const rowStyle = isSelected ? { ...hierarchyRowStyle, ...hierarchyRowSelectedStyle } : hierarchyRowStyle;

        return (
          <div
            key={row.path}
            style={{ ...rowStyle, paddingLeft: 8 + row.depth * 14 }}
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
              style={hierarchyRowToggleStyle}
              onClick={(e) => {
                e.stopPropagation();
                if (row.hasChildren) toggleCollapse(row.path);
              }}
            >
              {row.hasChildren ? (isCollapsed ? '▶' : '▼') : ''}
            </div>
            <span style={hierarchyRowLabelStyle}>
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
                  style={hierarchyRowInputStyle}
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
          style={{ ...hierarchyContextMenuStyle, left: contextMenu.x, top: contextMenu.y }}
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
            style={hierarchyMenuButtonStyle}
          >
            创建 ImageUI
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              createLabelUIAtRow(contextMenu.row);
            }}
            style={hierarchyMenuButtonStyle}
          >
            创建 Label
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              createBoxUIAtRow(contextMenu.row);
            }}
            style={hierarchyMenuButtonStyle}
          >
            创建 Box
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteNodeAtRow(contextMenu.row);
            }}
            disabled={contextMenu.row.path === '0'}
            style={
              contextMenu.row.path === '0'
                ? { ...hierarchyMenuButtonStyle, ...hierarchyMenuButtonDangerDisabledStyle }
                : { ...hierarchyMenuButtonStyle, ...hierarchyMenuButtonDangerStyle }
            }
          >
            删除节点
          </button>
        </div>
      )}
    </div>
  );
}
