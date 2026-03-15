## Plan: VS Code-Style Mini App & Plugin Client

一个基于 Electron + React + TS 构建的桌面客户端，整体采用类 VS Code UI 风格（菜单栏、侧边栏、状态栏、主编辑区）。其核心特色是包含两套完全独立但可联动的扩展体系：**小程序（Mini Apps）** 和 **插件（Plugins）**。

### TL;DR
目前基础框架已经搭建完毕（包含基础 UI 结构、`miniapp://` 协议的安全加载、独立的 `MiniAppService` 与 `PluginService`，以及基于主进程 `did-frame-finish-load` 监听的脚本注入方案）。
接下来的核心是如何让其真正拥有 **"生产力工具"** 的质感，建议重点向 **“状态保活”、“宿主双向通信”** 和 **“命令面板互联”** 三个方向深入。

**Steps**

*\* (✅ 已完成) Phase 1-4: 项目初始化、小程序管理、插件注入、以及基于 Zustand 的多标签页 (Tabs) 状态保活逻辑。*

1. **Phase 5: 双向宿主 API 通信机制 (Host API Bridge) ✅**
   - 彻底摒弃 DOM `postMessage` 这种不安全且低效的方式。
   - 使用 Electron 强大的 `nodeIntegrationInSubFrames: true`，使得子应用 `iframe` (哪怕在跨域或自定义协议下) 也能隐式执行主进程分配的 `preload.ts`。
   - 在 preload 脚本中利用 `window.location.protocol === 'miniapp:'` 进行环境嗅探，并通过 `contextBridge` 注入受限的特权方法。
   - 提供了诸如调起系统通知、原生文件选择器等高级 API，测试证实可用 `window.hostApi.showNotification` 等方法。

2. **Phase 6: 全局命令面板与快捷键 (Command Palette) ✅**
   - 监听全局 `Ctrl+Shift+P` (或 `Cmd+Shift+P`) 快捷键。
   - 呼出中间悬浮的命令搜索框。
   - 将所有本地已安装的小程序名称注册为启动命令。

3. **Phase 7: 原生资源管理器 (File Explorer) ✅**
   - **文件夹授权**: 在菜单栏 `File -> Open Folder` 或侧边栏快捷入口通过原生对话框选择一个物理文件夹。
   - **虚拟树渲染**: 递归读取文件夹结构（支持过滤 `node_modules` 等），在左侧 Side Bar 展示可折叠的目录树。
   - **基础交互**: 支持点击折叠/展开。
   - **目的**: 为后期“基于文件夹的小程序/插件开发测试”提供基础环境。

4. **Phase 8: Custom Editor 体系与小程序多开 (Multi-Instance Mini Apps) ✅**
   - **8.1 小程序多实例支持 (Multi-Instance) ✅**: 重构 Tab 系统（依靠唯一 `tabId`），同一个小程序可被实例化多次隔离运行。
   - **8.2 文件后缀拦截器体系 (File Extension Interceptor) ✅**: 允许将特定文件后缀（如 `.scene`）映射到对应的小程序（如 `laya-scene-viewer`）。未能匹配的默认降级为自带的原生 Monaco Editor (只读预览)。
   - **8.3 沙箱工作区资源访问 (Workspace Access) ✅**: 扩展 `hostApi` 甚至新增 `workspace-file://` 本地协议，允许受限沙箱读取或写入当前打开的物理工作区内的相关静态资源。

5. **Phase 8.4: 应用层实战 - Laya 2.x Scene Viewer (Mock App) ✅**
   - 目标: 基于 Custom Editor 与 workspace 读取能力，实现针对 Laya 2.13 `.scene` 文件的渲染小程序。
   - 实现: 摒弃了初版的 DOM 渲染，改为使用 `<canvas>` 直接解析 JSON 对象层级并调用 `CanvasRenderingContext2D` 执行重绘，符合游戏引擎逻辑层表现。
   - 需求 1: 支持递归读取 `.scene` JSON，根据 `child` 等级生成树形组件结构。(已完成)
   - 需求 2: 针对 `"type": "Label"` 节点的渲染，实现 `text`, `align`, `valign`, `color`, `fontSize` 指令到 Canvas 绘制的转换映射。(已完成)

6. **Phase 8.5: Scene Viewer 进阶 (图片沙箱透传渲染) ✅**
   - 目标: 让 Canvas 能够识别并渲染 `Image` 与 `Sprite` 组件中的 `skin` 或 `texture` 指向的工程外部图片。
   - 寻址策略 (Laya 机制): 针对 `.scene` 所在路径，向上遍历递归寻找名为 `Laya` 的父级文件夹，然后匹配到其子目录 `assets`，以此作为根目录解析 `skin` 等相对路径资源。
   - 实现方案: 利用 `workspace-file://` 配合上述相对路径策略获取绝对图片 URL，通过异步机制预加载 `new Image()`，最后转交给 Canvas 的 `ctx.drawImage` 进行绘制。由于通过宿主特权协议，完美跨越了 iframe 中的 CORS 阻碍。

7. **Phase 8.6: 探索支持可视化编辑与保存 (Visual Write Capability) 🏃(Next)**
   - **目标**: 将目前的“查看器 (Viewer)”向“编辑器 (Editor)”升级，以验证小程序修改沙盒外文件的能力。
   - **内容**: 支持在画布上简单的鼠标拖拽 (Drag & Drop) 对象来修改 x/y 坐标；通过 `window.hostApi.writeFile` (即将实现) 将改动反写回本地 `.scene` JSON，真正实现对私有游戏格式文件的可视化双向修改闭环。

8. **Phase 8.7: React 小程序入口支持与运行时构建 ✅**
   - **目标**: 让小程序不再局限于纯 `index.html`，支持以 React 组件为入口进行开发，降低大型页面维护成本。
   - **实现**: 在主进程 `MiniAppService` 中新增 React 构建流程。若 `app.json` 声明 `framework: "react"`，会自动使用 `esbuild` 将 `entry`（如 `src/main.tsx`）打包到小程序目录下的 `.toolsbox/react-runtime/`，再由 `miniapp://` 协议加载生成的 `index.html`。
   - **收益**: 保留现有协议安全模型与 iframe 隔离机制的同时，支持 React 生态（状态管理、组件拆分、Hooks）快速开发。

9. **Phase 8.8: React 小程序开发体验 (DX) 优化** *(Next)*
   - 提供 `mock-react-app` 示例模板（已新增）。
   - 在导入阶段增加 React 入口校验（缺失入口、编译错误可视化反馈）。
   - 规划增量重编译策略（按文件变更触发），减少每次刷新的全量打包成本。

10. **Phase 9: 动态 UI 侧边栏/状态栏注入** *(Pending)*

~~**未来考虑：应用市场与云端分发 (App/Plugin Store)**~~ *(延迟至后期迭代)*
   - 客户端内部实现一个类似 VS Code Extension 商店的面板。
   - 允许用户在一个统一的 UI 界面中进行在线预览、下载并自动解压部署。

~~**未来考虑：编辑器读写能力 (Write Capability)**~~
   - 对原生 Editor 组件及 `hostApi` 追加 `writeFile` 能力并引入保存快捷键 (Ctrl+S)。

~~**未来考虑：小程序与资源管理器的互联 (Selection Sync)**~~
   - 资源管理器不仅用于展示。点击文件时，如果当前活跃的小程序订阅了文件选择事件，则将文件信息发送给它进行联动。

~~**未来考虑：全局搜索面板 (Global Search)**~~
   - 基于原生能力（如 `ripgrep`）实现针对已打开文件夹的全局内容搜索面板。

~~**未来考虑：UI 稳定性与高级交互 (Resizer)**~~
   - 实现可拖拽的 `Resizer` 条，允许用户调节侧边栏宽度，适应层级较深的文件树。
   
**Relevant files**
- `electron/services/miniAppService.ts` — 小程序清单解析、React 小程序构建、安装列表生成。
- `src/vite-env.d.ts` — MiniAppManifest 增加 `framework/react` 字段声明。
- `mock/mck-app/mock-react-app/*` — React 小程序导入测试样例。

**Verification**
1. **多标签测试**: 打开小程序 A，在里边做一些交互，然后打开小程序 B 并切换回来，确认小程序 A 的输入没有因为重新渲染而丢失。
2. **API 模块测试 (无 postMessage)**: 导入 `mock-api-app`。点击它内部的按钮，测试是否能通过 `window.hostApi` （而非繁琐的 postMessage）成功唤起原生的系统通知以及 Windows 文件选择器，并且确认结果能够原路 Promise 返回。
3. **快捷键测试**: 使用 `Ctrl+Shift+P` 能够调出居中的搜索框，支持模糊搜索本地小程序并打开。
4. **资源管理器测试**: 点击 `File -> Open Folder`，选择一个包含子目录的项目。确认侧边栏出现文件树，且点击文件夹图标能正常切换展开/收起状态。
5. **React 小程序测试**: 导入 `mock-react-app`，确认可正常打开并渲染 React 组件，输入框与计数按钮状态可实时更新，点击通知按钮可触发 `window.hostApi.showNotification`。

**Decisions**
- **保活决策**: iframe 的 `display: none` 保活是低成本且兼容性好的方案。
- **通信决策**: 放弃基于前端 `postMessage` 的低效转发，我们在 `webPreferences` 中开启 `nodeIntegrationInSubFrames: true`，使其隐式执行宿主的 `preload` 脚本。通过判断 `window.location.protocol === 'miniapp:'` 安全地为沙箱注入专属的原生级桥接 `window.hostApi`。

**Further Considerations**
1. **开发者体验 (DX)**：在当前基础上，您是否需要为 iframe 内部的小程序单独开辟一个 "Toggle DevTools" 的机制？
2. **构建策略**：React 小程序当前是安装列表阶段构建，下一步是否切换为“导入时预构建 + 运行时按需重建”的混合模式？
3. **状态管理**：如果要实现类似 VS Code 右侧编辑器的分屏（Split View），或者全局快捷键，用 React useState 会比较难以维护，是否同意在进入下一步前先引入 `Zustand` 处理基础状态？
