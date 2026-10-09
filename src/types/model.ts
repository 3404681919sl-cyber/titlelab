/** 模型契约 —— SPEC.md 第 5 节锁定，core 与 ui 据此并行开发 */

/** 稀疏向量：indices 升序、values 与之一一对应 */
export interface SparseVector {
  indices: Int32Array;
  values: Float64Array;
}

/** 完整特征 = 字符 n-gram TF-IDF（稀疏）+ 14 项数值特征（稠密） */
export interface FeatureVector {
  /** n-gram 部分，维度 = 词表长度 */
  ngram: SparseVector;
  /** 14 项数值特征原始值（未标准化） */
  numeric: Float64Array;
  /** 标准化后的数值特征（z-score，统计量来自 train 集） */
  numericScaled: Float64Array;
}

export type Grade = '爆款潜质' | '良好' | '普通' | '待优化';

export type DimensionStatus = 'good' | 'ok' | 'weak';

/** 六大诊断维度之一 */
export interface DimensionScore {
  /** 维度名（如「情绪浓度」） */
  name: string;
  /** 0-100 */
  score: number;
  status: DimensionStatus;
  /** 图标名（icons registry 中的语义名） */
  icon: string;
  /** 指向具体词的中文诊断 + 建议动作，禁空洞表述 */
  advice: string;
  /** 命中的具体词（用于圈注高亮） */
  hits: string[];
}

/** 特征归因：单项特征对分数的方向与强度 */
export interface FeatureAttribution {
  /** 特征名（中文，面向用户） */
  name: string;
  /** 推高 / 拉低 */
  direction: 'up' | 'down';
  /** 贡献强度 0-100（绝对值归一化后的相对值） */
  strength: number;
}

/** 违禁词命中 */
export interface Violation {
  word: string;
  /** 替换建议 */
  suggestion: string;
}

export interface PredictResult {
  /** 0-100 爆款指数 */
  score: number;
  grade: Grade;
  /** 打开吸引力子分（情绪/悬念/钩子特征组规则加权） */
  openScore: number;
  /** 搜索友好度子分（热词/具体度/长度特征组规则加权） */
  searchScore: number;
  /** 同赛道分位：超过该赛道多少比例的示例标题 */
  percentile: number | null;
  dimensions: DimensionScore[];
  attribution: FeatureAttribution[];
  violations: Violation[];
  /** 输入特征过少（纯符号/纯 emoji 等）提示，无则为 null */
  sparseInputNote: string | null;
  /** true = 模型不可用，使用规则评分降级模式 */
  degraded: boolean;
}

export interface TrainReport {
  /** test 集指标 */
  acc: number;
  auc: number;
  f1: number;
  precision: number;
  recall: number;
  /** 训练总耗时（ms） */
  durationMs: number;
  epochs: number;
  modelUsed: 'ensemble' | 'lr' | 'mlp';
  /** 训练样本量 */
  trainSize: number;
  valSize: number;
  testSize: number;
}
