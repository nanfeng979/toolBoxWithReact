import React from 'react';
import { SceneNode, HitResult } from '../types';
import { imageCache } from '../utils/sceneUtils';

interface HierarchyProps {
  sceneData: SceneNode | null;
  selectedHit: HitResult | null;
  onSelectNode: (hit: HitResult | null) => void;
}

export function Hierarchy({ sceneData, selectedHit, onSelectNode }: HierarchyProps) {
  if (!sceneData) return <div style={{ padding: 10 }}>Loading...</div>;

  const calculateNodeBoundingBox = (
    root: SceneNode,
    target: SceneNode,
    currentX = 0,
    currentY = 0
  ): HitResult | null => {
    const p = root.props || {};
    const x = currentX + (p.x || 0);
    const y = currentY + (p.y || 0);
    const w = p.width || 0;
    const h = p.height || 0;

    let actualW = w;
    let actualH = h;
    
    if ((root.type === 'Image' || root.type === 'Sprite') && (p.skin || p.texture)) {
      const img = imageCache[p.skin || p.texture];
      if (img) { actualW = w || img.width; actualH = h || img.height; }
    } else if (root.type === 'Label') {
      const fontSize = p.fontSize || 20;
      const lines = (p.text || '').replace(/\\n/g, '\n').split('\n');
      actualH = h || (lines.length * fontSize * 1.2);
      actualW = w || Math.max(...lines.map(l => l.length * fontSize * 0.6));
    } else if (root.type === 'Scene') {
      actualW = p.width || 800;
      actualH = p.height || 600;
    }

    if (root === target) {
      return { node: root, x, y, w: actualW, h: actualH };
    }

    if (root.child) {
      for (const childNode of root.child) {
        const hit = calculateNodeBoundingBox(childNode, target, x, y);
        if (hit) return hit;
      }
    }

    return null;
  };

  const handleNodeClick = (node: SceneNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const hit = calculateNodeBoundingBox(sceneData, node);
    // If we can't calculate bounding box, just select the node with 0,0,0,0
    onSelectNode(hit || { node, x: 0, y: 0, w: 0, h: 0 });
  };

  const renderNode = (node: SceneNode, path: string = '0', depth: number = 0) => {
    const props = node.props || {};
    const nodeName = props.var || props.name || node.type;
    const isSelected = selectedHit?.node === node;

    return (
      <div key={path} style={{ userSelect: 'none' }}>
        <div
          onClick={(e) => handleNodeClick(node, e)}
          style={{
            padding: '4px 8px',
            paddingLeft: `${10 + depth * 15}px`,
            backgroundColor: isSelected ? '#37373D' : 'transparent',
            color: isSelected ? '#ffffff' : '#cccccc',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            borderBottom: '1px solid #333'
          }}
          title={`${node.type} - ${nodeName}`}
        >
          {nodeName} <span style={{ opacity: 0.5, fontSize: '0.85em' }}>({node.type})</span>
        </div>
        {node.child?.map((c, i) => renderNode(c, `${path}-${i}`, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ padding: '0 10px 10px', fontWeight: 'bold', color: '#fff', borderBottom: '1px solid #333' }}>
        Hierarchy
      </div>
      <div style={{ overflowY: 'auto' }}>
        {renderNode(sceneData)}
      </div>
    </div>
  );
}
