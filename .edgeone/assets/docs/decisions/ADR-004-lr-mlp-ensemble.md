# ADR-004: LR 与 MLP 概率加权融合，验证集网格搜索权重，可退化到单模型

## Status: Accepted (2026-10-09)

## Background

需求明确要求同时落地逻辑回归与小型神经网络两类方法。两模型特性互补：LR 在 500 样本 + 高维稀疏特征上稳定、可解释（权重符号直接支撑特征归因）；MLP 能学特征间交互但更易过拟合。需要定义两者如何共同产出最终分数，并防止融合劣化。

## Decision

结构：LR = 2014 维输入、全批梯度下降（lr=0.5）+ L2（λ=1e-4）、300 epoch、耗时 < 100ms。MLP = 2014→32(ReLU)→16(ReLU)→1(sigmoid)、He 初始化、Adam（batch 32、lr 1e-3、weight decay 1e-4）、150 epoch 上限 + 早停（val loss 连续 15 epoch 不降）、稀疏第一层、耗时数百 ms。

融合：p_final = w·p_LR + (1−w)·p_MLP，w 在验证集上以 0.05 步长 ∈ [0,1] 网格搜索最大化 AUC；**防退化规则：最优融合 AUC 不优于单模型时，直接采用更优单模型并在指标面板注明**。

数据划分：分层 60/20/20（train/val/test），mulberry32 PRNG seed=42 固定，指标可复现。指标在 test 集报告：Accuracy / Precision / Recall / F1 / AUC（Mann-Whitney U 秩实现）。val 仅用于早停、w 搜索、λ 选择；词表与标准化统计量仅来自 train 集（测试断言防泄漏）。

## Consequences

正面：双模型各自指标 + 融合指标全部展示，满足"展示训练指标"需求且有教学说服力；早停 + L2 + 小隐藏层（参数量 ~65K）三层过拟合防护；总训练耗时 < 1s，满足 2s 预算。

负面：5 万参数以下的 MLP 表达能力有限——在示例数据集上这不是缺陷而是恰当规模（更大只会过拟合）；融合权重依赖验证集质量，已由分层划分与固定 seed 控制方差。

## Related ADRs: ADR-002, ADR-003, ADR-005
