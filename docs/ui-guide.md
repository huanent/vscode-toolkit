# Toolkit UI 指南

> 调研日期：2026-09-09。用途：后续 UI 改版、共享组件建设和评审验收的参考基线。
> 本文是项目指南，不是 Microsoft 官方设计系统，也不表示现有页面已符合全部要求。

## 1. 版本与依据

本次查阅的官方稳定版发布页为 **VS Code 1.136**，发布日期为 **2026-09-02**，该页已列出 **1.136.2** 补丁下载。官方更新入口当前展示 **1.137 Insiders**，页面最后更新时间为 2026-09-04。两者必须分开使用，不能把更新入口等同于最新稳定版。[S1][S2]

本项目目前声明最低 VS Code 版本为 `^1.125.0`，见 [package.json](../package.json)。新版视觉参考不代表提升最低运行版本；新增 token、API 或设置依赖须另行核实兼容性。

本文使用三类依据：

| 标记 | 含义 | 使用方式 |
| --- | --- | --- |
| 官方规范 | 扩展 UX、主题和 Webview 文档明确说明的行为 | 作为设计约束；来源不包含统一像素规范时，不自行归因 |
| 版本观察 | 发布说明中的功能与界面变化 | 参考其用途和组织方式，保留 Experimental / Preview 标记 |
| 项目约定 | 为 Toolkit 提出的尺寸、组件和验收策略 | 后续改版采用的建议基线，可经评审调整 |

资料以在线文档为准；未对 VS Code 本体进行逐像素测量，也未实际操作所有实验界面。发布说明中的演示不是所有主题、平台、窗口布局下的固定外观。页脚编辑日期不能证明每段内容均已更新。

## 2. 最新界面方向

### 2.1 稳定的基础语言

官方 UX 架构以容器和内容项组织工作台：Activity Bar、主/辅助侧栏、Editor、Panel、Status Bar 承载不同职责；工具栏动作跟随当前视图和对象。[S3]

**项目归纳：内容优先、紧凑但可读、上下文操作、语义主题色、完整键盘路径。** 不将 Toolkit 做成嵌在编辑器里的独立后台网站。

- 结构依赖对齐、间距、轻量分隔和少量标题，不依赖大面积彩色背景。
- 主操作有明确层级；刷新、复制、关闭等通用操作使用熟悉的图标。
- 列表、树和数据区承担主要信息密度；卡片仅用于确有独立边界的重复对象或工具。
- 暗色不是品牌色，浅色和高对比主题不是后补皮肤。
- 选择、焦点、悬停、禁用和错误分别表达，不共用一个“高亮状态”。

### 2.2 1.136 与 1.137 的启示

| 版本观察 | 官方状态 | 对 Toolkit 的启示 | 不应推导出的结论 |
| --- | --- | --- | --- |
| 1.136 在 `workbench.experimental.modernUI` 启用时提供 `window.density.layout`，含 Default / Compact；Compact 减少面板间及内部间距 | Experimental | 设计可压缩的间距与稳固的内容结构；密度可以成为共享组件变体 | Modern UI 已是全部用户的默认界面；Webview 自动继承该密度 |
| 1.136 新会话输入将提示、模型、工作区等相关控制集中组织 | 发布说明功能 | 同一任务的上下文选择与执行入口靠近，减少跨区域操作 | 所有表单都要改成聊天输入框 |
| 1.136 会话树显示子聊天、状态与待批准事项；面包屑显示可理解标签 | 发布说明功能 | 对象层级可扫描，状态就地可见，名称不暴露内部 ID | 为简单对象强行增加多层树 |
| 1.136 Agents 窗口可配置聊天背景，高对比主题禁用背景 | Experimental | 可选个性化不能损害内容对比度 | 通用管理页面应加入背景图片和装饰纹理 |
| 1.137 调整 diff 自适应布局、上下文链接和会话控制顺序 | Insiders，仍会变化 | 窄宽切换应稳定；依赖关系决定控制顺序 | 把预览版具体布局或设置作为稳定接口 |

上述观察见 [S1][S2]。本项目不修改用户的 Modern UI 或密度设置，也不依赖工作台内部 CSS。

### 2.3 官方视觉参考

以下为官方图片链接，供设计评审对照；不作为 Toolkit 的成品稿或精确尺寸来源。

- [工作台容器结构图](https://code.visualstudio.com/assets/api/ux-guidelines/examples/architecture-containers.png)：观察工作区分工。
- [原生视图工具栏](https://code.visualstudio.com/assets/api/ux-guidelines/examples/view-toolbar.png)：观察上下文动作层级。
- [1.136 新会话输入](https://code.visualstudio.com/assets/updates/1_136/agents-new-session-input.webp)：观察相关控制的集中组织。
- [1.136 会话面包屑](https://code.visualstudio.com/assets/updates/1_136/session-breadcrumbs.webp)：观察可读的对象路径。

## 3. 信息架构与页面骨架

### 3.1 原生优先

官方建议只在原生 API 不足时采用 Webview，并要求主题适配、无障碍与上下文相关的激活。[S4][S6]

| 需求 | 优先承载方式 | Toolkit 使用原则 |
| --- | --- | --- |
| 执行命令、选择连接、少量输入 | Command Palette、Quick Pick、Input Box | 不为简单选择新增整个 Webview 向导 |
| 对象导航和层级数据 | 原生 Tree View | 节点表达对象，不把树当纯命令按钮列表；官方建议单项动作不超过三个 [S5] |
| 文件/对象编辑、复杂表单、数据表、预览 | Editor 中的 Custom Editor / Webview Panel | 复用工作台标题和标签，不在页面内再造 Activity Bar |
| 执行输出和辅助结果 | Panel、Output、Terminal 或适用的结果 Webview | 结果与触发对象有清晰关联，不因刷新抢焦点 |
| 扩展通用偏好 | 原生 Settings | 不重复实现 VS Code 设置页 |

不要在每个窗口、每次更新时自动打开管理页面，不添加推广内容。[S4]

### 3.2 三种项目页面模板

**管理列表：** 小型标题/对象上下文 + 搜索/筛选与新增入口 + 列表/表格 + 必要的结果计数。行内操作就近，低频操作收进更多菜单。不要用每行大型卡片替代可比较的连接信息。

**对象编辑：** 对象名称与保存状态 + 紧凑动作栏 + 分组字段/内容区。字段多时用无外框分节；只有真正不同的内容视图使用 Tabs。保存失败保留输入，切换对象时保护未保存更改。

**数据工具：** 对象导航 + 可伸缩主区域 + 查询/执行工具栏 + 结果/日志。表格和终端可在自身区域滚动，页面外壳不产生无意义的双重滚动。

针对 SSH、Database、Container 统一上述视觉模式，但不合并各自的业务模型、协议或表单逻辑。Workflow、Explorer 和 Chat 按任务选择模板，不要求布局完全相同。

## 4. 视觉基础

### 4.1 字体

**官方/现有机制：** Webview 通过宿主注入的 CSS 变量适配字体与主题；代码字体使用 `--vscode-editor-font-family`、`--vscode-editor-font-size`、`--vscode-editor-font-weight`。[S6]

**项目约定：** 常规 UI 继承 `--vscode-font-family`、`--vscode-font-size`；不引入品牌字体，不用编辑器等宽字体渲染所有控件。代码、SQL 和日志采用编辑器字体，结构化数值可使用等宽数字。标题以字重和分组体现层级，不使用营销页级超大字号，不使用负字距或随视口宽度缩放的文字。

### 4.2 尺寸与密度

以下是项目建议，不是 VS Code 官方像素表。像素数表示正常缩放下的设计目标；实际实现应尊重字体、缩放和中文文本。

| 项目 | 基线建议 | 落地约束 |
| --- | --- | --- |
| 基础间距 | 4 / 8 / 12 / 16 / 24 px | 用 Tailwind 预设间距，不逐页发明数值 |
| 控件高度 | 常规约 32 px，紧凑约 28 px | 现有 `h-8` 是延续点；紧凑变体须另行实现和验收 |
| 图标与命中区 | 图形约 16 px，命中区 28–32 px | 图形不等于点击区域，图标不因文字或加载变化位移 |
| 列表行 | 单行约 28–32 px，多行自动增高 | 不为追求密度裁掉文字；数据表可另定紧凑行高 |
| 内容内边距 | 紧凑区 8–12 px，表单区 16–24 px | 相邻区域共享对齐线 |
| 小控件圆角 | 首选 `rounded-xs` / `rounded-sm` | 当前 `rounded-md` 为待统一项，不是错误或官方违规 |
| 弹窗/独立重复项圆角 | `rounded-sm` / `rounded-md`，通常不超过 8 px | 不用任意值圆角；页面分区不做悬浮卡片 |
| 分隔与阴影 | 1 px 主题分隔；弹出层才使用阴影 | 不用阴影制造每个页面区域的层次 |

现有根字号来自宿主，Tailwind 的 rem 尺寸可能不等于表中的 px。验收以实际计算样式、缩放后的可用性和同类控件一致性为准，不能把 `h-8` 永久理解为 32 px。

### 4.3 主题 token

官方 token 中的 `.` 在 Webview CSS 变量中转换为 `-`，并添加 `--vscode-` 前缀，例如 `input.background` 对应 `--vscode-input-background`。[S6][S7]

| 语义 | 优先 token |
| --- | --- |
| 编辑器页面底色/常规文字 | `editor.background` / `foreground` |
| 侧栏/底部面板 | `sideBar.background` / `panel.background`，仅用于相应容器语义 |
| 次要说明/禁用文字 | `descriptionForeground` / `disabledForeground` |
| 分隔/弹出边界 | `panel.border` / `widget.border`，按容器语义选用 |
| 键盘焦点/高对比边界 | `focusBorder` / `contrastBorder` / `contrastActiveBorder` |
| 输入框 | `input.background` / `input.foreground` / `input.border` / `input.placeholderForeground` |
| 下拉选择 | `dropdown.background` / `dropdown.foreground` / `dropdown.border` |
| 主按钮 | `button.background` / `button.foreground` / `button.hoverBackground` / `button.border` |
| 次按钮 | `button.secondaryBackground` / `button.secondaryForeground` / `button.secondaryHoverBackground` |
| 图标与工具栏 | `icon.foreground` / `toolbar.hoverBackground` / `toolbar.activeBackground` / `toolbar.hoverOutline` |
| 列表悬停 | `list.hoverBackground` / `list.hoverForeground` |
| 列表选中且列表有焦点 | `list.activeSelectionBackground` / `list.activeSelectionForeground` |
| 列表选中但列表失焦 | `list.inactiveSelectionBackground` / `list.inactiveSelectionForeground` |
| 列表项键盘焦点 | `list.focusBackground` / `list.focusForeground` / `list.focusOutline` |
| 验证错误 | `inputValidation.errorBackground` / `inputValidation.errorForeground` / `inputValidation.errorBorder` |
| 警告/一般错误文字 | `editorWarning.foreground` / `errorForeground` |
| 链接/计数/进度 | `textLink.foreground` / `badge.background` + `badge.foreground` / `progressBar.background` |
| 图表和终端 | `charts.*` / `terminal.*`，不可用通用按钮色替代全部数据颜色 |

背景与前景必须成对应用，选中行包含的次要文字和图标也需复查。新 token 对最低支持版本可能不存在，使用语义相近的已支持变量回退；可选边框可回退透明，但高对比模式必须有可见边界。不对 `undefined` token 或透明底色直接宣称对比度合格。

示例：`bg-(--vscode-input-background)`、`text-(--vscode-input-foreground)`、`border-(--vscode-input-border,transparent)`。优先复用共享组件，不在每个页面复制这些组合。

不要硬编码 VS Code 默认深灰/蓝色，不依据某个主题名称编写常规样式，不将终端 ANSI 色硬套到业务状态。成功状态无合适通用 token 时先用图标与文字表达；确需专属语义色再评审扩展颜色贡献，不随意挪用测试通过色。

## 5. 控件与交互

### 5.1 动作和图标

- 主按钮表达当前任务的主要提交，例如连接、保存、运行；一个动作区通常只强调一个主操作，这是项目约定。
- 刷新、复制、编辑、关闭等用 `IconButton`；保留 `aria-label`，提供鼠标悬停及键盘焦点可访问的名称提示。只有 `title` 不能视为完整的键盘提示方案。
- 复杂或后果不明显的动作使用图标加文字；删除确认中的按钮直接写明删除对象，不用含糊的“确定”。
- 工具栏常驻高频动作；低频动作放更多菜单。行操作在 hover 和 focus-within 时都可见，不造成列宽跳动。
- 原生贡献使用 `ThemeIcon` 或受支持位置的 `$(icon)`。[S8] Webview 优先复用已有 `Codicon` 和图标封装；现有 Lucide 图标按模块逐步统一，不额外引入图标库。
- 打包的 Codicon 字体不等于原生 `ThemeIcon`，不能假定 Webview 自动跟随用户的 Product Icon Theme。

### 5.2 输入与选择

- 每个字段有程序关联的 label；placeholder 不替代 label。必填、错误、禁用状态同时具有语义属性。
- 字段错误就地显示，使用 `aria-invalid` 和 `aria-describedby` 关联；提交失败不清空字段。
- 布尔值用 checkbox 或 switch；少量互斥模式用分段控件；较长选项集用 select/菜单；数值用明确单位的输入或步进器。
- 分段控件是模式选择时采用 radio 或 pressed button 语义；切换内容面板才采用 tabs 语义。
- 密码默认隐藏，显示切换有可访问名称与状态；真实凭据不进入截图、日志或持久化 UI 草稿。
- 表单保存状态需明确区分未保存、保存中、已保存、保存失败；不能发出请求后立即宣布成功。

### 5.3 列表、树和数据表

- 同时设计 hover、focus、selected、inactive-selected，焦点移动不必改变业务选择。
- 表格保留表头语义、排序状态、空值表达；数值和单位对齐。读数据表用原生 table，交互 grid 必须实现对应键盘模型。
- 长路径和 ID 允许局部截断，但提供查看完整值及复制方式；不能只靠鼠标 hover 获取关键数据。
- 搜索不匹配和真正无数据使用不同状态；清空筛选后保留合理的上下文。
- 大数据量使用分页或成熟虚拟化方案；键盘焦点所在项不能在无提示情况下消失。
- 拖动排序提供键盘替代操作，例如上移/下移；列宽调整也需有非拖动入口。

### 5.4 弹窗与反馈

- 简单确认优先宿主原生消息框；复杂局部编辑才用 Webview 弹窗。不要为常规浏览步骤频繁弹窗。
- 弹窗有可访问名称、初始焦点、Tab 焦点约束、Escape 关闭和关闭后焦点返回；仅 `role="dialog"` 与 `aria-modal` 不足以完成这些行为。
- 遮罩点击关闭须保护未保存输入；破坏性操作默认焦点不能误导为立即确认。
- 加载保留区域尺寸；刷新优先保留旧数据并表达更新状态，不闪回整页空白。
- 错误显示对象、原因和可用恢复动作；长日志可展开或转到 Output，不用无休止通知刷屏。
- 运行状态与取消能力必须真实对应后端；不把“请求取消”显示成“已终止”。

## 6. 响应式与无障碍

官方要求 Webview 支持主题、颜色对比、ARIA 和键盘导航；宿主提供 `vscode-using-screen-reader` 与 `vscode-reduce-motion` 类。[S4][S6][S9]

**项目验收要求：**

- 在浅色、深色、高对比深色、高对比浅色下检查。不能只切换 `prefers-color-scheme`；真实宿主主题是主要依据。
- 普通文字以对比度 4.5:1、必要非文本控件边界/状态以 3:1 为验收目标；这是项目采用的无障碍目标，不保证任意用户自定义主题天然达标。
- 高对比主题依赖边界和焦点轮廓，不只靠半透明填充或降低 opacity 表达状态。
- Tab/Shift+Tab 可进入和离开页面；真实 toolbar/tablist 采用单 Tab 入口和方向键导航。没有实现该键盘模型时，不仅为外观添加相应 ARIA role。[S9]
- 弹窗、菜单和组合输入遵循各自键盘模型；不要全局拦截输入框中的快捷键、复制粘贴或中文输入法组合事件。
- 状态更新用适度的 live region；流式日志和聊天不逐字符播报，不抢焦点。
- 减少动态效果同时响应宿主 `vscode-reduce-motion` 和 `prefers-reduced-motion`；移除非必要位移/旋转，保留文字进度。
- Webview 可被放入窄编辑器组和侧栏。320 / 480 / 768 / 1280 CSS px 是项目测试宽度，不是宿主最小宽度保证；实际承载更窄时另行补测。
- 窄布局先折叠导航和低频操作，再让字段单列；不缩小字体硬塞，不隐藏关键动作。数据表可以局部横向滚动。
- 至少测试窗口默认缩放和放大两级，以及系统/用户较大字体；长中文、英文、路径、错误信息不遮挡相邻内容。

## 7. 本仓库落地

### 7.1 保留的基础

| 已有基础 | 位置 | 后续策略 |
| --- | --- | --- |
| React 19、Tailwind 4、Lucide、Codicons | [package.json](../package.json) | 沿用，不因编写指南升级依赖 |
| 字体/主题变量、全局焦点和滚动条 | [共享样式](../webview/src/styles.css) | 全局规则留在入口，页面优先 utilities |
| 主/次/图标按钮 | [按钮组件](../webview/src/components/ui/button.tsx) | 在共享层统一尺寸、圆角和状态，避免逐页覆盖 |
| 文本、密码、选择、多行输入 | [输入组件](../webview/src/components/ui/input.tsx) | 复用控件；修正语义差异时同步验收调用页面 |
| 弹窗框架 | [弹窗组件](../webview/src/components/ui/dialog.tsx) | 完善行为后再作为改版标准组件推广 |
| 字段、标题、分段控件和图标 | [共享 UI 目录](../webview/src/components/ui) | 优先核查再扩展，不重复创建同用途组件 |
| 样式协作约定 | [AGENTS.md](../AGENTS.md) | Tailwind 预设圆角、`cn`、静态可发现类名、主题变量继续生效 |

### 7.2 已观察到的待核查项

这些是本次局部源码观察，不是全站 UI 审计，也没有在本次修复。

| 观察 | 后续检查/改版动作 |
| --- | --- |
| 按钮与输入当前使用 `rounded-md`、`text-xs`、`h-8` | 用组件样例验证中文/宿主字号，确定统一密度与圆角后再迁移 |
| `SelectInput` 复用 input 配色 | 确认使用 dropdown token 的语义和平台渲染效果 |
| 按钮禁用依赖 opacity，主按钮按下使用 brightness | 核查高对比效果，不用滤镜代替语义状态的完整设计 |
| `Dialog` 内未实现标题关联、焦点约束、Escape 和焦点返回 | 核查调用方后，在共享组件补齐并加入行为测试 |
| 弹窗遮罩使用 `bg-black/45` | 检查浅色/高对比可读性与关闭策略，集中管理遮罩语义 |
| 根样式 `min-width: 320px`、`color-scheme: light dark` | 检查更窄容器溢出，以及宿主浅色配系统深色时原生控件是否一致 |

### 7.3 实现边界

- 源码改动落在 Webview 源目录；不手改生成的 media bundle。
- 通用外观和交互放共享 UI；领域字段、状态转换和后端协议仍由各 feature 所有。
- 类名通过 `cn` 和静态字面量映射组合，避免构造 `bg-${color}` 等 Tailwind 无法发现的字符串。
- 全局 CSS 只保留主题基础、第三方样式和 utilities 不适合表达的规则。动态网格、图表或编辑器有充分理由时可以例外，不为追求零 CSS 牺牲清晰度。
- 不复制 VS Code 内部 workbench CSS，不把内部 DOM 或实验设置当稳定接口。
- UI 改版维持 Webview CSP、最小资源访问和消息校验；不要为外部字体、图标 CDN 或原型样式放宽安全策略。[S6]

## 8. 改版顺序

1. **P0：行为与可用性。** 补齐弹窗焦点、控件名称、键盘路径、错误恢复、高对比边界，保护未保存数据。
2. **P1：共享视觉基线。** 建立按钮、字段、选择、分段、弹窗的状态样例；确认密度、字体与圆角，再统一 token 和组件变体。
3. **P2：页面迁移。** 先选一个管理列表和一个复杂表单作试点，通过验收后迁移同类页面；SSH/Database/Container 共享视觉不共享业务所有权。
4. **P3：复杂内容。** 处理数据库大表、终端、Markdown、Workflow 与 Chat 的滚动、性能、焦点和主题联动。

每个阶段保留改版前后同尺寸、同主题、同数据截图。实验性 Modern UI 作为额外观察环境，不成为发布前提。

## 9. 评审与验收清单

- [ ] 设计说明指出哪些来自官方规范、哪些是项目决定；引用版本和日期明确。
- [ ] 视图承载合理，未重复原生导航/设置，无营销式头图和嵌套页面卡片。
- [ ] 复用共享组件与 `cn`，无新增任意值圆角和不可发现的 Tailwind 类名。
- [ ] 默认、悬停、按下、焦点、禁用、选中、失焦选中、加载和错误状态均有样例。
- [ ] 背景和前景使用正确 token；最低支持版本缺少变量时有合理回退。
- [ ] 四类主题检查通过，且宿主主题与系统色彩模式相反时控件仍一致。
- [ ] 320 / 480 / 768 / 1280 宽度及放大两级后无遮挡，长文本和结果区可访问。
- [ ] 键盘可完成主要流程；弹窗能退出并返回焦点；图标按钮有名称和可访问提示。
- [ ] 中文输入法、多行输入、复制粘贴与焦点移动无冲突。
- [ ] 无数据、无匹配、断连、超时、保存失败、取消和未保存切换均不误导用户。
- [ ] 截图数据脱敏；读屏与减少动态效果做过实际检查。
- [ ] 受影响 Webview 执行 `npm run build` 和 `npm run lint`；行为变更增加相应测试，完整回归依仓库流程在 build 后执行 `npm test`。
- [ ] 在 VS Code Extension Development Host 验证真实主题、焦点和消息通信；浏览器模拟不替代宿主验收。

建议每次 UI PR 附上：页面/组件范围、采用的规则、主题与尺寸矩阵、关键状态截图、键盘检查结果、构建/测试结果、已知例外。构建和 lint 通过不等于视觉与无障碍合格。

## 10. 资料索引与维护

所有下列页面均于 2026-09-09 查阅。

| 编号 | 官方资料 | 本文用途 |
| --- | --- | --- |
| S1 | [VS Code 1.136 Release Notes](https://code.visualstudio.com/updates/v1_136) | 稳定版与补丁信息、Modern UI 密度、会话布局 |
| S2 | [VS Code 1.137 Insiders](https://code.visualstudio.com/updates/v1_137) | 预览动向，不作为稳定规范 |
| S3 | [UX Guidelines Overview](https://code.visualstudio.com/api/ux-guidelines/overview) | 工作台容器与操作作用域 |
| S4 | [Webviews UX](https://code.visualstudio.com/api/ux-guidelines/webviews) | Webview 使用边界与可访问性要求 |
| S5 | [Views UX](https://code.visualstudio.com/api/ux-guidelines/views) | 树、视图操作和空视图 |
| S6 | [Webview API](https://code.visualstudio.com/api/extension-guides/webview) | 主题变量、字体、无障碍标记、安全和生命周期 |
| S7 | [Theme Color Reference](https://code.visualstudio.com/api/references/theme-color) | 语义颜色及状态含义 |
| S8 | [Product Icon Reference](https://code.visualstudio.com/api/references/icons-in-labels) | Codicons、ThemeIcon 与图标主题 |
| S9 | [Accessibility](https://code.visualstudio.com/docs/configure/accessibility/accessibility) | 缩放、主题、键盘与读屏 |

更新本指南时先核实稳定版页与补丁，再检查实验功能状态和最低支持版本。若资料冲突，优先采用与具体问题直接相关的当前 API/UX 说明；像素与外观差异通过目标版本宿主实测确认。每轮大型 UI 改版前重新核对，不把本次“最新版”永久固化。