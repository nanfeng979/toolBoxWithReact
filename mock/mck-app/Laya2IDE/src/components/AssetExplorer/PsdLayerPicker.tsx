import React, { useState, useCallback } from 'react';

// PSD图层类型定义
interface PsdLayer {
  name: string;
  type: 'group' | 'pixel' | 'text' | 'shape' | 'smart';
  visible: boolean;
  opacity: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  children?: PsdLayer[];
  is_open?: boolean;
}

interface PsdParseResult {
  success: boolean;
  width?: number;
  height?: number;
  layers?: PsdLayer[];
  error?: string;
}

// 样式
const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '360px',
    maxHeight: '80vh',
    background: '#252526',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  header: {
    padding: '10px 12px',
    background: '#333333',
    borderBottom: '1px solid #3c3c3c',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#ffffff',
    flex: 1,
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#8e8e8e',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '0 4px',
    lineHeight: 1,
  },
  toolbar: {
    padding: '8px 10px',
    borderBottom: '1px solid #3c3c3c',
    display: 'flex',
    gap: '8px',
  },
  openButton: {
    padding: '4px 10px',
    background: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  clearButton: {
    padding: '4px 10px',
    background: '#5a5a5a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  fileInfo: {
    fontSize: '10px',
    color: '#8e8e8e',
    marginLeft: 'auto',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  layerList: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
    minHeight: '200px',
    maxHeight: '400px',
  },
  layerRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 6px',
    cursor: 'pointer',
    fontSize: '11px',
    transition: 'background 0.1s',
  },
  layerRowSelected: {
    background: '#094771',
  },
  layerRowHover: {
    background: '#2a2d2e',
  },
  layerToggle: {
    width: '14px',
    height: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#8e8e8e',
    fontSize: '9px',
    flexShrink: 0,
  },
  layerIcon: {
    width: '14px',
    height: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '4px',
    flexShrink: 0,
    fontSize: '10px',
  },
  layerName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  layerCoords: {
    fontSize: '9px',
    color: '#6e6e6e',
    marginLeft: '6px',
  },
  details: {
    padding: '8px 10px',
    background: '#1e1e1e',
    borderTop: '1px solid #3c3c3c',
    fontSize: '10px',
  },
  detailsTitle: {
    fontWeight: 600,
    color: '#bbbbbb',
    marginBottom: '6px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 0',
  },
  detailLabel: {
    color: '#8e8e8e',
  },
  detailValue: {
    color: '#d4d4d4',
  },
  loading: {
    color: '#8e8e8e',
    textAlign: 'center' as const,
    padding: '20px',
    fontSize: '11px',
  },
  error: {
    color: '#f44747',
    padding: '12px',
    fontSize: '11px',
  },
  empty: {
    color: '#8e8e8e',
    textAlign: 'center' as const,
    padding: '40px 20px',
    fontSize: '11px',
  },
};

// 图层图标
const LayerIcon: React.FC<{ type: string }> = ({ type }) => {
  const iconMap: Record<string, string> = {
    group: '📁',
    pixel: '🖼',
    text: '📝',
    shape: '⬛',
    smart: '🔗',
  };
  return <span style={styles.layerIcon}>{iconMap[type] || '📄'}</span>;
};

// 递归渲染图层树
const LayerTreeItem: React.FC<{
  layer: PsdLayer;
  depth: number;
  selectedLayer: PsdLayer | null;
  onSelect: (layer: PsdLayer) => void;
  collapsedPaths: Set<string>;
  toggleCollapse: (path: string) => void;
  path: string;
}> = ({ layer, depth, selectedLayer, onSelect, collapsedPaths, toggleCollapse, path }) => {
  const [isHovered, setIsHovered] = useState(false);
  const hasChildren = layer.type === 'group' && layer.children && layer.children.length > 0;
  const isCollapsed = collapsedPaths.has(path);
  const isSelected = selectedLayer === layer;

  const rowStyle = {
    ...styles.layerRow,
    ...(isSelected ? styles.layerRowSelected : {}),
    ...(isHovered && !isSelected ? styles.layerRowHover : {}),
    paddingLeft: `${6 + depth * 12}px`,
  };

  return (
    <>
      <div
        style={rowStyle}
        onClick={() => onSelect(layer)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          style={styles.layerToggle}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleCollapse(path);
          }}
        >
          {hasChildren ? (isCollapsed ? '▶' : '▼') : ''}
        </div>
        <LayerIcon type={layer.type} />
        <span style={styles.layerName}>{layer.name}</span>
        {layer.width > 0 && (
          <span style={styles.layerCoords}>
            {layer.width}×{layer.height}
          </span>
        )}
      </div>
      {hasChildren && !isCollapsed && (
        <>
          {layer.children!.map((child, index) => (
            <LayerTreeItem
              key={`${path}.${index}`}
              layer={child}
              depth={depth + 1}
              selectedLayer={selectedLayer}
              onSelect={onSelect}
              collapsedPaths={collapsedPaths}
              toggleCollapse={toggleCollapse}
              path={`${path}.${index}`}
            />
          ))}
        </>
      )}
    </>
  );
};

interface PsdLayerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLayer: (layer: { name: string; left: number; top: number; width: number; height: number }) => void;
  onClearSelection: () => void;
  selectedLayerName?: string | null;
}

export function PsdLayerPicker({ isOpen, onClose, onSelectLayer, onClearSelection, selectedLayerName }: PsdLayerPickerProps) {
  const [psdData, setPsdData] = useState<PsdParseResult | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<PsdLayer | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>('');

  const toggleCollapse = useCallback((path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleOpenFile = useCallback(async () => {
    const hostApi = (window as any).hostApi;
    if (!hostApi?.openFileDialog) {
      setError('Host API not available');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const paths = await hostApi.openFileDialog();
      if (!paths || paths.length === 0) {
        setLoading(false);
        return;
      }

      const selectedPath = paths[0];
      setFilePath(selectedPath);
      setSelectedLayer(null);

      const result: PsdParseResult = await hostApi.parsePsd(selectedPath);
      
      if (result.success) {
        setPsdData(result);
      } else {
        setError(result.error || 'Failed to parse PSD');
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectLayer = useCallback((layer: PsdLayer) => {
    setSelectedLayer(layer);
    if (layer.width > 0) {
      onSelectLayer({
        name: layer.name,
        left: layer.left,
        top: layer.top,
        width: layer.width,
        height: layer.height,
      });
    }
  }, [onSelectLayer]);

  const handleClear = useCallback(() => {
    setSelectedLayer(null);
    onClearSelection();
  }, [onClearSelection]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>PSD 图层选择器</span>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div style={styles.toolbar}>
          <button style={styles.openButton} onClick={handleOpenFile} disabled={loading}>
            {loading ? '加载中...' : '打开 PSD'}
          </button>
          {selectedLayer && (
            <button style={styles.clearButton} onClick={handleClear}>
              清除选择
            </button>
          )}
          {filePath && (
            <span style={styles.fileInfo} title={filePath}>
              {filePath.split(/[/\\]/).pop()}
            </span>
          )}
        </div>

        <div style={styles.layerList}>
          {loading && <div style={styles.loading}>解析 PSD 文件...</div>}
          {error && <div style={styles.error}>{error}</div>}
          {!loading && !error && psdData?.layers?.map((layer, index) => (
            <LayerTreeItem
              key={`0.${index}`}
              layer={layer}
              depth={0}
              selectedLayer={selectedLayer}
              onSelect={handleSelectLayer}
              collapsedPaths={collapsedPaths}
              toggleCollapse={toggleCollapse}
              path={`0.${index}`}
            />
          ))}
          {!loading && !error && !psdData && (
            <div style={styles.empty}>
              打开一个 PSD 文件查看图层
            </div>
          )}
        </div>

        {selectedLayer && (
          <div style={styles.details}>
            <div style={styles.detailsTitle}>图层详情</div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>名称:</span>
              <span style={styles.detailValue}>{selectedLayer.name}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>类型:</span>
              <span style={styles.detailValue}>{selectedLayer.type}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>坐标:</span>
              <span style={styles.detailValue}>x: {selectedLayer.left}, y: {selectedLayer.top}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>尺寸:</span>
              <span style={styles.detailValue}>{selectedLayer.width} × {selectedLayer.height}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
