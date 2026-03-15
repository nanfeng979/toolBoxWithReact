import React from 'react';
import { HitResult } from '../types';

interface InspectorProps {
  selectedHit: HitResult | null;
  onChangeProp: (key: string, value: any) => void;
}

export function Inspector({ selectedHit, onChangeProp }: InspectorProps) {
  if (!selectedHit) {
    return <div style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No node selected</div>;
  }

  const node = selectedHit.node;
  const p = node.props || {};

  const renderPropGroup = (title: string, keys: string[]) => {
    return (
      <div style={{ marginTop: 15 }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', fontWeight: 'bold' }}>
          {title}
        </div>
        {keys.map(k => {
          let val = p[k];
          if (val === undefined) val = '';
          if (typeof val === 'string') val = val.replace(/\n/g, '\\n');
          
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ width: 80, fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k}>
                {k}
              </div>
              <input
                style={{ flex: 1, background: '#3c3c3c', border: '1px solid #555', color: '#fff', padding: '3px 5px', fontFamily: 'monospace', borderRadius: 2 }}
                type="text"
                value={val}
                onChange={(e) => {
                  let newVal: any = e.target.value;
                  if (!isNaN(newVal as any) && newVal.trim() !== '') newVal = Number(newVal);
                  else if (newVal === 'true') newVal = true;
                  else if (newVal === 'false') newVal = false;
                  onChangeProp(k, newVal);
                }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10, color: '#fff', paddingBottom: 5, borderBottom: '1px solid #444' }}>
        {node.type}
      </div>
      {renderPropGroup('Common Props', ['name', 'x', 'y', 'width', 'height', 'alpha', 'rotation', 'visible'])}
      {node.type === 'Label' && renderPropGroup('Label Props', ['text', 'fontSize', 'color', 'align', 'valign'])}
      {node.type === 'Image' && renderPropGroup('Image Props', ['skin'])}
      {node.type === 'Sprite' && renderPropGroup('Sprite Props', ['texture'])}
      {node.type === 'Scene' && renderPropGroup('Scene Props', ['sceneColor'])}
    </div>
  );
}
