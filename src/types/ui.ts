/** UI 状态契约 —— SPEC.md 第 5 节锁定 */
import type { Category, Grade } from './dataset';

/** 优化变体（rewrite-service 输出） */
export interface Variant {
  text: string;
  /** 策略标签，如「+具体数字」「换悬念句式」 */
  strategy: string;
  /** 改动说明：指向具体改动点 */
  changeNote: string;
  /** 模型预估分 0-100 */
  predictedScore: number;
}

/** 历史记录条目（localStorage: titlelab:history） */
export interface HistoryItem {
  text: string;
  score: number;
  grade: Grade;
  category: Category;
  ts: number;
}

export interface TrainProgress {
  /** 0-100 */
  percent: number;
  /** 阶段文案，如「构建标题特征」 */
  stage: string;
}

export type TrainPhase = 'idle' | 'loading' | 'training' | 'ready' | 'error';

export interface AppState {
  phase: TrainPhase;
  progress: TrainProgress | null;
  trainError: string | null;
  report: import('./model').TrainReport | null;
  /** 当前选中赛道（影响热词库与示例） */
  category: Category;
  /** 最近一次检测结果 */
  result: import('./model').PredictResult | null;
  lastTitle: string;
  variants: Variant[] | null;
  /** A/B 对比中选中的变体 */
  compareVariant: Variant | null;
}
