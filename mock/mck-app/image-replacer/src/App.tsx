import React, { useState, useMemo } from 'react';

// --- Types ---
interface ImageItem {
  id: string;   // Unique ID (path)
  name: string; // File name
  path: string; // Absolute path
  url: string;  // Asset URL for img src
  isCommon: boolean; // Flag to indicate if it has same name in both sides
}

// --- Helpers ---
const isImage = (filename: string) => {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
};

const getAssetUrl = (filePath: string) => {
  // 把反斜杠替换为正斜杠，避免 URL 解析问题
  const normalizedPath = filePath.replace(/\\/g, '/');
  // 使用标准的 origin 格式 asset://host/，后面跟上绝对路径
  return `asset://host/${encodeURIComponent(normalizedPath)}`;
};

export function App() {
  const [leftFiles, setLeftFiles] = useState<ImageItem[]>([]);
  const [rightFiles, setRightFiles] = useState<ImageItem[]>([]);
  const [leftSelected, setLeftSelected] = useState<string | null>(null);
  const [rightSelected, setRightSelected] = useState<string | null>(null);

  // --- Handlers ---
  const handleLoadLeft = async () => {
    if (!window.hostApi) return alert('Host API 不可用');
    const dir = await window.hostApi.openDirectoryDialog();
    if (dir) {
      const files = await window.hostApi.readDirectoryFiles(dir);
      const images = files
        .filter(f => isImage(f.name))
        .map(f => ({
          id: f.path,
          name: f.name,
          path: f.path,
          url: getAssetUrl(f.path),
          isCommon: false
        }));
      setLeftFiles(images);
      setLeftSelected(null);
    }
  };

  const handleLoadRight = async () => {
    if (!window.hostApi) return alert('Host API 不可用');
    const dir = await window.hostApi.openDirectoryDialog();
    if (dir) {
      const files = await window.hostApi.readDirectoryFiles(dir);
      const images = files
        .filter(f => isImage(f.name))
        .map(f => ({
          id: f.path,
          name: f.name,
          path: f.path,
          url: getAssetUrl(f.path),
          isCommon: false
        }));
      setRightFiles(images);
      setRightSelected(null);
    }
  };

  const handleSortAndHighlight = () => {
    const leftNames = new Set(leftFiles.map(f => f.name));
    const rightNames = new Set(rightFiles.map(f => f.name));
    const commonNames = new Set([...leftNames].filter(x => rightNames.has(x)));

    // Mark and Sort Left
    const newLeft = [...leftFiles].map(f => ({ ...f, isCommon: commonNames.has(f.name) }));
    newLeft.sort((a, b) => {
      if (a.isCommon && !b.isCommon) return -1;
      if (!a.isCommon && b.isCommon) return 1;
      return a.name.localeCompare(b.name);
    });
    setLeftFiles(newLeft);

    // Mark and Sort Right
    const newRight = [...rightFiles].map(f => ({ ...f, isCommon: commonNames.has(f.name) }));
    newRight.sort((a, b) => {
      if (a.isCommon && !b.isCommon) return -1;
      if (!a.isCommon && b.isCommon) return 1;
      return a.name.localeCompare(b.name);
    });
    setRightFiles(newRight);
  };

  const handleReplace = async () => {
    if (!leftSelected || !rightSelected) {
      alert('请先在两侧各选择一张图片。');
      return;
    }
    
    const targetImg = leftFiles.find(f => f.id === leftSelected);
    const sourceImg = rightFiles.find(f => f.id === rightSelected);
    
    if (!targetImg || !sourceImg) return;
    if (!window.hostApi) return alert('Host API 不可用');

    const confirmed = window.confirm(`是否替换左侧图片：\n"${targetImg.name}"\n使用右侧选中的图片覆盖？`);
    if (!confirmed) return;

    // Use host API to copy right file to left path
    const result = await window.hostApi.copyFile(sourceImg.path, targetImg.path);
    if (result.success) {
      // Force refresh the left image by appending a timestamp to bypass browser cache
      const ts = new Date().getTime();
      setLeftFiles(prev => prev.map(f => 
        f.id === targetImg.id 
          ? { ...f, url: `${getAssetUrl(f.path)}?t=${ts}` }
          : f
      ));
      window.hostApi.showNotification('成功', `图片替换成功。`);
    } else {
      alert(`替换失败: ${result.error}`);
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.buttonGroup}>
          <button style={styles.button} onClick={handleLoadLeft}>加载左侧文件夹</button>
          <button style={styles.button} onClick={handleLoadRight}>加载右侧文件夹</button>
        </div>
        <div style={styles.buttonGroup}>
          <button style={styles.buttonMatch} onClick={handleSortAndHighlight}>排序并高亮相同项</button>
          <button style={styles.buttonReplace} onClick={handleReplace}>执行替换 (右 ➜ 左)</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.splitView}>
        {/* Left View */}
        <div style={styles.viewPanel}>
          <div style={styles.panelHeader}>左侧面板 ({leftFiles.length} 个文件)</div>
          <div style={styles.grid}>
            {leftFiles.map(img => (
              <div 
                key={img.id} 
                style={leftSelected === img.id ? styles.cardSelected : styles.card}
                onClick={() => setLeftSelected(img.id)}
              >
                <div style={styles.imageWrapper}>
                  <img src={img.url} alt={img.name} style={styles.img} />
                </div>
                <div style={{...styles.fileName, color: img.isCommon ? '#4ade80' : '#e2e8f0'}}>
                  {img.name}
                </div>
              </div>
            ))}
            {leftFiles.length === 0 && <div style={styles.emptyText}>空</div>}
          </div>
        </div>

        {/* Right View */}
        <div style={{ ...styles.viewPanel, borderLeft: '1px solid #334155' }}>
          <div style={styles.panelHeader}>右侧面板 ({rightFiles.length} 个文件)</div>
          <div style={styles.grid}>
            {rightFiles.map(img => (
              <div 
                key={img.id} 
                style={rightSelected === img.id ? styles.cardSelected : styles.card}
                onClick={() => setRightSelected(img.id)}
              >
                <div style={styles.imageWrapper}>
                  <img src={img.url} alt={img.name} style={styles.img} />
                </div>
                <div style={{...styles.fileName, color: img.isCommon ? '#4ade80' : '#e2e8f0'}}>
                  {img.name}
                </div>
              </div>
            ))}
            {rightFiles.length === 0 && <div style={styles.emptyText}>空</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Inline Styles ---
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  } as React.CSSProperties,
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
    flexShrink: 0
  } as React.CSSProperties,
  buttonGroup: {
    display: 'flex',
    gap: '12px'
  } as React.CSSProperties,
  button: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    transition: 'background 0.2s'
  } as React.CSSProperties,
  buttonMatch: {
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
  } as React.CSSProperties,
  buttonReplace: {
    padding: '8px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
  } as React.CSSProperties,
  splitView: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  } as React.CSSProperties,
  viewPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative'
  } as React.CSSProperties,
  panelHeader: {
    padding: '8px 16px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #334155',
    fontWeight: 600,
    fontSize: '14px',
    color: '#94a3b8'
  } as React.CSSProperties,
  grid: {
    flex: 1,
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '16px',
    padding: '16px',
    alignContent: 'start'
  } as React.CSSProperties,
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: '#1e293b',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  cardSelected: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: '#1e293b',
    border: '2px solid #3b82f6',
    cursor: 'pointer',
    boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
  } as React.CSSProperties,
  imageWrapper: {
    width: '120px',
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px'
  } as React.CSSProperties,
  img: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain'
  } as React.CSSProperties,
  fileName: {
    fontSize: '12px',
    textAlign: 'center',
    wordBreak: 'break-word',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    width: '100%'
  } as React.CSSProperties,
  emptyText: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    color: '#64748b',
    marginTop: '40px'
  } as React.CSSProperties
};