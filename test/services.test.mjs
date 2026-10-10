// 服务层冒烟测试：推理诊断 + 改写引擎 + 图标/图表模块导入（Node 端，无 DOM）。
import { train } from '../src/core/trainer.js';
import { analyze, analyzeRule } from '../src/services/predict.js';
import { generateVariants } from '../src/services/rewrite.js';
import { iconMarkup } from '../src/ui/icons.js';
import { lossChart } from '../src/ui/charts.js';

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('PASS:', msg);
}

const model = await train(() => {});

const res = analyze(model, '亲测有效的减脂餐，坚持30天变化惊人', '美食');
assert(res && typeof res.score === 'number' && res.score >= 0 && res.score <= 100, 'analyze 返回合法分数');
assert(res.dimensions.length === 7, '返回 7 个维度');
assert(res.openScore >= 0 && res.searchScore >= 0 && res.searchScore <= 100, '双子分合法');
assert(Array.isArray(res.strengths) && res.strengths.length > 0, 'strengths 非空');
assert(res.attribution.pos.length >= 0 && res.attribution.terms.length >= 0, '归因结构合法');
assert(Array.isArray(res.suggestions) && res.suggestions.length >= 4, '发布建议生成（≥4 条）');

// 广告营销感检测：营销话术重的标题应被判为疑似广告
const adRes = analyze(model, '黄黑皮天菜！这只橘棕色口红真的巨显白，闭眼入', '美妆护肤');
assert(adRes.adFlag === true && adRes.marketingHits.length >= 2, '广告营销感检测：判定疑似广告投流');
assert(adRes.dimensions.find(d => d.name === '广告营销感').score < 50, '广告营销感维度低分');

const degraded = analyzeRule('随便看看', '通用');
assert(degraded.degraded === true && degraded.score >= 0, '规则降级可用');

const variants = generateVariants(t => model.scoreProb(model.prepareInput(t)).p, '减脂餐好吃吗', '美食');
assert(variants.length === 3, '生成 3 个变体');
assert(variants[0].predictedScore >= variants[1].predictedScore, '变体按分数降序');
assert(variants.every(v => v.text && v.changeNote && v.strategy), '变体字段完整');

assert(iconMarkup('sparkles').startsWith('<svg'), '图标 markdown 生成');
assert(lossChart([0.8, 0.5, 0.3], [0.9, 0.4, 0.2]).includes('<svg'), '折线图生成');

console.log('\n服务层全部通过');
