# Laya2IDE 重构演进计划与架构建议

在经历 `laya-scene-viewer` 的初步探索后，为了解决状态同步混乱、画布重绘性能差以及组件耦合较重等“历史包袱”，我们决定推翻重来，构建一个真正意义上的 **Laya2IDE**（视觉编辑器）。

这份文档旨在梳理新 IDE 的核心目标、架构设计以及分步实施计划。在编写任何代码之前，请先评估以下方案。

## 1. 痛点分析与新架构设计

### 1.1 之前版本的问题 (Why start over?)
- **状态管理单一**: 所有数据（`sceneData`, `selectedHit`, `version`）都堆在顶层 `App.tsx` 中，任何一个属性的修改都会导致整个 React 树连带 Canvas 完全重绘。
- **职责未分离**: 画布 (Canvas) 既负责渲染 Laya 节点，又硬编码了“红色选中框”和“鼠标平移缩放”的逻辑，一旦要加拖拽改变坐标、辅助线功能，Canvas 代码将变得极度臃肿。
- **缺乏编辑器必需的基础设施**: 撤销/重做 (Undo/Redo) 难以实现，因为没有采用 Immutable 数据或 Action 模式。

### 1.2 新架构建议 (Architecture Recommendations)
- **状态管理中心化 (Store)**: 引入 `Zustand`（无视图更新开销）或其他轻量级 Store。树形结构数据的更新，应该做到**只刷新受波及的 UI 组件**。
- **图层渲染分离 (Layered Rendering)**: 
  - **Scene Layer**: 纯粹负责渲染 `.scene` 数据（如同 Laya 引擎渲染），有自己的离屏缓存机制。
  - **Gizmo/UI Layer**: 顶层覆盖的画布，专职负责渲染网格、选中高亮框、缩放/旋转句柄（Handles）。
- **统一事件总线 (Event Bus / Controller)**: 抽离专门的工具类系统，管理 `Select`, `Drag`, `Zoom`, `PropertyChange` 等行为，将其封装为单独的命令 (Command) 便于实现历史回溯。

---

## 2. 核心模块规划 (模块化拆分)

我们建议采用以下的目录与模块拆分方式：

```text
mock/mck-app/Laya2IDE/
├── app.json                  # 小程序配置
├── src/
│   ├── main.tsx              # 入口，包裹所需 Provider
│   ├── App.tsx               # IDE 整体的左中右布局骨架
│   ├── types/
│   │   ├── scene.ts          # Laya 节点接口定义
│   │   └── editor.ts         # 编辑器相关（如 Gizmo，HitTest）
│   ├── store/
│   │   ├── sceneStore.ts     # 管理节点树增删改、以及当前的选中态
│   │   └── historyStore.ts   # 撤销/重做栈 (Undo/Redo)
│   ├── core/
│   │   ├── Renderer.ts       # 纯粹的 Canvas2D / WebGL 渲染引擎类（不依赖React）
│   │   └── Interaction.ts    # 捕捉鼠标事件并抛出拖拽/选中 Action
│   ├── components/
│   │   ├── Layout/           # 布局容器
│   │   ├── Hierarchy/        # 层级树 (左) - 采用虚拟列表或支持精确更新的树
│   │   ├── Viewport/         # 中心视口 (中)
│   │   │   ├── SceneCanvas.tsx # 实际渲染区
│   │   │   └── GizmoCanvas.tsx # 交互轮廓/控制点覆盖区
│   │   └── Inspector/        # 属性面板 (右) - 动态表单表单机制
│   └── utils/
│       ├── parseUtils.ts     # 读取/反序列化/存储 .scene
│       └── resource.ts       # 解析 workspace-file:// 资源
```

---

## 3. 分期实施计划 (Implementation Phases)

### Phase 1: 基础设施架设 (Foundation) ✅
1. 初始化 `app.json` 和 React 入口 (`src/main.tsx`)。
2. 搭建基于 Zustand 的 `sceneStore`，先实现最小能力：`nodes` + `selectNode`。
3. 完成左、中、右经典 IDE 骨架布局：
  - 左侧 Hierarchy 暂以占位矩形替代。
  - 中间 Viewport 已实现 Canvas 渲染（基础网格 + 模拟节点矩形 + 点击选中高亮）。
  - 右侧 Inspector 暂以占位矩形替代。

> 当前实现目标是“打通运行链路 + 验证中间渲染区”，先不进入真实 `.scene` 解析与属性编辑。

### Phase 2: 视图与渲染器解耦 (Renderer Separation) ✅
1. 已将绘制逻辑从 `SceneCanvas.tsx` 中抽离到独立类 `src/core/Renderer.ts`。
2. 新增 `SceneRenderer`（负责场景与节点渲染）与 `GizmoRenderer`（负责选中框等覆盖层渲染）。
3. `SceneCanvas` 已升级为双 Canvas 结构：
  - 底层 `sceneCanvas`：渲染网格与场景内容。
  - 顶层 `gizmoCanvas`：仅渲染选中框，并承载交互事件（点击选中、滚轮缩放、中键平移）。
4. 命中测试逻辑已抽离为 `hitTestSceneNode`，避免组件继续膨胀。
5. ✅ 已支持 `.scene` 根节点背景图 (`sceneBg`)：
  - 当首节点为 `Scene / View / Dialog` 且 `props.sceneBg` 存在时，会按 `laya/...` 规则解析路径并预加载图片。
  - 解析策略：从 scene 文件路径向上查找 `Laya/laya` 父路径，再拼接 `sceneBg` 的余下路径。
  - 预加载成功后作为根节点之上的独立参考图层绘制，按图片原生宽高渲染，左上角与节点左上角对齐。
  - 该参考图层完全不参与选中框和点击命中计算，也不影响节点自身 `width/height`。

> 当前结果：渲染职责已明确分层，后续可在不影响 Scene 渲染的情况下独立扩展 Gizmo（拖拽手柄、辅助线、锚点等）。

### Phase 3: 真正的交互能力 (Interaction & Drag)
1. ✅ 在 Viewport 顶层附加独立事件监听，实现可靠的 **缩放平移 (Pan/Zoom)**（已采用 Pointer Capture 重构中键平移）。
2. ✅ 已支持 Gizmo 层拖拽节点坐标：
  - 在中间视图先选中对象，再次按住左键拖动可修改该节点 `x/y`。
  - 拖拽过程实时同步 `sceneStore`，视图与选中框同时刷新。
  - 与中键平移解耦：采用 Pointer Capture + 交互模式状态机（`pan` / `drag`）。
3. ✅ 编辑器脏状态与保存链路已打通：
  - 属性变更会设置 `isDirty = true`，并通过 `postMessage(type: 'set-dirty')` 回传宿主，标签页显示 `*`。
  - 支持 `Ctrl+S / Cmd+S`，触发 `postMessage(type: 'save-file')` 将当前 scene 序列化后写回源 `.scene` 文件。
4. ✅ 键盘位移与撤销已接入：
  - 支持方向键 `↑ ↓ ← →` 直接移动当前选中对象坐标。
  - 移动步长与当前缩放相关：视角越远（缩放越小）步长越大；视角越近步长越小；始终为整数且最小值为 `1`。
  - 支持 `Ctrl+Z / Cmd+Z` 撤销对象属性变更。
  - 支持 `Ctrl+Y` 与 `Cmd/Ctrl+Shift+Z` 重做。
  - 针对方向键连续移动，撤销采用“会话合并”策略：一次连续按键撤销会回到该次连续操作的初始位置，而不是逐键回退。
  - 鼠标拖拽同样使用单次历史会话：一次拖动只记录鼠标按下时的位置，`Ctrl+Z` 会回到拖拽开始点，而不是回退到上一个拖拽中间帧。

### Phase 4: 层级与属性面板的强化 (Hierarchy & Inspector) *(In Progress)*
1. ✅ 左侧层级树已从占位替换为真实结构渲染：
  - 基于 `.scene` 递归渲染节点树。
  - 节点命名采用 `props.var` > `props.name` > `type` 的回退策略。
  - 支持折叠/展开子节点。
  - 点击层级节点可联动中间 Viewport 选中（通过反查节点包围盒，映射为 `selectedHit`）。
2. ⏳ 待完成：右键菜单（`Add`, `Delete`, `Duplicate`）。
3. ✅ 右侧 Inspector 最小可用版已落地：
  - 支持对选中节点的 `x / y / width / height` 四个数值字段进行编辑。
  - 编辑后实时刷新中间 Viewport。
  - 若选中节点为空，显示引导态文案。
4. ✅ 属性更新链路已升级：Inspector 写入统一改为走 Store action `updateSelectedNodeProps`，为后续 Undo/Redo 接入做准备。
5. ✅ Inspector 已扩展类型专属字段：
  - `Label`: `text / color / fontSize`
  - `Image/Sprite`: `skin / texture`
6. ⏳ 待完成：Inspector 升级为更通用的 schema 动态表单（按节点类型配置渲染规则），减少硬编码字段。
7. ✅ 已完成“按节点粒度”的私有属性管理（持久化到 appdata）：
  - 每次加载 scene 会遍历节点生成私有状态项：`id + path`，并在 Inspector 底部展示当前选中节点的私有配置。
  - 当前支持私有字段：`Reference Visible`（开关）与 `Opacity`（透明度），按“选中节点”独立编辑。
  - 私有属性不写入 `.scene`，而是按 `appId + sceneFilePath` 作为 key 存储到 `app.getPath('userData')/miniapp-private/`。
  - 重新打开同一 scene 会自动从 appdata 回填；若历史 path 与当前节点路径不匹配，则该节点私有状态自动回退默认值并分配新 id。
8. ✅ 已支持节点改名工作流（Hierarchy + Inspector 双入口）：
  - Hierarchy 选中节点后按 `F2` 进入行内改名，`Enter` 提交、`Esc` 取消、失焦自动提交。
  - Inspector 已将 `name + var` 作为独立的 `Identity` 区块统一编辑（不与 Transform 混排）。
  - 改名会触发脏标记，并可通过 `Ctrl+S / Cmd+S` 保存回 `.scene`。
  - 对齐 Laya 原生改名语义：修改 `name` 时同步更新与 `props` 同级的 `label`；修改 `name/var` 任一字段都会重建与 `props` 同级的 `searchKey=type,name,var`；当 `name` 或 `var` 为空时，对应 key 会被删除，`searchKey` 只保留非空片段，`label` 会回退为 `type`。
  - `name` / `var` 不允许数字开头；如果输入不合法，会直接删除对应 key，不会留下空字符串。
9. ✅ 已支持层级树右键菜单（首个能力：创建 `ImageUI`）：
  - 在 Hierarchy 右键任意节点可打开菜单并执行“创建 ImageUI”。
  - 新节点会追加到该节点的 `child` 数组，结构遵循当前 Laya 数据约定（固定 `skin=comp/image.png`，`props` 不再包含默认 `x/y`，根级 `x` 按层级深度计算：顶级 `0`，每深一层 `+15`，并包含 `nodeParent/compId` 等字段）。
  - `compId` 直接读取顶层节点 `maxID` 作为新组件 id，然后立即将 `maxID` 自增回写；`nodeParent` 取当前右键节点 id（`compId`）。
  - `isDirectory` 与 `hasChild` 保持一致（当前阶段按同值写入与更新）。
  - 创建后会自动刷新层级树并选中新节点，同时触发脏标记。
10. ✅ 已支持节点删除（右键菜单 + `Delete` 快捷键）：
  - 在 Hierarchy 右键菜单可删除当前节点（根节点不可删除）。
  - 支持键盘 `Delete` 快捷删除当前选中节点（编辑输入状态下不会触发）。
  - 删除后若父节点已无子节点，会自动将 `hasChild=false`，并同步 `isDirectory=false`。
  - 删除后会自动选中父节点，并触发脏标记。
  - ✅ 删除已接入 Undo/Redo 历史：支持连续多次删除后，通过 `Ctrl+Z / Cmd+Z` 按顺序逐步回退，并可通过 `Ctrl+Y / Cmd+Shift+Z` 逐步重做。

> 当前状态：左侧区域已具备实用形态，后续重点转向“结构编辑 + 属性编辑”双闭环。

### Phase 4.1 建议迭代顺序 (Next)
1. 先做 Hierarchy 右键菜单中的 `Delete`（最小破坏性），验证节点树与画布的一致更新。
2. 再加入属性编辑后的资源刷新链路：当 `skin/texture` 变化时触发对应图片预加载，避免视图滞后。
3. 最后加入 `Duplicate` 与 `Add`，并同步接入 Undo/Redo 的 Action 轨道。
4. 建议将右键菜单能力统一为命令系统（`CreateImageUI / Duplicate / Delete / Rename`），便于复用与历史回放。
5. 建议将“层级派生字段”（如 `x`、`isDirectory`、`hasChild`）统一封装在创建器/变更器中，避免未来不同入口产生不一致数据。

### 交互优化建议 (新增)
1. 拖拽建议加入“最小位移阈值”判断（如 2~4 px），避免轻微手抖触发误拖。
2. 拖拽建议支持按住 `Shift` 进行轴向锁定（只移动 X 或 Y），提高精确摆放效率。
3. 在拖拽结束时追加一次“单步历史记录 push”，便于后续 Undo/Redo 做到一步回退。
4. 建议在 Inspector 中补充 `sceneBg` 字段编辑与“手动重载背景”按钮，方便验证美术资源替换。

### 保存机制说明 (新增)
1. 当前保存策略为“整文件重写”：将内存中的 scene JSON 全量序列化写回磁盘，并通过定制格式化器输出（如 `:` 后无空格、`props` 内联、`child/nodes` 空数组保留换行结构），同时保持 `CRLF` 换行风格。
2. 该策略能稳定落地当前迭代目标；后续若要做真正“增量 patch 保存”，可在 `applySceneMutation` 层记录操作日志并输出差异补丁。
3. ✅ 已引入保存点（savePoint）逻辑：
  - 保存成功时记录当前历史游标为保存点。
  - Undo/Redo 后若历史游标回到保存点，会自动清除标签页 `*`。
  - 若偏离保存点，`*` 自动恢复显示。

### Phase 4.2 建议实现细节 (新增)
1. Inspector 建议拆分为 “基础 Transform 组 + 类型专属组”，避免所有字段混在一个面板中。
2. ✅ 属性更新已统一走 Store action（`updateSelectedNodeProps`），组件侧不再直接散落写入逻辑。
3. 在 Inspector 输入中增加 `onBlur` 提交策略（可选），为未来 Undo/Redo 做“单次操作合并”预留空间。
4. 建议新增 `applySceneMutation` 统一入口（批处理 + dirty 标记 + history push），避免后续增删节点时动作分散。
5. ✅ 已支持 `Ctrl+Y / Cmd+Shift+Z` 重做链路，与 `Ctrl+Z` 配套。
6. ✅ 已支持保存点回归自动清除 `*`。
7. 拖拽和键盘移动都建议使用“会话 ID + 合并策略”统一管理，避免后续不同交互来源的历史碎片化。
8. 建议后续在 UI 底部状态栏增加 `History: cursor/total` 调试信息，便于验证复杂编辑链路。
9. 建议增加背景图加载失败可视化提示（例如状态栏 warning），便于快速定位 `sceneBg` 路径问题。
10. 如果后续需要背景图编辑，建议单独做“背景资源面板”，不要复用普通节点 Inspector 字段。
11. 建议为私有属性增加“重置默认值”按钮（例如恢复 `visible=true`, `opacity=1`），便于快速回到标准对照模式。
12. 建议在私有属性存储中加入 `version` 字段，便于后续兼容升级（字段迁移）。

### Phase 5: 高级编辑器向 (Advanced IDE Features)
1. 添加撤销与重做系统 (Undo/Redo Pipeline)。
2. 支持辅助对其线 (Snap Guidelines)。

---

## 4. 后续沟通

当您评估这套全新的 `mock/mck-app/Laya2IDE` 架构逻辑可行后，我们可以开始从 **Phase 1** 稳扎稳打地实施。
如果您有任何针对此计划的增删改意见，请随时提出！