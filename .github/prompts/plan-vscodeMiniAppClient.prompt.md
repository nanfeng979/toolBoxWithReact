## Plan: VS Code-Style Mini App & Plugin Client

一个基于 Electron + React + TS 构建的桌面客户端，整体采用类 VS Code UI 风格（菜单栏、侧边栏、状态栏、主编辑区）。其核心特色是包含两套完全独立但可联动的扩展体系：**小程序（Mini Apps）** 和 **插件（Plugins）**。

### TL;DR
目前基础框架已经搭建完毕（包含基础 UI 结构、`miniapp://` 协议的安全加载、独立的 `MiniAppService` 与 `PluginService`，以及基于主进程 `did-frame-finish-load` 监听的脚本注入方案）。
接下来的核心是如何让其真正拥有 **"生产力工具"** 的质感，建议重点向 **“状态保活”、“宿主双向通信”** 和 **“命令面板互联”** 三个方向深入。

**Steps**

*\* (✅ 已完成) Phase 1-4: 项目初始化、小程序管理、插件注入、以及基于 Zustand 的多标签页 (Tabs) 状态保活逻辑。*

1. **Phase 5: 双向宿主 API 通信机制 (Host API Bridge)**
   - 目前注入是“从上到下”单向的，要让各个小程序真正具备与系统交互的能力，需要建立“从下到上”调用特权能力的通道。
   - 既然已改为通过主进程注入脚本，可以考虑利用 `preload` 脚本在子应用环境中暴露受限的 API，或者在注入的 JS 脚本中定义与宿主通信的接口（例如通过 `window.chrome.webview.postMessage` 或在 Electron 允许同源的情况下利用 `ipcRenderer`）。
   - 暴露基础 **Host API**，例如：
     - `SHOW_NOTIFICATION`（触发主进程或宿主的 UI 通知）。
     - `OPEN_FILE_DIALOG`（调取主进程 `dialog`）。
     - `GET_THEME_COLOR`（向小程序同步宿主的黑暗/明亮模式配色）。

2. **Phase 6: 全局命令面板与快捷键 (Command Palette)**
   - 监听全局 `Ctrl+Shift+P` (或 `Cmd+Shift+P`) 快捷键。
   - 呼出中间悬浮的命令搜索框。
   - 将所有本地已安装的小程序名称注册为启动命令（例如输入 "App" 就能快速呼出来切换过去）。

3. **Phase 7: 应用市场与云端分发 (App/Plugin Store)** *(🆕 新增建议)*
   - 客户端内部实现一个类似 VS Code Extension 商店的面板。
   - 配置一个远端 JSON 文件作为 Registry，列出可用的最新小程序和插件。
   - 允许用户在一个统一的 UI 界面中进行在线预览、下载 (Download) 并自动解压部署（通过调用现有的 import 逻辑的增强版）。
   - 引入版本管理与自动更新检测机制。
   
**Relevant files**
- `src/App.tsx` — 升级改造，引入数组型多 Tabs 渲染与 DOM 保活逻辑。
- `src/stores/appStore.ts` *(需新建)* — 引入 Zustand 面向未来管理打开的 Tabs、侧边栏宽度、通知等全局客户端状态。

**Verification**
1. **多标签测试**: 打开小程序 A，在里边做一些交互，然后打开小程序 B 并切换回来，确认小程序 A 的输入没有因为重新渲染而丢失。
2. **API 测试**: 内部小程序注入脚本触发 Host 事件，宿主正确作出响应。
3. **快捷键测试**: 使用 `Ctrl+Shift+P` 能够调出居中的搜索框，支持模糊搜索本地小程序并打开。

**Decisions**
- **保活决策**: iframe 的 `display: none` 保活是低成本且兼容性好的方案。
- **通信决策**: 放弃基于前端 `postMessage` 的低效转发，改用主进程注入或 Preload 提供的原生 Bridge 通道。

**Further Considerations**
1. **开发者体验 (DX)**：在当前基础上，您是否需要为 iframe 内部的小程序单独开辟一个 "Toggle DevTools" 的机制？
2. **状态管理**：如果要实现类似 VS Code 右侧编辑器的分屏（Split View），或者全局快捷键，用 React useState 会比较难以维护，是否同意在进入下一步前先引入 `Zustand` 处理基础状态？
