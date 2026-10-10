# Spec - TitleLab·爆款标题实验室 v1.0

> 生成日期：2026-10-09
> 基于：PRD.md v1.0 + ARCHITECTURE.md v1.0 + UIUX.md v1.0（均在本 docs/ 目录）
> 状态：已确认（用户已授权全权模式，Phase 1 三文档由项目总监代确认并完成一致性裁决）
> 本 Spec 是唯一开发契约。与三文档冲突处，以本 Spec 第 13 节裁决为准。

---

## 1. 产品定义

- **一句话描述**：发布前的 1 秒判官——跑在浏览器里的小红书标题爆款概率预测器，即时出分、分维度告诉你为什么、教你改。
- **目标用户**：①素人/垂类个人创作者（粉丝 0-5000，睡前手机决策）②品牌社媒运营（背 KPI，需要可解释依据）③MCN 内容团队（批量质控，B 端）。
- **核心问题**：小红书笔记首发前 100 次曝光是推流测试期，标题决定点击，但现有工具全是"事后分析"（千瓜/新红）或"英文语境"（CoSchedule/Sharethrough），无人做"发布前即时预判"。

## 2. MVP 范围（锁定——不在此列表的功能一律不做）

| 优先级 | 功能 | 验收标准摘要 | RICE |
|--------|------|-------------|------|
| P0 | F1 标题爆款概率评分 | 输入 1-50 字标题，1 秒内出 0-100 分 + 等级（爆款潜质/良好/普通/待优化）+ 双子分 + 模型降级可用 | 15.0 |
| P0 | F2 分维度诊断 | ≥6 维度（情绪浓度/具体度·数字感/长度适配/热词命中/悬念好奇/平台语感），每维有得分+状态+指向具体词的中文解释；违禁词红色高亮+替换建议+免责声明 | 10.0 |
| P0 | F3 一键优化改写 | 3 秒内生成 3 个候选变体（策略标签+改动说明+预估分+复制/送去对比），按分降序，≤20 字为主 | 4.8 |
| P1 | F4 A/B 标题对比 | 原题 vs 变体双栏六维对比，胜出方标记+领先维度数；分差<2 显示"势均力敌" | 6.4 |
| P1 | F5 历史记录 | localStorage 保存最近 50 条（标题/分数/时间戳），点击回填自动重测，行内删除 | 7.0 |
| P1 | F6 模型透明度面板 | 折叠面板：特征权重条形图+训练指标（Acc/AUC/F1/耗时）+样本量与"示例数据集"诚实声明 | 2.4 |

P1 三项全部纳入本次交付（构成完整可交互体验，成本可控）。

## 3. 明确不做（Out-of-Scope — 锁定）

| 不做的功能 | 原因 | 何时考虑 |
|------------|------|----------|
| 账号体系/云端同步 | 破坏零成本架构与"数据不出浏览器"承诺 | 永不（除非商业模式变更） |
| LLM API 改写 | 按次成本破坏零边际成本 | 商业验证后评估 |
| 真实数据抓取/API | 合规红线，抓取发生在产品之外 | 用户以自有数据离线重训 |
| 次数限制/付费墙（Demo 版） | Demo 全功能开放体验，定价区仅作商业展示 | 商业化版本 |
| 埋点 | v1 out-of-scope | 商业化版本 |
| 品类独立模型参数 | P2 Backlog，Demo 的赛道 chips 仅影响热词库与示例 | v1.1 |
| 权重 localStorage 持久化 | 每次重训 <2s 可接受，缓存引入版本一致性问题 | v1.1 |
| 封面图分析/多平台/小程序 | 见 PRD 第十节 | - |

## 4. 技术架构（锁定 — 含版本锚定）

| 层 | 技术 | 版本 | 锁定原因 |
|----|------|------|----------|
| 构建 | Vite | ^7（lockfile 锁定） | A+ 方案：类型门禁+hash 打包，产物纯静态 |
| 语言 | TypeScript | ^5.6 | 手写反向传播必须强类型（ADR-002） |
| 测试 | Vitest | ^3 | core 层 100% 可单测（含数值梯度检验） |
| 运行时依赖 | **无** | - | 总 JS gzip ≤40KB 预算的根基 |
| UI | 原生 DOM + 原生 CSS | - | 单页工具买不回框架收益 |
| 部署 | EdgeOne Pages（dist 静态部署）+ GitHub 仓库 | - | 零成本、全球可达 |

- `edgeone.json`：buildCommand "npm run build"、outputDirectory "./dist"、nodeVersion "22.11.0"、headers 按 ARCHITECTURE.md 第 8 节。
- build target es2020；现代浏览器（2021+）。
- npm registry 若安装失败/超时，切换 `https://registry.npmmirror.com`。
- 完整架构规格（特征工程/模型设计/训练编排/风险）以 `docs/ARCHITECTURE.md` 第 4-5 节为准，本 Spec 不重复。

## 5. 契约（替代 openapi.yaml — 纯前端零 API）

`src/types/` 是全项目唯一类型来源，必须先定义并锁定：

- `types/dataset.ts`：`LabeledTitle { text: string; label: 0|1; category: Category }`、`Category` 枚举（美妆护肤/穿搭/美食/旅行/健身/学习成长/职场/家居/母婴/数码/通用）
- `types/model.ts`：`FeatureVector`、`TrainReport { acc; auc; f1; precision; recall; durationMs; epochs; modelUsed: 'ensemble'|'lr'|'mlp' }`、`PredictResult { score: 0-100; grade; openScore; searchScore; dimensions: DimensionScore[]; attribution: FeatureAttribution[]; violations: Violation[] }`
- `types/ui.ts`：`Variant { text; strategy; changeNote; predictedScore }` 等
- 类型变更必须先改 types/ 再改实现。

## 6. 数据存储（锁定）

| 存储 | Key | 结构 | 上限 |
|------|-----|------|------|
| localStorage | `titlelab:history` | `{items: HistoryItem[]}`，HistoryItem `{text; score; grade; ts}` | 50 条，超出淘汰最旧 |

无任何网络请求（无 fetch/XHR/beacon）。无 cookie。

## 7. 页面清单（锁定 — 单页 10 区块，顺序即工作流）

| # | 区块 | 核心组件 | 数据来源 | Token 主题 |
|---|------|----------|----------|-----------|
| 1 | 顶部导航（sticky 56px） | logo+模型状态徽章+历史入口 | train-service 状态 | 默认 |
| 2 | 首屏输入区（60/40 非对称） | 楷体大输入框+字数计数(12/20 格式)+赛道 chips(9+通用)+主 CTA+示例按钮+隐私小字 | - | 主仪器卡 surface |
| 3 | 训练反馈条（条件渲染） | 阶段文案+6px 进度条+mono 百分比 | trainer 进度回调 | 默认 |
| 4 | 评分结果卡（全页唯一 shadow-lg） | 大数字滚动+等级徽章+双子分+同赛道分位+Strengths 三条 | predict-service | 分档色带 |
| 5 | 维度诊断条 | 六维 [名+mono 分+8px 条+诊断文案]+命中词圈注 | predict-service | 语义色 |
| 6 | 优化变体卡 | 一键优化 CTA+三变体卡（骨架屏 stagger 60ms） | rewrite-service | 默认 |
| 7 | A/B 对比区 | 双栏六维双向条形+胜负标记 | predict-service | 分档色 |
| 8 | 模型透明度面板（details 折叠） | 特征权重条+训练指标+示例数据集声明 | train/predict | 默认 |
| 9 | 定价区（bg-deep 交替底） | 免费/Pro 两卡 6:5 非对称 | 静态 | 默认 |
| 10 | 页脚 | 一行式声明+GitHub 链接 | 静态 | 默认 |

布局细节、滚动渐显节奏、5 态（Loading/Empty/Error/Populated/Edge）以 `docs/UIUX.md` 第 4/6/9 节为准。

## 8. 设计 Token（锁定）

- 以 `docs/UIUX.md` 第 3 节 CSS 变量块为唯一来源，落地为 `src/styles/tokens.css`（唯一颜色出口，组件只引用 `var(--…)`，禁止新增色值）。
- **字体裁决**（冲突 2 解决）：`--font-display: "LXGW WenKai Screen", "Kaiti SC", "KaiTi", "STKaiti", serif;` 本地楷体栈，**禁止引入任何 CJK webfont 下载**；正文用 UIUX.md 定义的无衬线系统栈。
- 图标：30 枚清单见 UIUX.md 第 5 节，规格统一 24×24 viewBox / stroke=currentColor / stroke-width 1.75 / fill=none / round caps；仅经 `createIcon(name, size)` 注册表使用，16/20/24 三档；**全站唯一图标系统，禁止内联散写 SVG path，禁止任何 emoji 作 UI 图标**（标题内容中的 emoji 属 UGC，正常显示并参与 emojiDensity 特征计算）。
- 动效：全站唯一缓动 `--ease-out`；>250ms 动画仅限评分数字滚动(500ms)与维度条填充(300ms)；`prefers-reduced-motion` 全部降级。
- 每屏深绿强调 ≤2 处。

## 9. 验收标准（锁定 — EARS 格式，QA 以此为唯一依据）

| 编号 | 功能 | 验收标准 | 优先级 |
|------|------|----------|--------|
| AC-01 | F1 | When 用户输入 1-50 字标题并点击检测，系统**必须**在 1 秒内显示 0-100 分+等级+双子分 | P0 |
| AC-02 | F1 | If 模型训练失败，系统**必须**降级为规则评分并明确标注"降级模式"，不得白屏 | P0 |
| AC-03 | F2 | When 评分完成，系统**必须**展示 ≥6 个维度，每维含得分/状态/指向具体词的中文解释，禁空洞表述 | P0 |
| AC-04 | F2 | If 标题命中违禁词，系统**必须**红色高亮+替换建议+固定免责声明"基础版检测，发布前建议专业工具复核" | P0 |
| AC-05 | F3 | When 用户点击一键优化，系统**必须**在 3 秒内生成 3 个变体，各附策略标签+改动说明+预估分，按分降序 | P0 |
| AC-06 | F3 | When 用户点击复制，系统**必须**给出图标交叉淡入+行内"已复制"反馈 | P0 |
| AC-07 | F5 | When 用户完成一次评分，系统**必须**写入历史；When 历史超 50 条，系统**必须**淘汰最旧 | P1 |
| AC-08 | F6 | When 用户展开透明度面板，系统**必须**展示特征权重、Acc/AUC/F1/耗时与"示例数据集"声明 | P1 |
| AC-09 | 训练 | When 页面加载，系统**必须**在首帧渲染后启动训练并展示进度，总耗时 <2s，UI 不冻结 | P0 |
| AC-10 | 训练 | When 训练完成，系统**必须**展示 test 集 Acc/AUC/F1，值非 NaN 且非 0/1 极端值 | P0 |
| AC-11 | 边界 | If 输入为空，CTA **必须**禁用；If 超 20 字，计数器变 warn 并提示"首屏双行仅显示约 20 字"；If 超 40 字仍可评但标注超长 | P0 |
| AC-12 | 边界 | If 输入纯 emoji/纯符号，系统**必须**正常出分并提示特征信息过少 | P1 |
| AC-13 | A/B | When 用户将变体送去对比，系统**必须**展示双栏六维对比+胜负标记；If 分差<2 显示"势均力敌，看封面定胜负" | P1 |
| AC-14 | 诚实性 | 系统页面**必须**在训练面板与页脚展示"基于人工构建示例数据集训练"声明；禁止任何"真实笔记数据/保证爆款"话术 | P0 |
| AC-15 | 隐私 | 系统**必须**零网络请求（DevTools Network 面板除字体/静态资源外无任何请求），标题只在本机处理 | P0 |

## 10. 边界与约束

- 性能预算（超标即回归不予发布）：总 JS gzip ≤40KB、CSS ≤10KB、LCP ≤1.5s/4G、训练 <2s、推理 <50ms、单源文件 ≤300 行、入口 main.ts <100 行。
- 代码组织：依赖只向下（ui → services → core/data），core 层零 DOM 依赖；数据集文件拆 5 个 chunk（`titles-1.json`…`titles-5.json`，各 100 条），`dataset.ts` 聚合+schema 校验 fail-fast。
- 可访问性：分档永远带文字标签；focus-visible 用 --focus-ring；触摸目标 ≥44px。
- 响应式：375px 起移动端优先，≥1024 完整布局，容器封顶 1080px。

## 11. 内嵌已知坑（新项目无历史坑，注入环境注意项）

| 坑 | 指纹 | 根因 | 修法 |
|----|------|------|------|
| npm 安装超时 | vite-7 / 国内网络 | registry.npmjs.org 慢 | 切换 npmmirror |
| TS strict 下 JSON import | vite+ts | resolveJsonModule 未开 | tsconfig 开启 resolveJsonModule（Vite 原生支持） |
| 训练阻塞主线程 | 大循环 | 同步全批训练 | chunked async（每 10 epoch await 让出） |

## 12. F3 优化改写引擎规格（本 Spec 补充，ARCHITECTURE.md 未覆盖部分）

- 位置：`src/services/rewrite-service.ts`（消费 core 的 predict）。
- 输入：原标题 + 诊断结果 + 赛道；输出：3 个 `Variant`。
- 策略库（≥5 种，输出取 3 个预估分最高且互不重复策略的）：
  1. 数字盘点型：`{N}个{主题}技巧，第{n}个绝了` / `月薪{X}也能抄的{N}套{主题}`
  2. 悬念反差型：`{主题}这样做的人，后来都{结果}` / `千万别{动作}！{代价}才知道`
  3. 身份代入型：`{人群}必看：{主题}{价值}`（人群词库：打工人/学生党/新手/宝妈…）
  4. 情绪共鸣型：`{情绪词}！{主题}终于{结果}`（情绪词库与 lexicon 共用）
  5. 避雷警示型：`{主题}避雷！这{N}个坑我替你踩过了`
- 主题提取：保留原标题实词（去停用词后的核心名词短语，简单规则即可），词库填充赛道相关。
- 每个变体生成后**必须**过模型重新打分并展示预估分；>20 字的变体不展示或标注"超长"。
- 改动说明模板：`+具体数字`/`+情绪钩子`/`换悬念句式`等，指向具体改动点。

## 13. 一致性裁决记录（Phase 1 门禁，冲突以本节为准）

1. 定价：取 PRD ¥29/月；Pro 卖点为"进阶模型版本+批量 50 条+报表+季度模型更新订阅"，**删除设计师版"云端模型"表述**（违反零后端）。
2. 字体：本地楷体栈，禁 CJK webfont（见第 8 节）。
3. 图标：UIUX.md 30 枚清单为准，stroke 1.75。
4. 数据集：5 chunk 文件规避 300 行限制。
5. 双子分定义：openScore（打开吸引力）= 情绪/悬念/emoji/钩子特征组加权；searchScore（搜索友好度）= 热词命中/具体度/长度适配特征组加权。两者为可解释规则加权子分（0-100），非独立模型。
6. 违禁词：lexicon.ts 含基础违禁词表（广告法绝对化用语约 30 条：最/第一/绝对/治愈率等），命中高亮+替换建议+免责声明。
7. 赛道 chips：仅影响热词命中维度所用词库与示例标题，不做分品类模型。
8. Demo 全功能开放、不设次数限制、无付费墙。

## 14. 端到端验证步骤（Spec 锁定的最后一项）

```bash
cd /d/projects/my/titlelab
npm install            # 失败则切 npmmirror
npm run typecheck      # 0 error
npm test               # 全绿（含数值梯度检验、数据泄漏断言、schema 校验）
npm run build          # dist 产物生成
npm run preview        # 本地预览
# 核心流：加载→首帧→训练进度→<2s 完成→Acc/AUC 非 NaN→输入"秋天第一杯奶茶，我劝你先看完这篇"→0-100 分+归因
# 边界流：空输入禁用/200 字超长出分/纯 emoji 出分/训练未完成禁用态
# 门禁：wc -l 无文件 >300（docs 除外）；grep 无散落硬编码色值（tokens.css 外禁 hex）
```

## 15. 变更记录

| 日期 | 变更内容 | 原因 | 影响范围 |
|------|----------|------|----------|
| 2026-10-09 | 初版定稿 | Phase 1 三文档一致性裁决 | 全项目 |
| 2026-10-09 | 构建方案由「Vite+TS+Vitest」落地为「零构建 ES 模块（无运行时依赖）」 | 前端子代理因模型限流中断后由总监直接实现，为最大化交付可靠性与可访问性（免 npm/build/网络风险），保留分层架构（core/data/services/ui）与 Node 端测试门禁；核心规格（特征工程/模型设计/设计 Token/P0 规则）不变 | 构建层、测试脚本 |
