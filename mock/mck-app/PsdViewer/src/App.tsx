import React, { useState, useCallback, useRef } from 'react';

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
  colorMode?: string;
  depth?: number;
  channels?: number;
  error?: string;
}

// 样式常量
const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    background: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'Consolas, "Courier New", monospace',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '12px 16px',
    background: '#252526',
    borderBottom: '1px solid #3c3c3c',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
  },
  openButton: {
    padding: '6px 12px',
    background: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  fileInfo: {
    fontSize: '12px',
    color: '#8e8e8e',
    marginLeft: 'auto',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  sidebar: {
    width: '300px',
    background: '#252526',
    borderRight: '1px solid #3c3c3c',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '10px 12px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#bbbbbb',
    borderBottom: '1px solid #3c3c3c',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  layerList: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  },
  previewArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    background: '#1e1e1e',
  },
  canvas: {
    border: '1px solid #3c3c3c',
    background: '#2d2d2d',
  },
  welcomeMessage: {
    textAlign: 'center' as const,
    color: '#8e8e8e',
  },
  welcomeIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  layerRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'background 0.1s',
  },
  layerRowSelected: {
    background: '#094771',
  },
  layerRowHover: {
    background: '#2a2d2e',
  },
  layerToggle: {
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#8e8e8e',
    fontSize: '10px',
    flexShrink: 0,
  },
  layerIcon: {
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '4px',
    flexShrink: 0,
  },
  layerName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  layerCoords: {
    fontSize: '10px',
    color: '#6e6e6e',
    marginLeft: '8px',
  },
  detailsPanel: {
    padding: '12px',
    background: '#252526',
    borderTop: '1px solid #3c3c3c',
    maxHeight: '200px',
    overflow: 'auto',
  },
  detailsTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#bbbbbb',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '11px',
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
  },
  error: {
    color: '#f44747',
    padding: '20px',
    background: '#3c1f1f',
    margin: '16px',
    borderRadius: '4px',
  },
};

// 图层图标
const LayerIcon: React.FC<{ type: string }> = ({ type }) => {
  const iconMap: Record<string, string> = {
    group: '📁',
    pixel: '🖼️',
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
    paddingLeft: `${8 + depth * 16}px`,
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

export function App() {
  const [psdData, setPsdData] = useState<PsdParseResult | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<PsdLayer | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      setPsdData(null);
      setSelectedLayer(null);

      const paths = await hostApi.openFileDialog();
      if (!paths || paths.length === 0) {
        setLoading(false);
        return;
      }

      const selectedPath = paths[0];
      setFilePath(selectedPath);

      const result: PsdParseResult = await hostApi.parsePsd(selectedPath);
      
      if (result.success) {
        setPsdData(result);
      } else {
        setError(result.error || 'Failed to parse PSD file');
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // 绘制预览（简单示意，显示图层的边界框）
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !psdData || !psdData.layers) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置canvas大小
    const scale = 0.3;
    canvas.width = psdData.width! * scale;
    canvas.height = psdData.height! * scale;

    // 清空画布
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制选中图层的边界框
    if (selectedLayer && selectedLayer.width > 0) {
      ctx.strokeStyle = '#007acc';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        selectedLayer.left * scale,
        selectedLayer.top * scale,
        selectedLayer.width * scale,
        selectedLayer.height * scale
      );

      // 绘制图层名称
      ctx.fillStyle = '#007acc';
      ctx.font = '10px Consolas';
      ctx.fillText(
        selectedLayer.name,
        selectedLayer.left * scale,
        selectedLayer.top * scale - 4
      );
    }
  }, [psdData, selectedLayer]);

  React.useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  // 格式化坐标信息（Laya坐标系：左上角为原点）
  const formatLayaCoords = (layer: PsdLayer) => {
    if (layer.width <= 0) return 'N/A';
    return `x: ${layer.left}, y: ${layer.top}, w: ${layer.width}, h: ${layer.height}`;
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <span style={styles.title}>PSD Viewer</span>
        <button style={styles.openButton} onClick={handleOpenFile} disabled={loading}>
          {loading ? 'Loading...' : 'Open PSD File'}
        </button>
        {filePath && (
          <span style={styles.fileInfo} title={filePath}>
            {filePath.split(/[/\\]/).pop()}
          </span>
        )}
      </header>

      <div style={styles.mainContent}>
        {/* 左侧图层列表 */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>Layers</div>
          <div style={styles.layerList}>
            {loading && <div style={styles.loading}>Parsing PSD file...</div>}
            {error && <div style={styles.error}>{error}</div>}
            {!loading && !error && psdData?.layers?.map((layer, index) => (
              <LayerTreeItem
                key={`0.${index}`}
                layer={layer}
                depth={0}
                selectedLayer={selectedLayer}
                onSelect={setSelectedLayer}
                collapsedPaths={collapsedPaths}
                toggleCollapse={toggleCollapse}
                path={`0.${index}`}
              />
            ))}
            {!loading && !error && !psdData && (
              <div style={{ ...styles.welcomeMessage, padding: '20px' }}>
                <p>Open a PSD file to view layers</p>
              </div>
            )}
          </div>

          {/* 选中图层详情 */}
          {selectedLayer && (
            <div style={styles.detailsPanel}>
              <div style={styles.detailsTitle}>Layer Details</div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Name:</span>
                <span style={styles.detailValue}>{selectedLayer.name}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Type:</span>
                <span style={styles.detailValue}>{selectedLayer.type}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Visible:</span>
                <span style={styles.detailValue}>{selectedLayer.visible ? 'Yes' : 'No'}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Opacity:</span>
                <span style={styles.detailValue}>
                  {Math.round((selectedLayer.opacity / 255) * 100)}%
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Position (Laya):</span>
              </div>
              <div style={{ ...styles.detailRow, paddingLeft: '8px' }}>
                <span style={styles.detailValue}>{formatLayaCoords(selectedLayer)}</span>
              </div>
            </div>
          )}
        </aside>

        {/* 右侧预览区域 */}
        <main style={styles.previewArea}>
          {!psdData && !loading && !error && (
            <div style={styles.welcomeMessage}>
              <div style={styles.welcomeIcon}>📄</div>
              <p>Open a PSD file to begin</p>
              <p style={{ fontSize: '12px', marginTop: '8px' }}>
                Supports layer hierarchy and coordinates for Laya engine
              </p>
            </div>
          )}
          {psdData && (
            <div style={{ position: 'relative' }}>
              <canvas ref={canvasRef} style={styles.canvas} />
              <div
                style={{
                  position: 'absolute',
                  bottom: '-24px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '11px',
                  color: '#6e6e6e',
                  whiteSpace: 'nowrap',
                }}
              >
                Canvas: {psdData.width} × {psdData.height} (Laya coordinate system)
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
