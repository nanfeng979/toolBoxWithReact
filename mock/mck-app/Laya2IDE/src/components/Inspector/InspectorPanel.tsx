import React, { useRef } from 'react';
import { useSceneStore } from '../../store/sceneStore.ts';

const REFERENCE_PRIVATE_TYPES = new Set(['Scene', 'View', 'Dialog']);
const VISUAL_PRIVATE_TYPES = new Set(['Label', 'Image', 'Sprite']);

function toNumberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toHexColor(value: string | undefined, fallback = '#000000') {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('#')) return fallback;
  const hex = trimmed.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{8}$/.test(hex)) {
    return `#${hex.slice(0, 6).toLowerCase()}`;
  }
  return fallback;
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

interface ColorFieldRowProps {
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

function ColorFieldRow({ label, value, onCommit }: ColorFieldRowProps) {
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const colorValue = toHexColor(value, '#000000');

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ width: 52, color: '#bcbcbc', fontSize: 12, textTransform: 'uppercase' }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
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
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          style={{
            width: 30,
            height: 26,
            padding: 0,
            border: '1px solid #3f3f46',
            background: colorValue,
            borderRadius: 4,
            cursor: 'pointer'
          }}
          title="Pick color"
          aria-label="Pick color"
        />
        <input
          type="color"
          ref={colorInputRef}
          value={colorValue}
          onChange={(e) => onCommit(e.target.value)}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none'
          }}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </label>
  );
}

export function InspectorPanel() {
  const selectedHit = useSceneStore((state) => state.selectedHit);
  const nodePathMap = useSceneStore((state) => state.nodePathMap);
  const privateNodeState = useSceneStore((state) => state.privateNodeState);
  const updateSelectedNodeProps = useSceneStore((state) => state.updateSelectedNodeProps);
  const updateNodePrivateSettingsByPath = useSceneStore((state) => state.updateNodePrivateSettingsByPath);

  const selectedNode = selectedHit?.node || null;
  const selectedProps = selectedNode?.props || {};
  const selectedType = selectedNode?.type;
  const supportsReferencePrivate = REFERENCE_PRIVATE_TYPES.has(selectedType || '');
  const supportsNodePrivate = VISUAL_PRIVATE_TYPES.has(selectedType || '') || supportsReferencePrivate;
  const selectedPath = selectedNode ? nodePathMap.get(selectedNode) || '' : '';
  const selectedPrivateId = selectedPath ? privateNodeState.pathToId[selectedPath] : undefined;
  const selectedPrivateState = selectedPrivateId ? privateNodeState.byId[selectedPrivateId] : undefined;

  const updateNumericProp = (key: 'x' | 'y' | 'width' | 'height', nextValue: number) => {
    updateSelectedNodeProps({ [key]: nextValue });
  };

  const updateTextProp = (key: 'text' | 'color' | 'skin' | 'texture', nextValue: string) => {
    updateSelectedNodeProps({ [key]: nextValue });
  };

  const updateIdentityProp = (key: 'name' | 'var', nextValue: string) => {
    updateSelectedNodeProps({ [key]: nextValue });
  };

  return (
    <div style={{ padding: 12, overflow: 'auto', height: 'calc(100% - 1px)', boxSizing: 'border-box' }}>
      {!selectedNode && (
        <div
          style={{
            border: '1px solid #3f3f46',
            borderRadius: 6,
            minHeight: 64,
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
      )}

      {selectedNode && (
        <>
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
          marginBottom: 12,
          background: '#2a2a2a'
        }}
      >
        <div style={{ color: '#9aa0a6', fontSize: 11, marginBottom: 10 }}>IDENTITY</div>
        <TextFieldRow label="name" value={String(selectedProps.name || '')} onCommit={(v) => updateIdentityProp('name', v)} />
        <TextFieldRow label="var" value={String(selectedProps.var || '')} onCommit={(v) => updateIdentityProp('var', v)} />
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
          <ColorFieldRow label="color" value={String(selectedProps.color || '#000000')} onCommit={(v) => updateTextProp('color', v)} />
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

      {supportsNodePrivate && (
        <div
          style={{
            border: '1px solid #3f3f46',
            borderRadius: 6,
            padding: 10,
            marginTop: 12,
            background: '#2a2a2a'
          }}
        >
          <div style={{ color: '#9aa0a6', fontSize: 11, marginBottom: 10 }}>
            私有属性
          </div>
          {/* <div style={{ color: '#7f7f7f', fontSize: 11, marginBottom: 8 }}>
            编号: {selectedPrivateState?.id || '-'}
          </div> */}
          {/* <div style={{ color: '#7f7f7f', fontSize: 11, marginBottom: 10, wordBreak: 'break-all' }}>
            路径: {selectedPrivateState?.path || selectedPath || '-'}
          </div> */}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: '#d0d0d0', fontSize: 12 }}>影响子对象</span>
            <input
              type="checkbox"
              checked={selectedPrivateState?.affectChildren ?? true}
              disabled={!selectedPrivateState}
              onChange={(e) => updateNodePrivateSettingsByPath(selectedPath, { affectChildren: e.target.checked })}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: '#d0d0d0', fontSize: 12 }}>
              节点显示
            </span>
            <input
              type="checkbox"
              checked={selectedPrivateState?.nodeVisible ?? true}
              disabled={!selectedPrivateState}
              onChange={(e) => updateNodePrivateSettingsByPath(selectedPath, { nodeVisible: e.target.checked })}
            />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ color: '#d0d0d0', fontSize: 12, marginBottom: 6 }}>
              节点透明度：{(selectedPrivateState?.nodeOpacity ?? 1).toFixed(2)}
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selectedPrivateState?.nodeOpacity ?? 1}
              disabled={!selectedPrivateState}
              onChange={(e) => updateNodePrivateSettingsByPath(selectedPath, { nodeOpacity: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      )}

      {supportsReferencePrivate && (
        <div
          style={{
            border: '1px solid #3f3f46',
            borderRadius: 6,
            padding: 10,
            marginTop: 12,
            background: '#2a2a2a'
          }}
        >
          <div style={{ color: '#9aa0a6', fontSize: 11, marginBottom: 10 }}>私有属性 / 参考图</div>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: '#d0d0d0', fontSize: 12 }}>参考图显示</span>
            <input
              type="checkbox"
              checked={selectedPrivateState?.referenceVisible ?? true}
              disabled={!selectedPrivateState}
              onChange={(e) => updateNodePrivateSettingsByPath(selectedPath, { referenceVisible: e.target.checked })}
            />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ color: '#d0d0d0', fontSize: 12, marginBottom: 6 }}>
              参考图透明度：{(selectedPrivateState?.referenceOpacity ?? 1).toFixed(2)}
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selectedPrivateState?.referenceOpacity ?? 1}
              disabled={!selectedPrivateState}
              onChange={(e) => updateNodePrivateSettingsByPath(selectedPath, { referenceOpacity: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      )}

      {!supportsNodePrivate && !supportsReferencePrivate}
        </>
      )}
    </div>
  );
}
