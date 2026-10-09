# ADR-003: 中文标题采用字符 1+2-gram TF-IDF + 14 项数值特征

## Status: Accepted (2026-10-09)

## Background

小红书标题为中文短文本（平均 15~25 字），需在浏览器内向量化。候选：分词器（jieba-wasm 等）+ 词级 TF-IDF、字符 n-gram TF-IDF、纯数值特征（无文本特征）。分词器增加包体积与歧义处理复杂度，且网络流行语（"绝绝子"）对分词器是 OOV；纯数值特征丢失全部内容信息，无法支撑"爆款预测"说服力。

## Decision

文本特征：字符 1-gram + 2-gram 并集。预处理 NFKC 归一化 + 小写 + 空白压缩；词表仅在 train 集构建（df ≥ 2，按 df 降序取 top 2000）；权重 sublinear TF（1+log）+ 平滑 IDF（ln((1+N)/(1+df))+1）+ L2 归一化，稀疏存储 [index, value][]；推理 OOV 丢弃。

数值特征 14 项：lengthNorm、inOptimalBand(8~20 字)、digitRatio、hasLeadingDigit、questionMarkCount、exclamationCount、suspenseHitCount（~40 词悬念词表）、emotionHitCount（~40 词情绪词表）、emojiDensity、separatorCount、hasBracketPair、hasColon、uniqueCharRatio、endsWithHook。全部 z-score 标准化（统计量仅来自 train 集，随模型 artifact 保存）。

## Consequences

正面：零分词依赖，bigram 天然覆盖"绝了/亲测/后悔"等高频子串；总维度约 2014，稀疏表示下单样本仅 ~50 非零位，训练与推理都在毫秒级；特征归因可解释（命中的高权重 n-gram 直接高亮展示）。

负面：字符 bigram 不理解语义同义（"超好吃"≈"太美味"识别为不同特征）——在 500 样本示例数据集上可接受，语义泛化留给未来 embedding 方案（需 API，违反零 Key 约束，不做）；词表上限 2000 为锁定值，开发期允许一次性网格实验（1500/2000/3000）后写死，不做线上自适应。

## Related ADRs: ADR-002, ADR-004, ADR-005
