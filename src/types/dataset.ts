/** 数据集契约 —— SPEC.md 第 5 节锁定，全项目唯一类型来源 */

/** 10 个内容赛道 + 通用（通用不参与训练，仅作为赛道 chips 的兜底选项） */
export const CATEGORIES = [
  '美妆护肤',
  '穿搭',
  '美食',
  '旅行',
  '健身',
  '学习成长',
  '职场',
  '家居',
  '母婴',
  '数码',
  '通用',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** 标注样本：label 1 = 爆款（高互动潜力），0 = 平淡（低互动潜力） */
export interface LabeledTitle {
  /** 标题原文，非空且 ≤60 字 */
  text: string;
  label: 0 | 1;
  category: Exclude<Category, '通用'>;
}

/** 数据集 chunk 文件的顶层结构（meta 字段承担“示例数据集”声明职责） */
export interface DatasetChunk {
  /** 诚实性声明：人工构建示例数据集，非真实平台抓取 */
  meta: string;
  items: LabeledTitle[];
}
