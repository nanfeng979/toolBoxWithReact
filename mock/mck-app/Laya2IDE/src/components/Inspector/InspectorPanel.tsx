import React from 'react';
import { useSceneStore } from '../../store/sceneStore';

function toNumberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface FieldRowProps {
  label: string;
  value: number;
  onCommit: (nextValue: number) => void;
}

interface TextFieldRowProps {
  label: string;
  value: string;
  onCommit: (nextValue: string) => void;
}

function FieldRow({ label, value, onCommit }: FieldRowProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ width: 52, color: '#bcbcbc', fontSize: 12, textTransform: 'uppercase' }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onCommit(toNumberOrZero(e.target.value))}
        style={{
          flex: 1,
          height: 26,
          background: '#1f1f1f',
          border: '1px solid #3f3f46',
          color: '#e5e5e5',
          borderRadius: 4,
          padding: '0 8px',
          fontSize: 12,
          outline: 'none'
        }}
      />
    </label>
  );
}

function TextFieldRow({ label, value, onCommit }: TextFieldRowProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ width: 52, color: '#bcbcbc', fontSize: 12, textTransform: 'uppercase' }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        style={{
          flex: 1,
          height: 26,
          background: '#1f1f1f',
          border: '1px solid #3f3f46',
          color: '#e5e5e5',
          borderRadius: 4,
          padding: '0 8px',
          fontSize: 12,
          outline: 'none'
        }}
      />
    </label>
  );
}

export function InspectorPanel() {
  const selectedHit = useSceneStore((state) => state.selectedHit);
  const updateSelectedNodeProps = useSceneStore((state) => state.updateSelectedNodeProps);

  const selectedNode = selectedHit?.node || null;
  const selectedProps = selectedNode?.props || {};

  const updateNumericProp = (key: 'x' | 'y' | 'width' | 'height', nextValue: number) => {
    updateSelectedNodeProps({ [key]: nextValue });
  };

  const updateTextProp = (key: 'text' | 'color' | 'skin' | 'texture', nextValue: string) => {
    updateSelectedNodeProps({ [key]: nextValue });
  };

  if (!selectedNode) {
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
          fontSize: 12,
          textAlign: 'center',
          padding: 12,
          boxSizing: 'border-box'
        }}
      >
        Select a node from canvas or hierarchy
      </div>
    );
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: 'calc(100% - 1px)', boxSizing: 'border-box' }}>
      <div
        style={{
          border: '1px solid #3f3f46',
          borderRadius: 6,
          padding: 10,
          marginBottom: 12,
          background: '#2a2a2a'
        }}
      >
        <div style={{ color: '#9aa0a6', fontSize: 11, marginBottom: 6 }}>NODE</div>
        <div style={{ color: '#f0f0f0', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(selectedProps.var || selectedProps.name || selectedNode.type) as string}
        </div>
        <div style={{ color: '#7f7f7f', fontSize: 11, marginTop: 3 }}>{selectedNode.type}</div>
      </div>

      <div
        style={{
          border: '1px solid #3f3f46',
          borderRadius: 6,
          padding: 10,
          background: '#2a2a2a'
        }}
      >
        <div style={{ color: '#9aa0a6', fontSize: 11, marginBottom: 10 }}>TRANSFORM (MINIMAL)</div>
        <FieldRow label="x" value={Number(selectedProps.x || 0)} onCommit={(v) => updateNumericProp('x', v)} />
        <FieldRow label="y" value={Number(selectedProps.y || 0)} onCommit={(v) => updateNumericProp('y', v)} />
        <FieldRow label="width" value={Number(selectedProps.width || 0)} onCommit={(v) => updateNumericProp('width', v)} />
        <FieldRow label="height" value={Number(selectedProps.height || 0)} onCommit={(v) => updateNumericProp('height', v)} />
      </div>

      {selectedNode.type === 'Label' && (
        <div
          style={{
            border: '1px solid #3f3f46',
            borderRadius: 6,
            padding: 10,
            marginTop: 12,
            background: '#2a2a2a'
          }}
        >
          <div style={{ color: '#9aa0a6', fontSize: 11, marginBottom: 10 }}>LABEL</div>
          <TextFieldRow label="text" value={String(selectedProps.text || '')} onCommit={(v) => updateTextProp('text', v)} />
          <TextFieldRow label="color" value={String(selectedProps.color || '#ffffff')} onCommit={(v) => updateTextProp('color', v)} />
          <FieldRow label="font" value={Number(selectedProps.fontSize || 20)} onCommit={(v) => updateSelectedNodeProps({ fontSize: v })} />
        </div>
      )}

      {(selectedNode.type === 'Image' || selectedNode.type === 'Sprite') && (
        <div
          style={{
            border: '1px solid #3f3f46',
            borderRadius: 6,
            padding: 10,
            marginTop: 12,
            background: '#2a2a2a'
          }}
        >
          <div style={{ color: '#9aa0a6', fontSize: 11, marginBottom: 10 }}>RESOURCE</div>
          <TextFieldRow label="skin" value={String(selectedProps.skin || '')} onCommit={(v) => updateTextProp('skin', v)} />
          <TextFieldRow
            label="texture"
            value={String(selectedProps.texture || '')}
            onCommit={(v) => updateTextProp('texture', v)}
          />
        </div>
      )}
    </div>
  );
}
