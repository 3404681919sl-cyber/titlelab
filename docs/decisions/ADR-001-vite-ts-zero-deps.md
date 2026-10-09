# ADR-001: 使用 Vite + TypeScript（零 UI 框架、零运行时依赖）作为 TitleLab 技术栈

## Status: Accepted (2026-10-09)

## Background

用户需求为纯前端静态 Web 应用（零后端、零 API Key），部署 EdgeOne Pages。项目总监提出三个候选：A（vanilla 无构建多模块）、B（Vite+React+TS+Tailwind+TF.js）、C（Next.js+服务端推理）。方案 C 违反零后端硬约束直接淘汰。方案 A 与 B 之争的核心：本项目是否需要构建步骤与 UI 框架。

本项目最高风险代码是手写反向传播（MLP）——属于"沉默逻辑错误"高危区（编译通过、跑得动、结果错）。纯 vanilla 无构建意味着没有 tsc 类型门禁、没有单测运行器，违反生成式代码失效模式规范中"构建/类型检查作为必过门"的纪律。而本项目是单页单视图工具（输入框+评分卡+训练面板），React 运行时（~45KB gzip）买不回收益；Tailwind 与"统一 Token"目标可由原生 CSS 自定义属性更轻量地达成。

## Decision

采用 Vite 7.x + TypeScript 5.x，**无 UI 框架、零运行时依赖**（dependencies 为空），样式用原生 CSS + tokens.css 自定义属性。构建仅用于：类型检查门禁（tsc）、单测（Vitest 3）、压缩与 hash 打包（esbuild）。版本锚定：vite ^7 / typescript ^5.6 / vitest ^3，package-lock 锁定；Node 22.11.0（EdgeOne 预装版本，本地与 CI 一致）；build target es2020。

## Consequences

正面：总 JS gzip 预算 ≤ 40KB（预计 15~25KB），首屏极快；每一步 ML 数值计算可断点、可单测；tsc + Vitest 构成幻觉接口与沉默逻辑错误的强制门禁；部署产物纯静态，与 vanilla 方案完全一致。

负面：无组件框架，DOM 更新手写（以单页规模与 render.ts 纯渲染函数控制复杂度）；若未来演化为多视图应用需引入框架（届时单独立 ADR）。

## Related ADRs: ADR-002, ADR-006
