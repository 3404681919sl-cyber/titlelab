# ADR-006: EdgeOne Pages 静态部署，hash 资源 immutable 缓存 + index.html 回源校验

## Status: Accepted (2026-10-09)

## Background

用户要求部署 EdgeOne Pages 静态托管、代码托管 GitHub、任何人可访问。本项目为 Vite 构建的纯静态单页产物（index.html + hash 命名的 /assets/*），无前端路由（单视图），无服务端。需要锁定构建配置、缓存策略与性能预算。

已核实事实（EdgeOne 官方文档）：支持 GitHub 仓库联动自动构建部署；项目根目录 edgeone.json 可定义 buildCommand / installCommand / outputDirectory / nodeVersion / headers；nodeVersion 需用预装版本（14.21.3 / 16.20.2 / 18.20.4 / 20.18.0 / 22.11.0），填其他版本可能部署失败；headers 支持 Cache-Control 等自定义响应头；rewrites 不支持 SPA 前端路由重写——本项目无前端路由，天然规避。

## Decision

edgeone.json 锁定：buildCommand "npm run build"、outputDirectory "./dist"、nodeVersion "22.11.0"；headers 两条规则——/assets/* 设置 `public, max-age=31536000, immutable`（Vite hash 文件名，内容变更即换名，可永久缓存），/* 设置 `public, max-age=0, must-revalidate` + `X-Frame-Options: DENY`。

CI：GitHub Actions 门禁（typecheck + test）PR 必须绿才合并；push main 触发 EdgeOne 自动部署。部署后验证 `curl -I` 确认两条缓存头实际生效（多规则优先级以实测为准，不符则收紧 source 匹配）。

性能预算（超预算即性能回归不予发布）：总 JS gzip ≤ 40KB、CSS ≤ 10KB、LCP ≤ 1.5s（4G，系统字体栈禁用 CJK 网络字体）、训练 < 2s、推理 < 50ms、单源文件 ≤ 300 行。不做训练权重 localStorage 持久化（每次加载重训 < 2s 可接受，权重缓存引入词表/特征版本一致性问题）。

## Consequences

正面：配置随仓库走（edgeone.json），环境可复现；hash 资源一年 immutable 缓存，回访零下载；静态托管零成本。

负面：index.html 每次回源校验（体积小，可接受）；headers 规则上限 30 条、value 不支持中文（本项目仅 2 条规则、全英文值，无影响）；EdgeOne 公测期免费策略未来可能调整（届时迁移成本为零——纯静态产物可部署任何静态托管）。

## Related ADRs: ADR-001
