/**
 * 生成PSD图层选择器独立窗口的HTML内容。
 * 该窗口通过 window.opener.postMessage 与父窗口(Laya2IDE)通信：
 *   → open-file          : 请求打开PSD文件对话框
 *   → select-layer       : 选中某个图层，发送 { name, left, top, width, height }
 *   → clear-selection    : 清除选中
 *
 * 父窗口回复：
 *   ← open-file-loading  : 开始解析
 *   ← open-file-result   : 解析完成，附带完整 PSD 数据
 *   ← open-file-error    : 解析失败
 *   ← open-file-cancel   : 用户取消选择文件
 */

interface PsdLayer {
  name: string;
  type: string;
  visible: boolean;
  opacity: number;
  left: number;
  top: number;
  width: number;
  height: number;
  children?: PsdLayer[];
}

export function getPsdPickerHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>PSD 图层选择器</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#1e1e1e; color:#d4d4d4; font-family:Consolas,'Courier New',monospace; font-size:12px; overflow:hidden; height:100vh; display:flex; flex-direction:column; }

/* ---- header ---- */
.header { display:flex; align-items:center; padding:8px 12px; background:#333; border-bottom:1px solid #3c3c3c; user-select:none; }
.header-title { flex:1; font-size:13px; font-weight:600; color:#fff; }
.header-close { background:transparent; border:none; color:#8e8e8e; font-size:18px; cursor:pointer; padding:0 4px; line-height:1; }
.header-close:hover { color:#fff; }

/* ---- toolbar ---- */
.toolbar { display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid #3c3c3c; }
.btn { padding:4px 10px; border:none; border-radius:3px; cursor:pointer; font-size:11px; color:#fff; }
.btn-primary { background:#0e639c; }
.btn-primary:hover { background:#1177bb; }
.btn-primary:disabled { background:#5a5a5a; cursor:not-allowed; }
.btn-secondary { background:#5a5a5a; }
.btn-secondary:hover { background:#6e6e6e; }
.file-info { font-size:10px; color:#8e8e8e; margin-left:auto; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* ---- layer list ---- */
.layer-list { flex:1; overflow-y:auto; overflow-x:hidden; padding:4px 0; }
.layer-list::-webkit-scrollbar { width:6px; }
.layer-list::-webkit-scrollbar-track { background:#1e1e1e; }
.layer-list::-webkit-scrollbar-thumb { background:#424242; border-radius:3px; }

.layer-row { display:flex; align-items:center; padding:3px 6px; cursor:pointer; transition:background .1s; white-space:nowrap; }
.layer-row:hover { background:#2a2d2e; }
.layer-row.selected { background:#094771; }
.layer-toggle { width:14px; flex-shrink:0; text-align:center; font-size:9px; color:#8e8e8e; }
.layer-icon { width:14px; flex-shrink:0; text-align:center; font-size:10px; margin-right:4px; }
.layer-name { flex:1; overflow:hidden; text-overflow:ellipsis; }
.layer-size { font-size:9px; color:#6e6e6e; margin-left:6px; }

/* ---- details ---- */
.details { padding:8px 10px; background:#1e1e1e; border-top:1px solid #3c3c3c; }
.details-title { font-weight:600; color:#bbb; margin-bottom:6px; }
.detail-row { display:flex; justify-content:space-between; padding:2px 0; }
.detail-label { color:#8e8e8e; }
.detail-value { color:#d4d4d4; }

/* ---- status ---- */
.status { padding:20px; text-align:center; color:#8e8e8e; font-size:11px; }
.status.error { color:#f44747; }
</style>
</head>
<body>

<div class="header">
  <span class="header-title">PSD 图层选择器</span>
  <button class="header-close" id="closeBtn">&times;</button>
</div>

<div class="toolbar">
  <button class="btn btn-primary" id="openBtn">打开 PSD</button>
  <button class="btn btn-secondary" id="clearBtn" style="display:none">清除选择</button>
  <span class="file-info" id="fileInfo"></span>
</div>

<div class="layer-list" id="layerList">
  <div class="status">打开一个 PSD 文件查看图层</div>
</div>

<div class="details" id="details" style="display:none">
  <div class="details-title">图层详情</div>
  <div id="detailsContent"></div>
</div>

<script>
(function() {
  var layerList = document.getElementById('layerList');
  var details   = document.getElementById('details');
  var detailsContent = document.getElementById('detailsContent');
  var openBtn   = document.getElementById('openBtn');
  var clearBtn  = document.getElementById('clearBtn');
  var closeBtn  = document.getElementById('closeBtn');
  var fileInfo  = document.getElementById('fileInfo');

  var psdData = null;
  var selectedLayer = null;
  var collapsedPaths = {};

  function post(data) {
    window.opener && window.opener.postMessage(Object.assign({ source: 'psd-picker' }, data), '*');
  }

  // ---- close ----
  closeBtn.addEventListener('click', function() { window.close(); });

  // ---- open file ----
  openBtn.addEventListener('click', function() {
    openBtn.disabled = true;
    openBtn.textContent = '等待选择...';
    layerList.innerHTML = '<div class="status">请在主窗口中选择 PSD 文件...</div>';
    post({ type: 'open-file' });
  });

  // ---- clear ----
  clearBtn.addEventListener('click', function() {
    selectedLayer = null;
    clearBtn.style.display = 'none';
    details.style.display = 'none';
    highlightRow(null);
    post({ type: 'clear-selection' });
  });

  // ---- listen for parent messages ----
  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || data.source !== 'laya2ide') return;

    if (data.type === 'open-file-cancel') {
      openBtn.disabled = false;
      openBtn.textContent = '打开 PSD';
      layerList.innerHTML = '<div class="status">打开一个 PSD 文件查看图层</div>';
    }

    if (data.type === 'open-file-loading') {
      fileInfo.textContent = data.filePath.split(/[\\\\/]/).pop() || '';
      layerList.innerHTML = '<div class="status">解析 PSD 文件...</div>';
    }

    if (data.type === 'open-file-error') {
      openBtn.disabled = false;
      openBtn.textContent = '打开 PSD';
      layerList.innerHTML = '<div class="status error">' + escHtml(data.error) + '</div>';
    }

    if (data.type === 'open-file-result') {
      openBtn.disabled = false;
      openBtn.textContent = '打开 PSD';
      var result = data.result;
      if (result && result.success) {
        psdData = result;
        selectedLayer = null;
        clearBtn.style.display = 'none';
        details.style.display = 'none';
        collapsedPaths = {};
        renderLayers(result.layers || []);
      } else {
        layerList.innerHTML = '<div class="status error">' + escHtml((result && result.error) || '解析失败') + '</div>';
      }
    }
  });

  // ---- render ----
  var iconMap = { group:'📁', pixel:'🖼', text:'📝', shape:'⬛', smart:'🔗' };

  function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function renderLayers(layers) {
    layerList.innerHTML = '';
    if (!layers || layers.length === 0) {
      layerList.innerHTML = '<div class="status">该 PSD 没有图层</div>';
      return;
    }
    layers.forEach(function(layer, i) {
      layerList.appendChild(buildItem(layer, 0, '0.' + i));
    });
  }

  function buildItem(layer, depth, path) {
    var hasChildren = layer.type === 'group' && layer.children && layer.children.length > 0;
    var collapsed = !!collapsedPaths[path];

    var row = document.createElement('div');
    row.className = 'layer-row' + (selectedLayer === layer ? ' selected' : '');
    row.style.paddingLeft = (6 + depth * 12) + 'px';
    row.dataset.path = path;

    row.innerHTML =
      '<span class="layer-toggle">' + (hasChildren ? (collapsed ? '▶' : '▼') : '') + '</span>' +
      '<span class="layer-icon">' + (iconMap[layer.type] || '📄') + '</span>' +
      '<span class="layer-name">' + escHtml(layer.name) + '</span>' +
      (layer.width > 0 ? '<span class="layer-size">' + layer.width + '×' + layer.height + '</span>' : '');

    row.addEventListener('click', function(e) {
      if (e.target.classList.contains('layer-toggle') && hasChildren) {
        collapsedPaths[path] = !collapsedPaths[path];
        rebuildTree();
        return;
      }
      selectedLayer = layer;
      highlightRow(row);
      showDetails(layer);
      if (layer.width > 0) {
        clearBtn.style.display = '';
        post({ type: 'select-layer', layer: { name: layer.name, left: layer.left, top: layer.top, width: layer.width, height: layer.height } });
      }
    });

    var fragment = document.createDocumentFragment();
    fragment.appendChild(row);

    if (hasChildren && !collapsed) {
      layer.children.forEach(function(child, ci) {
        fragment.appendChild(buildItem(child, depth + 1, path + '.' + ci));
      });
    }

    return fragment;
  }

  function highlightRow(activeRow) {
    var rows = layerList.querySelectorAll('.layer-row');
    rows.forEach(function(r) { r.classList.remove('selected'); });
    if (activeRow) activeRow.classList.add('selected');
  }

  function rebuildTree() {
    if (!psdData || !psdData.layers) return;
    renderLayers(psdData.layers);
  }

  function showDetails(layer) {
    details.style.display = '';
    detailsContent.innerHTML =
      '<div class="detail-row"><span class="detail-label">名称:</span><span class="detail-value">' + escHtml(layer.name) + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">类型:</span><span class="detail-value">' + escHtml(layer.type) + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">坐标:</span><span class="detail-value">x: ' + layer.left + ', y: ' + layer.top + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">尺寸:</span><span class="detail-value">' + layer.width + ' × ' + layer.height + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">可见:</span><span class="detail-value">' + (layer.visible ? '是' : '否') + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">不透明度:</span><span class="detail-value">' + layer.opacity + '</span></div>';
  }
})();
</script>
</body>
</html>`;
}
