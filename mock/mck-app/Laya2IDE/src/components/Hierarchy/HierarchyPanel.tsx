import React, { useMemo, useState } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { SceneNode } from '../../types/scene';
import { resolveHitByNode } from '../../core/Renderer.ts';

interface TreeRow {
  path: string;
  depth: number;
  node: SceneNode;
  hasChildren: boolean;
}

function getNodeLabel(node: SceneNode) {
  const props = node.props || {};
  return props.var || props.name || node.type;
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
  const selectedHit = useSceneStore((state) => state.selectedHit);
  const setSelectedHit = useSceneStore((state) => state.setSelectedHit);

  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    if (!sceneData) return [] as TreeRow[];
    const nextRows: TreeRow[] = [];
    flattenTree(sceneData, 0, '0', collapsedPaths, nextRows);
    return nextRows;
  }, [sceneData, collapsedPaths]);

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
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
