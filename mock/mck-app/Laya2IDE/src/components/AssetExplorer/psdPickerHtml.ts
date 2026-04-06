/**
 * 生成PSD图层选择器独立窗口的HTML内容。
 * 该窗口通过 window.opener.postMessage 与父窗口(Laya2IDE)通信：
 *   → open-file          : 请求打开PSD文件对话框
 *   → apply-coords       : 应用图层坐标到父窗口选中的节点
 *
 * 父窗口回复：
 *   ← open-file-loading  : 开始解析
 *   ← open-file-result   : 解析完成，附带完整 PSD 数据
 *   ← open-file-error    : 解析失败
 *   ← open-file-cancel   : 用户取消选择文件
 *   ← selected-node-update : 父窗口选中节点变化
 *   ← apply-coords-success : 坐标应用成功
 */

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

/* ---- selected node indicator ---- */
.selected-node-info { padding:6px 10px; background:#2d2d30; border-bottom:1px solid #3c3c3c; font-size:11px; }
.selected-node-info .label { color:#8e8e8e; }
.selected-node-info .name { color:#4ec9b0; margin-left:6px; }
.selected-node-info .none { color:#6e6e6e; }

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
.apply-btn { padding:1px 6px; margin-left:6px; background:#0e639c; color:#fff; border:none; border-radius:2px; font-size:10px; cursor:pointer; }
.apply-btn:hover { background:#1177bb; }
.apply-btn:disabled { background:#5a5a5a; color:#8e8e8e; cursor:not-allowed; }

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
  <label style="margin-right: 12px; font-size: 11px; display: flex; align-items: center; gap: 4px; cursor: pointer; color: #bbb;">
    <input type="checkbox" id="alwaysOnTopCb" /> 永远在前
  </label>
  <button class="header-close" id="closeBtn">&times;</button>
</div>

<div class="toolbar">
  <button class="btn btn-primary" id="openBtn">打开 PSD</button>
  <span class="file-info" id="fileInfo"></span>
</div>

<div class="selected-node-info" id="selectedNodeInfo">
  <span class="label">目标节点:</span>
  <span class="none" id="selectedNodeName">无选中节点</span>
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
  var closeBtn  = document.getElementById('closeBtn');
  var fileInfo  = document.getElementById('fileInfo');
  var selectedNodeName = document.getElementById('selectedNodeName');
  var alwaysOnTopCb = document.getElementById('alwaysOnTopCb');

  var psdData = null;
  var selectedLayer = null;
  var collapsedPaths = {};
  var parentSelectedNodeLabel = null;  // 父窗口选中的节点标签

  function post(data) {
    window.opener && window.opener.postMessage(Object.assign({ source: 'psd-picker' }, data), '*');
  }

  // ---- always on top ----
  if (alwaysOnTopCb) {
    alwaysOnTopCb.addEventListener('change', function(e) {
      post({ type: 'toggle-top', value: e.target.checked });
    });
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
        details.style.display = 'none';
        collapsedPaths = {};
        renderLayers(result.layers || []);
      } else {
        layerList.innerHTML = '<div class="status error">' + escHtml((result && result.error) || '解析失败') + '</div>';
      }
    }

    // 父窗口选中节点变化
    if (data.type === 'selected-node-update') {
      parentSelectedNodeLabel = data.nodeLabel;
      updateSelectedNodeDisplay();
      // 重新渲染图层列表以更新按钮状态
      if (psdData && psdData.layers) {
        renderLayers(psdData.layers);
      }
    }

    // 坐标应用成功
    if (data.type === 'apply-coords-success') {
      // 可以显示成功提示
    }
  });

  function updateSelectedNodeDisplay() {
    if (parentSelectedNodeLabel) {
      selectedNodeName.className = 'name';
      selectedNodeName.textContent = parentSelectedNodeLabel;
    } else {
      selectedNodeName.className = 'none';
      selectedNodeName.textContent = '无选中节点';
    }
  }

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
    var isSelected = selectedLayer === layer;
    var canApply = !!parentSelectedNodeLabel && layer.width > 0;

    var row = document.createElement('div');
    row.className = 'layer-row' + (isSelected ? ' selected' : '');
    row.style.paddingLeft = (6 + depth * 12) + 'px';
    row.dataset.path = path;

    var html =
      '<span class="layer-toggle">' + (hasChildren ? (collapsed ? '▶' : '▼') : '') + '</span>' +
      '<span class="layer-icon">' + (iconMap[layer.type] || '📄') + '</span>' +
      '<span class="layer-name">' + escHtml(layer.name) + '</span>';

    // 选中时显示"应用"按钮，否则显示尺寸
    if (isSelected && layer.width > 0) {
      html += '<button class="apply-btn"' + (canApply ? '' : ' disabled') + '>应用</button>';
    } else if (layer.width > 0) {
      html += '<span class="layer-size">' + layer.width + '×' + layer.height + '</span>';
    }

    row.innerHTML = html;

    // 点击切换折叠
    var toggle = row.querySelector('.layer-toggle');
    if (toggle && hasChildren) {
      toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        collapsedPaths[path] = !collapsedPaths[path];
        rebuildTree();
      });
    }

    // 点击行选中图层
    row.addEventListener('click', function(e) {
      if (e.target.classList.contains('apply-btn')) return;
      selectedLayer = layer;
      showDetails(layer);
      rebuildTree();
    });

    // 应用按钮点击
    var applyBtn = row.querySelector('.apply-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!parentSelectedNodeLabel) return;
        post({
          type: 'apply-coords',
          left: layer.left,
          top: layer.top
        });
      });
    }

    var fragment = document.createDocumentFragment();
    fragment.appendChild(row);

    if (hasChildren && !collapsed) {
      layer.children.forEach(function(child, ci) {
        fragment.appendChild(buildItem(child, depth + 1, path + '.' + ci));
      });
    }

    return fragment;
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

  // 初始化显示
  updateSelectedNodeDisplay();
})();
</script>
</body>
</html>`;
}
