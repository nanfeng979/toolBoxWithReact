import React, { useRef } from 'react';
import { useSceneStore } from '../../store/sceneStore.ts';
import {
  getInspectorColorButtonStyle,
  inspectorCardGapStyle,
  inspectorCardStyle,
  inspectorCardTitleStyle,
  inspectorColorButtonWrapStyle,
  inspectorEmptyStateStyle,
  inspectorFieldLabelStyle,
  inspectorFieldRowStyle,
  inspectorHiddenColorInputStyle,
  inspectorInputShrinkStyle,
  inspectorInputStyle,
  inspectorNodeNameStyle,
  inspectorNodeTypeStyle,
  inspectorPanelRootStyle,
  inspectorRangeGroupStyle,
  inspectorRangeInputStyle,
  inspectorRangeLabelStyle,
  inspectorToggleLabelStyle,
  inspectorToggleRowStyle
} from './InspectorPanel.styles';

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
    <label style={inspectorFieldRowStyle}>
      <span style={inspectorFieldLabelStyle}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onCommit(toNumberOrZero(e.target.value))}
        style={inspectorInputStyle}
      />
    </label>
  );
}

function TextFieldRow({ label, value, onCommit }: TextFieldRowProps) {
  return (
    <label style={inspectorFieldRowStyle}>
      <span style={inspectorFieldLabelStyle}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        style={inspectorInputStyle}
      />
    </label>
  );
}

function ColorFieldRow({ label, value, onCommit }: ColorFieldRowProps) {
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const colorValue = toHexColor(value, '#000000');

  return (
    <label style={inspectorFieldRowStyle}>
      <span style={inspectorFieldLabelStyle}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        style={{ ...inspectorInputStyle, ...inspectorInputShrinkStyle }}
      />
      <div style={inspectorColorButtonWrapStyle}>
        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          style={getInspectorColorButtonStyle(colorValue)}
          title="Pick color"
          aria-label="Pick color"
        />
        <input
          type="color"
          ref={colorInputRef}
          value={colorValue}
          onChange={(e) => onCommit(e.target.value)}
          style={inspectorHiddenColorInputStyle}
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

  const updatePrivateByPath = (changes: Record<string, unknown>) => {
    if (!selectedPath) return;
    updateNodePrivateSettingsByPath(selectedPath, changes);
  };

  const updateNumericProp = (key: 'x' | 'y' | 'width' | 'height' | 'fontSize', nextValue: number) => {
    updateSelectedNodeProps({ [key]: nextValue });
  };

  const updateTextProp = (key: 'text' | 'color' | 'skin' | 'texture' | 'name' | 'var', nextValue: string) => {
    updateSelectedNodeProps({ [key]: nextValue });
  };

  return (
    <div style={inspectorPanelRootStyle}>
      {!selectedNode && (
        <div style={inspectorEmptyStateStyle}>
          Select a node from canvas or hierarchy
        </div>
      )}

      {selectedNode && (
        <>
          <div style={{ ...inspectorCardStyle, marginBottom: 12 }}>
            <div style={{ ...inspectorCardTitleStyle, marginBottom: 6 }}>NODE</div>
            <div style={inspectorNodeNameStyle}>
              {(selectedProps.var || selectedProps.name || selectedNode.type) as string}
            </div>
            <div style={inspectorNodeTypeStyle}>{selectedNode.type}</div>
          </div>

          <div style={{ ...inspectorCardStyle, marginBottom: 12 }}>
            <div style={inspectorCardTitleStyle}>IDENTITY</div>
            <TextFieldRow label="name" value={String(selectedProps.name || '')} onCommit={(v) => updateTextProp('name', v)} />
            <TextFieldRow label="var" value={String(selectedProps.var || '')} onCommit={(v) => updateTextProp('var', v)} />
          </div>

          <div style={inspectorCardStyle}>
            <div style={inspectorCardTitleStyle}>TRANSFORM (MINIMAL)</div>
            <FieldRow label="x" value={Number(selectedProps.x || 0)} onCommit={(v) => updateNumericProp('x', v)} />
            <FieldRow label="y" value={Number(selectedProps.y || 0)} onCommit={(v) => updateNumericProp('y', v)} />
            <FieldRow label="width" value={Number(selectedProps.width || 0)} onCommit={(v) => updateNumericProp('width', v)} />
            <FieldRow label="height" value={Number(selectedProps.height || 0)} onCommit={(v) => updateNumericProp('height', v)} />
          </div>

          {selectedNode.type === 'Label' && (
            <div style={{ ...inspectorCardStyle, ...inspectorCardGapStyle }}>
              <div style={inspectorCardTitleStyle}>LABEL</div>
              <TextFieldRow label="text" value={String(selectedProps.text || '')} onCommit={(v) => updateTextProp('text', v)} />
              <ColorFieldRow label="color" value={String(selectedProps.color || '#000000')} onCommit={(v) => updateTextProp('color', v)} />
              <FieldRow label="font" value={Number(selectedProps.fontSize || 20)} onCommit={(v) => updateNumericProp('fontSize', v)} />
            </div>
          )}

          {(selectedNode.type === 'Image' || selectedNode.type === 'Sprite') && (
            <div style={{ ...inspectorCardStyle, ...inspectorCardGapStyle }}>
              <div style={inspectorCardTitleStyle}>RESOURCE</div>
              <TextFieldRow label="skin" value={String(selectedProps.skin || '')} onCommit={(v) => updateTextProp('skin', v)} />
              <TextFieldRow
                label="texture"
                value={String(selectedProps.texture || '')}
                onCommit={(v) => updateTextProp('texture', v)}
              />
            </div>
          )}

          {supportsNodePrivate && (
            <div style={{ ...inspectorCardStyle, ...inspectorCardGapStyle }}>
              <div style={inspectorCardTitleStyle}>私有属性</div>
          {/* <div style={{ color: '#7f7f7f', fontSize: 11, marginBottom: 8 }}>
            编号: {selectedPrivateState?.id || '-'}
          </div> */}
          {/* <div style={{ color: '#7f7f7f', fontSize: 11, marginBottom: 10, wordBreak: 'break-all' }}>
            路径: {selectedPrivateState?.path || selectedPath || '-'}
          </div> */}
              <label style={inspectorToggleRowStyle}>
                <span style={inspectorToggleLabelStyle}>影响子对象</span>
                <input
                  type="checkbox"
                  checked={selectedPrivateState?.affectChildren ?? true}
                  disabled={!selectedPrivateState}
                  onChange={(e) => updatePrivateByPath({ affectChildren: e.target.checked })}
                />
              </label>
              <label style={inspectorToggleRowStyle}>
                <span style={inspectorToggleLabelStyle}>节点显示</span>
                <input
                  type="checkbox"
                  checked={selectedPrivateState?.nodeVisible ?? true}
                  disabled={!selectedPrivateState}
                  onChange={(e) => updatePrivateByPath({ nodeVisible: e.target.checked })}
                />
              </label>
              <label style={inspectorRangeGroupStyle}>
                <div style={inspectorRangeLabelStyle}>
                  节点透明度：{(selectedPrivateState?.nodeOpacity ?? 1).toFixed(2)}
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selectedPrivateState?.nodeOpacity ?? 1}
                  disabled={!selectedPrivateState}
                  onChange={(e) => updatePrivateByPath({ nodeOpacity: Number(e.target.value) })}
                  style={inspectorRangeInputStyle}
                />
              </label>
            </div>
          )}

          {supportsReferencePrivate && (
            <div style={{ ...inspectorCardStyle, ...inspectorCardGapStyle }}>
              <div style={inspectorCardTitleStyle}>私有属性 / 参考图</div>
              <label style={inspectorToggleRowStyle}>
                <span style={inspectorToggleLabelStyle}>参考图显示</span>
                <input
                  type="checkbox"
                  checked={selectedPrivateState?.referenceVisible ?? true}
                  disabled={!selectedPrivateState}
                  onChange={(e) => updatePrivateByPath({ referenceVisible: e.target.checked })}
                />
              </label>
              <label style={inspectorRangeGroupStyle}>
                <div style={inspectorRangeLabelStyle}>
                  参考图透明度：{(selectedPrivateState?.referenceOpacity ?? 1).toFixed(2)}
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selectedPrivateState?.referenceOpacity ?? 1}
                  disabled={!selectedPrivateState}
                  onChange={(e) => updatePrivateByPath({ referenceOpacity: Number(e.target.value) })}
                  style={inspectorRangeInputStyle}
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
