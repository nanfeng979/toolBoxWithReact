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

> 当前结果：渲染职责已明确分层，后续可在不影响 Scene 渲染的情况下独立扩展 Gizmo（拖拽手柄、辅助线、锚点等）。

### Phase 3: 真正的交互能力 (Interaction & Drag)
1. 在 Viewport 顶层附加独立事件监听，实现可靠的 **缩放平移 (Pan/Zoom)**。
2. 引入 **编辑控制器 (Controller)**，在选中节点后，计算其局部坐标，允许在 Gizmo 层上长按并拖拽改变节点的 `x` 和 `y`，并实时同步给 `sceneStore`。

### Phase 4: 层级与属性面板的强化 (Hierarchy & Inspector)
1. 层级树：在原有基础上增加“右键唤出菜单”，支持 `Add`, `Delete`, `Duplicate`。
2. 属性面板：抽象为表单项（NumberInput, StringInput, Select）。

### Phase 5: 高级编辑器向 (Advanced IDE Features)
1. 添加撤销与重做系统 (Undo/Redo Pipeline)。
2. 支持辅助对其线 (Snap Guidelines)。

---

## 4. 后续沟通

当您评估这套全新的 `mock/mck-app/Laya2IDE` 架构逻辑可行后，我们可以开始从 **Phase 1** 稳扎稳打地实施。
如果您有任何针对此计划的增删改意见，请随时提出！