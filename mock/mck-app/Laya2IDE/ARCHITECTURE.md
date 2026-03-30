# Laya2IDE 项目架构与模块说明

本文档对 Laya2IDE（一个用于解析和渲染 LayaAir 2.x `*.scene` 文件的仿原生的视觉编辑器应用）进行宏观层面的架构剖析与模块介绍。本指南旨在帮助新加入该项目或日后维护的开发者快速建立对代码结构、状态管理方案及渲染机制的理解。

## 一、项目概述

Laya2IDE 是一个 React 单页应用，用于在一个轻便的 Web 环境（Electron 等容器结合的内嵌页或 iframe）中提供对 Laya scene 文件的可视化展示与部分编辑功能。

该项目经历了重构（解决早先 `laya-scene-viewer` 性能瓶颈与高藕合问题），目前的架构遵循了以下核心原则：
1. **状态中心化与精准渲染**：通过 `zustand` 统一管理 Scene 属性与编辑器状态，解决顶层 State 更新导致的全局重绘问题。
2. **渲染层分离 (Layered Rendering)**：将 `Scene（场景渲染）` 和 `Gizmo（交互/辅助层）` 进行解耦分层，使用纯原生 Canvas API 完成渲染以保证性能。
3. **职责解耦的经典 IDE 布局**：划分为独立的 Hierarchy（层级树）、Viewport（视口）、Inspector（属性检查器） 模块。

## 二、架构设计图景

```text
+--------------------------------------------------------------+
|                         App 容器骨架                         |
|                                                              |
|  +-------------+  +----------------------+  +-------------+  |
|  | Hierarchy   |  | Viewport (Canvas区)  |  | Inspector   |  |
|  | (层级节点树)|  |                      |  | (属性检查器)|  |
|  |             |  |  +----------------+  |  |             |  |
|  | - 节点折叠  |  |  | GizmoCanvas    |  |  | - 基础属性  |  |
|  | - 节点重命名|  |  | (交互、高亮框) |  |  | - 视图属性  |  |
|  | - 添加组件  |  |  +----------------+  |  |             |  |
|  | - 右键菜单  |  |  +----------------+  |  |             |  |
|  |             |  |  | SceneCanvas    |  |  |             |  |
|  |             |  |  | (真实节点渲染) |  |  |             |  |
|  |             |  |  +----------------+  |  |             |  |
|  +-------------+  +----------------------+  +-------------+  |
|                                                              |
+-------------------------- | ---------------------------------+
                            | (数据与事件驱动)
+-------------------------- v ---------------------------------+
|                       Zustand Store                          |
|  - sceneStore (存取节点树、管理选中态、撤销/重做、版本号)    |
|  - privateNodeState (编辑器内部私有状态，如可视/透明度)      |
+--------------------------------------------------------------+
```

## 三、目录结构与文件说明

根目录 `mock/mck-app/Laya2IDE` 中的源码主要集中在 `src/`：

### 1. `src/` (根目录文件)
*   **`main.tsx`**: React 项目的入口文件，负责渲染根组件。
*   **`App.tsx`**: 整个 IDE 的骨架结构（经典左、中、右布局）。处理宿主环境传来的 scene 文件加载 ( `workspace-file://` 协议)，并且监听数据脏状态（dirty state）通知宿主。

### 2. `src/core/` (核心渲染与逻辑)
与 UI 无关的纯逻辑模块，主要处理图形绘制与命中测试：
*   **`Renderer.ts`**: 最核心的纯净渲染引擎类。包含 `SceneRenderer`。负责从顶层向下递归遍历 `SceneNode` 并利用 HTML5 Canvas 2D API 将 Laya 的 `Label`、`Image`、`Sprite` 等节点绘制在屏幕上。同时处理 transform（平移/缩放）等视图矩阵变化，以及处理编辑器级的特殊渲染状态（透明度私有覆盖）。
*   **`componentCreators/`**: 存放特定节点 / UI 组件的创建工厂（例如创建 Image UI 等），用来规范化生成带特定属性的 Scene 节点。
    *   `index.ts`, `imageUI.ts`, `types.ts` 等。

### 3. `src/components/` (UI 组件)
按照编辑器的功能大区划分：
*   **`Hierarchy/`**: 层级树面板 (左侧)。
    *   **`HierarchyPanel.tsx`**: 将从 Store 获取到的场景树扁平化后进行渲染，支持节点选中、右键菜单、折叠/展开、以及重命名等。 
    *   **`HierarchyPlaceholder.tsx`**: 开发早期的占位板。
*   **`Inspector/`**: 属性面板 (右侧)。
    *   **`InspectorPanel.tsx`**: 动态表单机制，当在视口中选中一个物体时，渲染其属性并支持修改。它会根据所选节点的类型渲染支持参考层可见性（针对 Scene/View）、位置宽高属性、以及名称（Name/Var）等。
    *   **`InspectorPlaceholder.tsx`**: 占位板。
*   **`Viewport/`**: 中心渲染视口 (中间区)。
    *   **`SceneCanvas.tsx`**: 承载 `Renderer.ts` 的 React 包装器。处理鼠标事件，双层 Canvas 结构在此使用（底层 Scene, 顶层交互 Gizmo）。

### 4. `src/store/` (状态管理)
*   **`sceneStore.ts`**: 采用 `zustand` 编写的全局数据仓库。此对象不仅保存业务核心数据（如 `sceneData` 当前树结构、`selectedHit` 选择目标），还集成了极为复杂的 Undo/Redo（撤销/重做）逻辑栈、私有 UI 控制状态（如在 IDE 中隐藏某节点但不改变 scene 源文件）等状态修改 API。

### 5. `src/types/` (类型定义)
*   **`scene.ts`**: TypeScript 类型定义文件。定义了 Laya 引擎内表示的节点结构 (`SceneNode`) 、`HitResult` 碰撞结果以及组件所具有的标准接口。

### 6. `src/utils/` (工具库)
*   **`sceneFormatter.ts`**: 用于对 scene 数据进行格式化与反序列化，特别是导出时将运行时的对象剥离、清洗，以转换为合规的 `.scene` 原本 JSON 结构保存回文件系统。
*   **`sceneUtils.ts`**: 提供一些操作、寻找以及运算等辅助函数的集合；其中包含 `imageCache` 图片资源的预加载逻辑，通过解析本地工作区路径来加载展示资源。

## 四、核心工作流图解

1. **加载流程**: `App.tsx` 中的 `fetch('workspace-file://...')` 拿取 JSON -> \ `setSceneData()` 更新 -> 异步触发 `preloadImages()` 解析图片 -> Renderer 开始绘制。
2. **选中流程**: 在 `SceneCanvas.tsx` 里捕获鼠标事件 (PointerDown) -> Renderer 发起 HitTest 递归测试找到选中节点 -> 调用 `setSelectedHit(...)` 修改 state -> `HierarchyPanel` 树与 `InspectorPanel` 属性栏发生同步刷新。
3. **撤销回退(Undo/Redo)**: `sceneStore.ts` 内置了一个基于补丁/快照缓存的历史操作栈。当 Inspector 修改属性或者 Viewport 鼠标拖拽物体改变 X/Y 后，动作将会作为 Session Action 入栈，用户按 Ctrl+Z 触发 `undoLast()`，仅刷新受波及的内容。

通过如上的模块划分，Laya2IDE 正稳步朝着轻量、稳定、分离的视图系统演进，任何业务（新的渲染节点、新属性面板表单）的扩展都可精准落入上述划分区域。
