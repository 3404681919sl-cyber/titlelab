# TitleLab 架构决策文档（Architecture Decision Document）

- 版本：1.0
- 作者：首席架构师 高见远
- 状态：已定稿（供 PM/设计/前端消费）
- 关联：PRD（PM 产出）、UI Spec（设计师产出）、ADR-001 ~ ADR-006（docs/decisions/）

---

## 0. 摘要（一句话结论）

**Vite + TypeScript + 零 UI 框架 + 零运行时依赖，自研字符 n-gram TF-IDF + 逻辑回归 + 双隐层 MLP（Adam），480~500 条人工构建示例数据集，构建产物纯静态部署 EdgeOne Pages。** 总 JS gzip 预算 ≤ 40KB，训练 < 2 秒，推理 < 50ms。

对项目总监三个初步假设的裁决：**方案 A 修正后采纳（补构建期与类型门禁）；方案 B 否决（TF.js 在此规模是负资产）；方案 C 直接否决（违反零后端硬约束）。**

---

## 1. 硬约束（先钉死，不可协商）

| # | 约束 | 来源 |
|---|------|------|
| C1 | 纯前端静态 Web 应用，零后端、零 API Key | 用户需求 |
| C2 | 模型在浏览器加载时用内置数据集训练，展示准确率/AUC 等训练指标 | 用户需求 |
| C3 | 推理即时评分（无网络请求） | 用户需求 |
| C4 | 部署 EdgeOne Pages 静态托管，代码托管 GitHub | 用户需求 |
| C5 | 训练时间预算 < 2 秒级 | 项目总监 |
| C6 | UI 图标：内联手写统一描边风格 SVG 图标集，16/20/24px 三档，禁止 emoji 图标 | P0 规则 |
| C7 | 颜色统一 Token（tokens.css 唯一来源），禁止散落硬编码色值，禁止紫→粉渐变 | P0 规则 |
| C8 | 数据集必须明示为示例数据集，禁止虚构"真实抓取数据" | 项目总监 |
| C9 | 单文件 ≤ 300 行（不含空行注释），入口只装配，依赖只向下 | 代码组织规范 |

---

## 2. 技术选型对比矩阵

| 维度 | 方案 A：Vanilla 无构建（总监原始假设） | **方案 A+：Vite + TS 无框架（推荐）** | 方案 B：Vite+React+TS+Tailwind+TF.js | 方案 C：Next.js + API 服务端推理 |
|------|------|------|------|------|
| 交付速度 | 4 —— 无构建配置，但无类型导致调试与返工慢 | **4.5** —— 一个构建配置 + 全量类型 | 4 —— 框架脚手架熟，但 TF.js API 学习与调试成本 | 3 —— 前后端两套 |
| 可靠性（防生成式代码失效） | 2 —— 无类型检查门禁；手写反向传播属最高风险代码，无静态防护 | **5** —— tsc 构建门禁 + Vitest 单测（含梯度检验） | 4.5 —— 有类型门禁，但 TF.js 黑盒内的数值行为更难单测 | 3 —— 引入服务端运行时故障面 |
| 浏览器内训练可行性 | 5 | **5** | 4 —— TF.js 完整包 gzip 约 500KB；500 样本稀疏 TF-IDF 输入下 WebGL 加速收益趋零，CPU 后端反而慢于手写稀疏循环；layers API 对稀疏输入支持弱 | 1 —— 违反 C1/C2 |
| 部署复杂度 | 5 —— 纯静态 | **5** —— 构建产物纯静态 | 4.5 —— 纯静态但首包大 | 2 —— 需服务端/边缘函数，违反 C1 |
| 可维护性 | 2.5 —— 无类型、手操 DOM、模块靠自觉 | **4.5** —— 分层 + 类型契约 + 单测 | 4.5 —— 组件化好 | 4 |
| 与用户技术栈匹配度（零后端/静态托管/即时访问） | 5 | **5** | 4.5 | 1 —— 直接违反 |

### 关键论证（拒绝空话）

**方案 C 否决理由**：服务端推理 = 有后端 = 违反 C1"零后端"；EdgeOne Pages 静态托管不承载 Next.js API Routes；且推理走网络违反 C3"即时"。不进入后续评估。

**方案 B 否决理由（核心是 TF.js，不是 React）**：
1. 包体积：`@tensorflow/tfjs` 完整包 gzip 约 500KB，是本项目全部 JS 预算（40KB）的 12 倍以上。即便按需拆包（core + cpu backend）也在 160KB 级。
2. 计算形态不匹配：本模型第一层输入是稀疏 TF-IDF（每样本约 40~60 个非零位）。TF.js 的 dense tensor 会把 2014 维全部物化，500 样本 × 2014 维的 tensor 分配和内核调度开销，在这个规模上大于手写稀疏循环（只碰非零位，约 50 次乘加/层）。
3. 调试黑盒：训练不收敛时，TF.js 内部数值不可见；自研 200 行矩阵运算每一步可断点、可单测、可做梯度检验——这正是"浏览器内实时训练并展示指标"这个产品卖点需要的透明度。
4. React 本身无罪，但本项目是单页单视图工具（输入框 + 评分卡 + 训练面板），组件状态简单，框架运行时（react+react-dom 约 45KB gzip）买不回收益。

**方案 A 的缺陷（为什么修正为 A+）**：无构建步骤 = 没有 `tsc` 类型门禁、没有单测运行器、没有压缩与 hash 打包。本规范（generated-code-failure-modes）明确要求"构建/类型检查作为必过门"——手写反向传播是全项目风险最高的代码，失去类型与测试门禁，"沉默逻辑错误"（编译通过、跑得动、结果错）风险不可接受。修正方式：**保留 A 的零运行时依赖与自研 ML 精神，补上 Vite + TypeScript + Vitest 的构建期门禁**。构建产物仍是纯静态文件，部署方式与 A 完全一致。

---

## 3. 选型结论 + ADR 索引

| 决策点 | 结论 | ADR |
|--------|------|-----|
| 技术栈 | Vite 7.x + TypeScript 5.x，**零运行时依赖**（package.json dependencies 为空），无 UI 框架，无 Tailwind（CSS 自定义属性 + 原生 CSS） | ADR-001 |
| ML 实现 | 自研：稀疏 TF-IDF + LR（全批 GD + L2）+ MLP（32-16，Adam），Float32Array 手写矩阵运算 | ADR-002 |
| 特征方案 | 字符 1+2-gram TF-IDF（词表上限 2000，df≥2）+ 14 项数值特征，z-score 标准化 | ADR-003 |
| 模型方案 | LR 与 MLP 概率加权融合，权重在验证集网格搜索，可退化到单模型 | ADR-004 |
| 数据集 | 480~500 条人工构建示例数据集，10 类目均衡，正负 4:6，含 ~15% 难例，UI/代码/README 三处明示 | ADR-005 |
| 部署 | edgeone.json 配置构建与缓存策略，hash 资源 immutable 1 年，index.html must-revalidate | ADR-006 |

版本锚定（spec-as-contract 要求）：`vite ^7`、`typescript ^5.6`、`vitest ^3`，以 package-lock.json 锁定为准；Node 本地与 EdgeOne 构建环境统一 **22.11.0**（EdgeOne 预装版本）。构建 target `es2020`。

ADR 全文见 `docs/decisions/ADR-001` ~ `ADR-006`（MADR 格式，随本文件交付）。

---

## 4. 特征工程设计

### 4.1 文本预处理（preprocess.ts）

1. Unicode NFKC 归一化（全角→半角、兼容字符统一）
2. 英文转小写
3. 首尾空白去除、连续空白压缩为单个空格
4. 不去除标点与 emoji（它们是特征信号）

### 4.2 字符 n-gram TF-IDF（ADR-003）

中文标题平均 15~25 字，分词器（jieba 等）会增加体积与歧义处理成本，而**字符 bigram 天然覆盖"绝了/亲测/真的/后悔"这类高频子串**，是中文短文本的成熟做法。

- 切分：字符 1-gram + 2-gram 并集（相邻两字滑窗）
- 词表构建（**仅在 train 集上构建**，防泄漏）：
  - 过滤 df < 2 的 n-gram
  - 按 df 降序取 top **2000** 上限
- 权重：`tf = 1 + log(count)`（sublinear），`idf = ln((1+N)/(1+df)) + 1`（平滑式，与 sklearn 一致）
- 向量：L2 归一化，稀疏存储 `[featureIndex, value][]`
- 推理时按同一词表映射，OOV（未收录 n-gram）直接丢弃

### 4.3 数值特征清单（numeric.ts，共 14 项）

| # | 特征 | 定义 | 直觉 |
|---|------|------|------|
| 1 | lengthNorm | min(字符数, 40) / 40 | 过长过短都减分 |
| 2 | inOptimalBand | 字符数 ∈ [8, 20] ? 1 : 0 | 小红书标题甜区 |
| 3 | digitRatio | 数字字符数 / 字符数 | 数字前置是爆款模式 |
| 4 | hasLeadingDigit | 首个非空白字符是否为数字 | "3个技巧…"式开头 |
| 5 | questionMarkCount | ？? 个数 | 互动钩子 |
| 6 | exclamationCount | ！! 个数 | 情绪强度 |
| 7 | suspenseHitCount | 悬念词表命中数（词表约 40 词：绝了/竟然/居然/偷偷/秘密/后悔/千万别/没想到/真相/其实/宝藏/隐藏/最后/千万…） | 悬念钩子 |
| 8 | emotionHitCount | 情绪词表命中数（约 40 词：爱了/哭死/笑死/破防/治愈/上头/心动/救命/绝绝子…） | 情绪传染 |
| 9 | emojiDensity | emoji 个数 / max(字符数,1) | 点缀适度加分 |
| 10 | separatorCount | 分隔符个数（｜ \| 、 ， , 空格） | 结构化排版 |
| 11 | hasBracketPair | 是否使用【】「」（） | 视觉分层 |
| 12 | hasColon | 是否使用 ：: | "总结：xxx"式 |
| 13 | uniqueCharRatio | 去重后字符数 / 总字符数 | 检测无意义堆砌 |
| 14 | endsWithHook | 结尾为 ？/！/…/省略号 ? 1 : 0 | 开口式结尾 |

- 词表为常量文件 `src/data/lexicon.ts`，与数据集同级，版本化维护。
- **标准化**：全部数值特征 z-score（均值/方差来自 train 集统计量，随模型 artifact 保存，推理复用）。
- **说明（P0 边界）**：数据集标题文本中出现的 emoji 是**内容特征**（emojiDensity 的计算对象），不是 UI 图标；P0 禁止的是 emoji 作为界面图标，两者不冲突。

### 4.4 维度控制策略

- 总维度 = 2000（n-gram 上限）+ 14（数值）≈ 2014 维
- 500 样本 vs 2014 维：样本/维度比低，依靠三层防线控制过拟合——稀疏表示（每样本实际非零仅 ~50 位）+ L2 正则 + 早停
- 词表上限 2000 为初始锁定值；开发期允许一次性网格实验（1500 / 2000 / 3000，看验证集 AUC），**实验完成后锁定写死，不做线上自适应**
- 第一层矩阵运算只遍历非零位（稀疏×稠密），MLP 第一层计算量从 2014×32 降为 ~50×32/样本

---

## 5. 模型设计

### 5.1 逻辑回归（logistic-regression.ts）

| 项 | 取值 | 理由 |
|----|------|------|
| 输入 | 2014 维稀疏向量 | 见 4.4 |
| 损失 | logistic loss + L2（λ = 1e-4） | λ 在验证集上从 {0, 1e-5, 1e-4, 1e-3} 选定 |
| 优化器 | 全批梯度下降，lr = 0.5 | 全批在此规模最稳、实现最简 |
| Epochs | 300 | 收敛曲线在训练面板实时绘制 |
| 耗时估算 | 300 epoch × 350 样本 × ~50 非零位 ≈ 5M 乘加 → **< 100ms** | Float32Array |

### 5.2 MLP（mlp.ts + adam.ts）

| 项 | 取值 | 理由 |
|----|------|------|
| 结构 | input 2014 → 32 (ReLU) → 16 (ReLU) → 1 (sigmoid) | 参数量 ~65K（Float32 约 260KB 内存，无压力）；更大隐藏层在 500 样本上只会过拟合 |
| 初始化 | He 初始化（ReLU 配套） | 标准做法 |
| 优化器 | mini-batch Adam，batch = 32，lr = 1e-3，β1=0.9，β2=0.999 | Adam 在小批量下收敛快且稳，手写实现约 50 行 |
| 正则化 | L2 weight decay 1e-4 | 主过拟合防线 |
| Epochs | 150 上限 + **早停**：验证集 loss 连续 15 epoch 不降即停 | 双保险 |
| 耗时估算 | (350 样本 / 32) × 150 ≈ 1650 步 × 32 样本 × (50×32 + 32×16 + 16) × 3(前向+反向) ≈ 350 MFlops → **数百 ms 量级** | 手写 Float32Array 循环在现代设备可达 1~2 GFlops |
| 第一层 | 稀疏前向/反向（只累加非零特征对应的权重列） | 关键性能设计，见 4.4 |

### 5.3 双模型融合（ADR-004）

```
p_final = w · p_LR + (1 − w) · p_MLP
```

- w 在**验证集**上以 0.05 步长 ∈ [0, 1] 网格搜索，目标最大化 AUC
- **防退化规则**：若最优融合的 AUC 不优于两个单模型，直接采用更优单模型（并在指标面板注明使用了哪个模型）——避免融合成为减分项

### 5.4 数据划分与指标（split.ts + metrics.ts）

- 划分：**分层抽样** train/val/test = 60%/20%/20%（保持 4:6 正负比与类目分布）
- 随机性：mulberry32 种子 PRNG，**seed = 42 固定** → 每次加载训练指标可复现
- 指标（test 集报告）：Accuracy、Precision、Recall、F1、**AUC**（Mann-Whitney U 秩实现，约 30 行）
- 验证集只用于：早停、w 网格搜索、λ 选择。**禁止 val/test 参与词表与标准化统计量构建**（写入测试断言，防数据泄漏）

### 5.5 训练编排与耗时预算（trainer.ts）

- **chunked async 训练**：每 10 epoch 让出主线程（`await` 微任务/ rAF），刷新进度条与 loss/AUC 曲线 → UI 永不冻结，训练过程即产品可视化卖点
- 训练在**首帧渲染后**启动（不阻塞首屏）
- 计时：`performance.now()` 记录两模型各自耗时与总耗时，展示在训练面板（透明化 C5 预算达成情况）
- 预算防护：总耗时 > 3s 时触发一次"epochs 减半重训"降级（正常不触发；触发属于异常信号，UI 提示）

**预算结论：LR < 100ms + MLP 数百 ms，两模型合计远小于 2s，C5 达成有余量。**

### 5.6 推理与归因（predict-service.ts）

- 单样本前向 < 50ms（预算 C3）
- 输出：0~100 爆款分数 + 等级（高潜/中等/待优化）+ **特征归因表**：数值特征单项值与方向（推高/拉低）、命中的悬念/情绪词高亮、长度诊断
- 归因依据：数值特征用 z 值方向与 LR 权重符号；文本特征用命中的高权重 n-gram 列表（取 |w| top 5）

---

## 6. 数据集构建策略（ADR-005）

### 6.1 规模与构成

- 总量 **480~500 条**，10 个类目（美妆护肤 / 穿搭 / 美食 / 旅行 / 健身 / 学习成长 / 职场 / 家居 / 母婴 / 数码），每类 ~48 条
- 标签：1 = 爆款（高互动潜力），0 = 平淡（低互动潜力），**正负比约 4:6**
- 每类样本构成模式：
  - 正样本典型模式：数字前置（"3个平价…"）、悬念钩子（"千万别…"）、具体利益点（"一周见效"）、情绪词、分隔符结构化、适度 emoji 点缀
  - 负样本典型模式：平淡陈述（"今天吃了火锅"）、无钩子无利益点、过长（>25 字）或过短（<6 字）、纯品牌/名词堆砌
  - **难例约 15%**：有钩子词但结构散乱（标 0）、无钩子词但信息密度高且具体（标 1）、标题党过度堆砌（标 0）——防止模型只学"词表命中数"

### 6.2 诚实性约束（硬规则，违反即不合格）

1. `src/data/titles.json` 头部注释声明："本数据集为人工构建的示例数据集，用于演示浏览器内机器学习流程，非真实平台抓取数据"
2. UI 训练面板与页脚展示"示例数据集"徽标与一句话说明
3. README 与本文档口径一致
4. **禁止任何"基于 N 万真实笔记训练"话术**；指标定位为"示例数据集上的训练表现"，不是生产精度承诺

### 6.3 标注质量控制

- 标注口径成文（`docs/LABELING.md`：正/负样本判定规则、难例判定规则、边界案例）
- 构建时两轮自检：间隔 48 小时重标一遍，分歧样本删除或改写，不保留模糊样本
- 加载时 schema 校验（dataset.ts）：label ∈ {0,1}、标题非空且 ≤ 60 字、类目合法、正负比在 3.5:6.5 ~ 4.5:5.5 区间——校验失败直接 fail-fast 并在控制台报错

---

## 7. 目录结构设计（C9 强制）

```
titlelab/
├── index.html                    # 唯一页面：只含骨架 + <script type="module">
├── edgeone.json                  # EdgeOne Pages 构建/缓存配置（见第 9 节）
├── package.json / tsconfig.json / vite.config.ts
├── docs/
│   ├── architecture.md           # 本文档
│   ├── LABELING.md               # 数据标注口径
│   └── decisions/ADR-001 ~ 006   # MADR 决策记录
├── src/
│   ├── main.ts                   # 入口：仅装配（初始化 UI → 启动训练 → 绑事件），< 100 行
│   ├── types/                    # 契约层（全项目唯一类型来源）
│   │   ├── dataset.ts            # LabeledTitle / Category
│   │   ├── model.ts              # FeatureVector / TrainReport / PredictResult
│   │   └── ui.ts                 # UI 状态类型
│   ├── data/
│   │   ├── titles.json           # 示例数据集（数据文件，不适用 300 行源码规则）
│   │   ├── lexicon.ts            # 悬念/情绪词表常量
│   │   └── dataset.ts            # 类型化加载 + schema 校验
│   ├── core/                     # 纯计算层：零 DOM 依赖，100% 可独立单测
│   │   ├── rng.ts                # mulberry32 种子 PRNG
│   │   ├── preprocess.ts         # NFKC / 大小写 / 清洗
│   │   ├── features/
│   │   │   ├── ngram.ts          # 字符 1/2-gram 切分
│   │   │   ├── vocabulary.ts     # 词表构建（df≥2, top-2000）
│   │   │   ├── tfidf.ts          # TF-IDF 稀疏向量化
│   │   │   └── numeric.ts        # 14 项数值特征
│   │   ├── models/
│   │   │   ├── logistic-regression.ts
│   │   │   ├── mlp.ts            # 前向/反向（Float32Array + 稀疏第一层）
│   │   │   └── adam.ts           # Adam 优化器
│   │   ├── metrics.ts            # Acc/P/R/F1/AUC（Mann-Whitney U）
│   │   ├── split.ts              # 分层 60/20/20（seed=42）
│   │   └── trainer.ts            # chunked 训练编排 + 早停 + 计时
│   ├── services/                 # 业务层：core 与 ui 之间的编排
│   │   ├── train-service.ts      # 加载→划分→特征→双模型→融合→指标报告
│   │   └── predict-service.ts    # 推理 + 特征归因
│   ├── ui/                       # 表现层
│   │   ├── controller.ts         # 事件绑定 → 调 service → 调渲染（唯一事件入口）
│   │   ├── components/           # 输入区 / 评分卡 / 特征归因表 / 训练面板 / 数据集说明
│   │   ├── charts/line-chart.ts  # 手写 SVG 折线图（loss/AUC 曲线，~120 行）
│   │   └── icons/
│   │       ├── registry.ts       # 图标名 → SVG path 映射（唯一出口）
│   │       └── icon.ts           # createIcon(name, 16|20|24)
│   └── styles/
│       ├── tokens.css            # 设计 Token：全部 CSS 自定义属性（唯一颜色来源）
│       └── main.css
└── tests/
    ├── ngram.test.ts
    ├── tfidf.test.ts             # 小样例 IDF/权重的黄金值断言
    ├── metrics.test.ts           # AUC 已知值（完美排序=1、逆序=0、随机=0.5）
    ├── mlp-gradient.test.ts      # 数值梯度检验（有限差分 vs 解析梯度，相对误差 < 1e-5）
    ├── lr-convergence.test.ts    # 线性可分合成数据必须收敛 Acc ≥ 0.99
    ├── split.test.ts             # 分层比例 + seed 可复现 + 无泄漏断言
    └── dataset.test.ts           # schema 校验 + 正负比区间
```

**分层依赖规则（违反即退回）**：`ui → services → core / data`；`types` 被各层引用；**禁止反向**（core 不得 import DOM / services / ui）。入口 main.ts 只装配。

**图标锁定（C6）**：24×24 viewBox、`stroke="currentColor"`、`stroke-width="1.5"`、`fill="none"`、round linecap/linejoin，统一手写风格；尺寸档 16/20/24px；组件**只能**通过 `createIcon(name, size)` 使用图标，禁止内联散写 SVG path。初版图标清单（8 个）：sparkles（评分）、trending-up（高潜）、trending-down（待优化）、brain（模型）、database（数据集）、chart（指标）、alert（提示）、info（说明）。

**Token 锁定（C7）**：`tokens.css` 定义全部 CSS 自定义属性（色板：品牌主色 + 语义色 + 9 档中性灰、字号、间距、圆角、阴影）；组件样式只引用 `var(--…)`。**主色不用紫→粉渐变**。具体色值由设计师在 tokens.css 交付，前端只消费不新增。

---

## 8. 部署架构与性能预算

### 8.1 edgeone.json（锁定内容）

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": "./dist",
  "nodeVersion": "22.11.0",
  "headers": [
    {
      "source": "/assets/*",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/*",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

要点：
- Vite 产物：`index.html` + `/assets/*.js|css`（hash 文件名）→ hash 资源 immutable 缓存 1 年；`index.html` 每次回源校验
- **本项目为单页无前端路由**，天然规避 EdgeOne rewrites 不支持 SPA 路由重写的限制，无需配置 rewrites
- `nodeVersion: 22.11.0` 取 EdgeOne 预装版本，避免部署失败
- CI：GitHub push main → EdgeOne 自动构建部署；GitHub Actions 门禁（`npm run typecheck && npm test`）PR 必须绿才可合并
- 部署后验证：`curl -I https://<域名>/assets/<hash>.js` 确认 `max-age=31536000`；`curl -I https://<域名>/` 确认 `must-revalidate`（headers 多规则优先级以实测为准，不符合则收紧 source 匹配）

### 8.2 性能预算（超预算即性能回归，不予发布）

| 指标 | 预算 | 手段 |
|------|------|------|
| 总 JS（gzip） | ≤ 40KB（预计实际 15~25KB） | 零依赖、零框架、esbuild 压缩 |
| CSS（gzip） | ≤ 10KB | 原生 CSS + Token，无 Tailwind |
| 数据集体积 | 随 bundle 打包，gzip 增量 ≤ 10KB（500 条 × ~30B） | 不单独发请求 |
| 首屏 LCP | ≤ 1.5s（4G） | 无网络字体——**系统字体栈**（-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif），CJK webfont 动辄数 MB，禁用 |
| 训练总耗时 | < 2s（中端移动设备），> 3s 触发降级 | 见 5.5 |
| 推理延迟 | < 50ms / 次 | 单样本稀疏前向 |
| 单文件行数 | ≤ 300 行（源码） | CI 门禁 `wc -l` 检查 |

缓存说明：不做训练权重 localStorage 持久化（v1 明确不做，见 out-of-scope）——每次加载重训 < 2s，可接受；权重缓存会引入词表/特征版本一致性问题，收益小于复杂度。

---

## 9. 风险清单与缓解

| # | 风险 | 等级 | 缓解措施 |
|---|------|------|----------|
| R1 | 手写反向传播算错（沉默逻辑错误：跑得动、结果错） | **高** | ① 数值梯度检验测试（有限差分 vs 解析梯度，相对误差 < 1e-5，不过即红）；② 线性可分合成数据收敛测试（LR/MLP 必须 Acc ≥ 0.99）；③ 黄金样例测试（TF-IDF/AUC 已知值）；④ core 层零 DOM 依赖保证 100% 可单测 |
| R2 | 低端设备训练超 2s | 中 | chunked 训练保证 UI 不冻结；早停 + epochs 上限双保险；降级重训；耗时在 UI 透明展示 |
| R3 | 数据泄漏（词表/标准化统计量用了全量数据） | 中 | 词表与统计量只在 train 集构建——写入 split.ts 接口契约 + split.test.ts 断言 |
| R4 | 标注主观性 → 指标虚高/虚低 | 中 | 标注口径成文（LABELING.md）+ 难例 15% + 两轮自检 + 指标定位为"示例数据集演示"而非生产精度 |
| R5 | EdgeOne headers 规则优先级与预期不符 | 低 | 部署后 `curl -I` 实测验证，不符则调整 source 匹配 |
| R6 | 浏览器兼容（ES2020 / Float32Array / NFKC） | 低 | 目标 baseline 现代浏览器（2021+ 全支持）；`build.target='es2020'`；不做旧内核适配 |
| R7 | 正负 4:6 轻度不平衡 | 低 | 报告 per-class Precision/Recall + AUC，不只看 Accuracy |
| R8 | 融合劣于单模型 | 低 | 5.3 防退化规则：自动回退更优单模型 |
| R9 | emoji 特征被误解为违反 P0 | 低 | 本文档 4.3 明确边界：内容特征 ≠ UI 图标；数据集 emoji 用量克制 |

---

## 10. 本次不做（Out of Scope，v1）

1. 用户数据上传 / 自定义数据集训练（候选 v1.1）
2. 真实平台数据抓取或任何第三方 API 调用（**永久**：合规红线）
3. 账号系统、云存储、任何后端（**永久**：产品定位零后端）
4. 多语言标题支持（中文 only）
5. 训练权重 localStorage 持久化
6. A/B 实验框架、埋点分析（EdgeOne 无需，静态站零后端）
7. Web Worker 训练（chunked async 已满足 < 2s 与 UI 响应，Worker 是过早优化）

## 11. 开发成本估算

单人 AI 辅助交付：**4~6 个工作日**——ML 核心 + 测试 2 天、数据集构建与标注自检 1.5~2 天、UI 与图表 1 天、部署与性能验证 0.5 天。静态托管零成本（EdgeOne Pages 公测免费 + 平台二级域名），无任何隐性云服务开支。

## 12. 前后端契约说明（替代 openapi.yaml）

本项目为纯前端零 API（C1），**不产出 openapi.yaml**。契约 = ① `src/types/model.ts` 的 TypeScript 接口（FeatureVector / TrainReport / PredictResult，UI 层与 ML 核心据此并行开发）；② 本文档第 4/5 节特征与模型规格；③ ADR-001~006。类型变更必须先改 `types/` 并同步本文档，再改实现。

## 13. 端到端验证步骤（完成定义）

1. `npm ci && npm run typecheck && npm test` 全绿（**梯度检验必须通过**）
2. `npm run build && npx vite preview` 本地预览
3. 核心流走查：页面加载 → 首帧渲染 → 训练进度条与 loss/AUC 曲线动起来 → < 2s 完成 → 指标面板显示 Acc/AUC/F1（数值非 NaN、非 0/1 极端值）→ 输入示例标题 → 0~100 分数 + 等级 + 特征归因表
4. 边界流走查：空输入 → 行内错误提示（不崩溃）；200 字超长标题 → 正常出分；纯 emoji 标题 → 正常出分；训练未完成时输入 → 禁用态或排队提示
5. 门禁：`find src -name '*.ts' | xargs wc -l` 无文件 > 300 行；grep 检查无散落硬编码色值（只允许 tokens.css）
6. 部署 EdgeOne Pages 后访问线上 URL，重复步骤 3~4；`curl -I` 验证两条缓存头规则生效
