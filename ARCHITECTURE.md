# ToolsBox 项目架构分析

ToolsBox 是一个基于 Electron 和 React 构建的桌面应用程序，主要提供类似 VS Code 的工作区界面，用于容纳和沙盒化管理本地的“小程序 (Mini Apps)”和“插件 (Plugins)”。

## 1. 技术栈 (Tech Stack)

* **核心框架**: Electron (主进程) + React (渲染进程)
* **构建工具**: Vite + electron-builder
* **开发语言**: TypeScript
* **前端状态管理**: Zustand (`src/stores`)
* **前端样式**: Tailwind CSS (`tailwind.config.js`, `postcss.config.js`, `src/index.css`)
* **UI 图标库**: `lucide-react`

## 2. 目录结构与模块说明 (Directory Structure)

整个项目采用典型的主进程 (Main Process) 和渲染进程 (Renderer Process) 分离的架构。

*(注：测试和模拟数据的 `mock/` 和 `test/` 文件夹已略去)*

### `electron/` (主进程 Main Process)
负责调用系统底层 API 并管理应用程序系统级别的交互。
* `main.ts`: Electron 主进程应用入口，负责创建浏览器窗口（BrowserWindow），处理 IPC 事件监听和应用生命周期。
* `preload.ts`: 预加载脚本，作为主进程和渲染进程之间的桥梁，将受限的系统 API 安全地暴露给前端界面（注入到 `window.ipcRenderer` 供前端调用）。
* `services/`: 主进程中的后端服务模块，处理具体的底层业务逻辑：
  * `explorerService.ts`: 文件资源管理、工作区本地文件的读写相关逻辑的封装。
  * `miniAppService.ts`: 小程序 (Mini Apps) 的安装、导入、卸载、加载等管控逻辑。
  * `pluginService.ts`: 插件的生命周期和安装管理逻辑。

### `src/` (渲染进程 Renderer Process - UI 端)
负责展现用户界面，完全采用 React 编写。
* `main.tsx` & `App.tsx`: React 应用的入口。`App.tsx` 构筑了整个类似 VS Code 的主布局（Top Bar、Activity Bar、侧边栏视图、标签页引擎、Iframe 沙箱等）。
* `components/`: 被抽离的独立 UI 组件，例如：
  * `CommandPalette.tsx`: 快捷命令面板（类似 VS Code 的 Ctrl+Shift+P 交互）。
  * `FileExplorer.tsx`: 侧边栏的工作区本地文件树状视图组件。
  * `NativeEditor.tsx`: 提供的原生代码编辑器支持（通常结合 Monaco Editor 或相似的高亮视图编辑文件）。
* `stores/`: 使用 Zustand 进行前端的全局状态维护。
  * `appStore.ts`: 包含 UI 的激活状态（活动的 Sidebar/Tabs 等）、当前工作区路径信息 (Workspace)、已安装的小程序和插件列表、Tab编辑是否 "dirty/修改未保存" 等关键数据流。
* `lib/`: 通用工具函数集合。

### 根目录配置文件
* `vite.config.ts`: Vite 的配置文件，用于极速打包构建开发时的前端 Web 资源。
* `electron-builder.json5`: electron-builder 的打包配置，用于指定不同平台 (Windows/Mac/Linux) 将应用如何封装打包成为桌面可执行文件。
* `package.json`, `tsconfig.json`: 项目依赖、脚本命令以及 TypeScript 全局配置。

## 3. 核心运行机制 (Core Mechanics)

1. **工作区布局与 UI**: `App.tsx` 实现了一个极度还原 VS Code 观感的工作区。包含最左侧的活动切换栏 (Apps/Plugins/文件资源器)、中间的详细列表渲染区以及最右侧占比最大的 Tab 和内容视图面板。
2. **小程序的沙盒化运行机制**: 安装进入 ToolsBox 的小程序，在使用主视窗打开时，将被渲染进入独立的 `<iframe/>` 组件内部。在应用内部，采用了自定义协议或特定的路由（如 `miniapp://`）作为 src 来源，允许小程序的独立运行同时能够通过 `postMessage` 向宿主(App.tsx 监听器) 回传诸如 `set-dirty` 或 `save-file` 等状态流。
3. **IPC 通信 (渲染层与底层服务)**: 所有跨越浏览器沙盒访问系统资源的操作，皆通过 `preload.ts` 中定义的 `window.ipcRenderer` (`miniApp.*`, `plugins.*`, `invoke('explorer:*')`) 接口与 `electron/services` 传递。
4. **状态驱动渲染**: 数据（例如工作区文件树、当前打开的 Tabs、插件列表等）由 Zustand Store 单向管理并触发 React UI 层精准更新。所有侧边栏组件和 Tab View 的隐显 (CSS 的 `display: none` 控制等) 都是状态驱动机制下完成的。