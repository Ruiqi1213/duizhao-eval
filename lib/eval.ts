export type Criterion = {
  id: string;
  name: string;
  weight: number;
  anchors: string[];
};
export type Candidate = {
  text: string;
  latencyMs: number | null;
  costCny: number | null;
};
export type Task = {
  id: string;
  title: string;
  category: string;
  instruction: string;
  source: string;
  maxChars: number | null;
  outputs: Candidate[];
  order: number[];
};
export type Experiment = {
  id: string;
  title: string;
  demo: boolean;
  models: string[];
  rubric: Criterion[];
  tasks: Task[];
  createdAt: string;
};
export type Review = {
  taskId: string;
  scores: number[][];
  note: string;
  flags: string[];
  submittedAt: string;
};
export type PublicTask = Omit<Task, 'order' | 'outputs'> & {
  outputs: (Candidate & { modelName?: string })[];
  review: Review | null;
};
export type PublicExperiment = Omit<Experiment, 'tasks' | 'models'> & {
  tasks: PublicTask[];
  models: string[] | null;
  report: Report | null;
};
export type Report = {
  count: number;
  total: number;
  models: {
    name: string;
    mean: number;
    dimensions: number[];
    wins: number;
    risks: number;
    latencyMs: number | null;
    latencyCount: number;
    costCny: number | null;
    costCount: number;
  }[];
  ties: number;
  cases: { title: string; scores: number[]; note: string; flags: string[] }[];
};
export const DEFAULT_RUBRIC: Criterion[] = [
  {
    id: 'fidelity',
    name: '事实忠实度',
    weight: 40,
    anchors: [
      '关键信息错误，或多处无依据补充',
      '少量无依据补充，不影响核心结论',
      '事实均有材料依据，无矛盾',
    ],
  },
  {
    id: 'coverage',
    name: '要求完整度',
    weight: 35,
    anchors: [
      '遗漏核心要求，或至少两项要求',
      '遗漏一项非核心要求',
      '覆盖任务明确要求的全部内容',
    ],
  },
  {
    id: 'usability',
    name: '结构可用性',
    weight: 25,
    anchors: [
      '不符合文档形式，需要大幅重写',
      '形式基本符合，仍需调整结构',
      '信息容易定位，可直接使用',
    ],
  },
];
export const FLAGS = ['事实错误', '遗漏要求', '结构混乱', '无依据补充'];
export const POINTS = [1, 3, 5];
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw Error('数据格式应为 JSON 对象');
  return v as Record<string, unknown>;
}
function str(v: unknown, label: string, max = 20000): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw Error(label + '不能为空，且不能超过 ' + max + ' 字');
  return v.trim();
}
function nullableNumber(v: unknown, label: string, max: number): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max)
    throw Error(label + '必须是有效的非负数字或 null');
  return v;
}
export function validateInput(raw: unknown) {
  const x = obj(raw);
  const title = str(x.title, '评测名称', 100);
  if (!Array.isArray(x.models) || x.models.length !== 2)
    throw Error('每轮评测必须包含两套方案');
  const models = x.models.map((v) => str(v, '方案名称', 100));
  if (models[0] === models[1]) throw Error('两套方案名称不能相同');
  const r = x.rubric === undefined ? DEFAULT_RUBRIC : x.rubric;
  if (!Array.isArray(r) || r.length !== 3) throw Error('首版固定三个评分维度');
  const rubric = r.map((v, i) => {
    const c = obj(v);
    if (c.name !== DEFAULT_RUBRIC[i].name)
      throw Error('首版固定三个维度名称与顺序，可调整权重及评分锚点');
    if (!Array.isArray(c.anchors) || c.anchors.length !== 3)
      throw Error('每个维度需要 1、3、5 分的三个锚点');
    const weight = nullableNumber(c.weight, '权重', 100);
    if (weight === null || weight === 0 || !Number.isInteger(weight))
      throw Error('权重必须是正整数');
    return {
      id: DEFAULT_RUBRIC[i].id,
      name: str(c.name, '维度名称', 30),
      weight,
      anchors: c.anchors.map((a) => str(a, '评分标准', 200)),
    };
  });
  if (rubric.reduce((s, c) => s + c.weight, 0) !== 100)
    throw Error('三个维度的权重之和必须为 100%');
  if (!Array.isArray(x.tasks) || x.tasks.length < 1 || x.tasks.length > 30)
    throw Error('每轮需有 1—30 个任务');
  const tasks = x.tasks.map((v, i) => {
    const t = obj(v);
    if (!Array.isArray(t.outputs) || t.outputs.length !== 2)
      throw Error('每个任务必须包含两份输出，顺序与方案列表一致');
    return {
      id: 'task-' + (i + 1),
      title: str(t.title, '任务名称', 100),
      category:
        typeof t.category === 'string'
          ? str(t.category, '任务类型', 30)
          : '自定义',
      instruction: str(t.instruction, '任务要求', 5000),
      source: str(t.source, '参考材料'),
      maxChars: nullableNumber(t.maxChars, '字数上限', 20000),
      outputs: t.outputs.map((v) => {
        const o = obj(v);
        return {
          text: str(o.text, '候选输出'),
          latencyMs: nullableNumber(o.latencyMs, '耗时（毫秒）', 86400000),
          costCny: nullableNumber(o.costCny, '成本（人民币）', 10000),
        };
      }),
    };
  });
  return { title, models, rubric, tasks };
}
export function newExperiment(
  raw: unknown,
  demo = false,
  id = crypto.randomUUID(),
): Experiment {
  const input = validateInput(raw);
  return {
    ...input,
    id,
    demo,
    createdAt: new Date().toISOString(),
    tasks: input.tasks.map((t) => ({
      ...t,
      order: crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? [1, 0] : [0, 1],
    })),
  };
}
export function validateReview(raw: unknown, taskId: string): Review {
  const x = obj(raw);
  if (
    !Array.isArray(x.scores) ||
    x.scores.length !== 2 ||
    x.scores.some(
      (s) =>
        !Array.isArray(s) ||
        s.length !== 3 ||
        s.some((n) => !POINTS.includes(n)),
    )
  )
    throw Error('请完成两份输出的全部六项评分（1、3、5 分）');
  const note = typeof x.note === 'string' ? x.note.trim() : '';
  if (note.length > 2000) throw Error('问题说明最多 2000 字');
  if ((x.scores as number[][]).flat().includes(1) && note.length < 4)
    throw Error('包含 1 分项时，请补充至少 4 字的问题说明');
  if (!Array.isArray(x.flags) || x.flags.some((f) => !FLAGS.includes(f)))
    throw Error('问题标签不正确');
  return {
    taskId,
    scores: x.scores as number[][],
    note,
    flags: [...new Set(x.flags)] as string[],
    submittedAt: new Date().toISOString(),
  };
}
export function weighted(scores: number[], rubric: Criterion[]) {
  return scores.reduce((sum, s, i) => sum + (s * rubric[i].weight) / 100, 0);
}
export function aggregate(e: Experiment, reviews: Review[]): Report {
  const rows = e.tasks.flatMap((t) => {
    const r = reviews.find((r) => r.taskId === t.id);
    if (!r) return [];
    const mapped = [0, 1].map((m) => r.scores[t.order.indexOf(m)]);
    return [{ t, r, mapped, totals: mapped.map((s) => weighted(s, e.rubric)) }];
  });
  const avg = (a: number[]) =>
    a.length ? a.reduce((s, n) => s + n, 0) / a.length : null;
  return {
    count: rows.length,
    total: e.tasks.length,
    ties: rows.filter((r) => Math.abs(r.totals[0] - r.totals[1]) < 1e-8).length,
    models: e.models.map((name, m) => {
      const latency = rows
        .map((r) => r.t.outputs[m].latencyMs)
        .filter((v): v is number => v !== null);
      const cost = rows
        .map((r) => r.t.outputs[m].costCny)
        .filter((v): v is number => v !== null);
      return {
        name,
        mean: avg(rows.map((r) => r.totals[m])) ?? 0,
        dimensions: e.rubric.map(
          (_, i) => avg(rows.map((r) => r.mapped[m][i])) ?? 0,
        ),
        wins: rows.filter((r) => r.totals[m] - r.totals[1 - m] > 1e-8).length,
        risks: rows.filter((r) => r.mapped[m][0] === 1).length,
        latencyMs: avg(latency),
        latencyCount: latency.length,
        costCny: avg(cost),
        costCount: cost.length,
      };
    }),
    cases: rows.map((r) => ({
      title: r.t.title,
      scores: r.totals,
      note: r.r.note,
      flags: r.r.flags,
    })),
  };
}
export function publicExperiment(
  e: Experiment,
  reviews: Review[],
): PublicExperiment {
  const complete = e.tasks.every((t) => reviews.some((r) => r.taskId === t.id));
  return {
    id: e.id,
    title: e.title,
    demo: e.demo,
    rubric: e.rubric,
    createdAt: e.createdAt,
    models: complete ? e.models : null,
    report: complete ? aggregate(e, reviews) : null,
    tasks: e.tasks.map(({ order, outputs, ...t }) => ({
      ...t,
      outputs: order.map((i) => ({
        text: outputs[i].text,
        latencyMs: complete ? outputs[i].latencyMs : null,
        costCny: complete ? outputs[i].costCny : null,
        ...(complete ? { modelName: e.models[i] } : {}),
      })),
      review: reviews.find((r) => r.taskId === t.id) ?? null,
    })),
  };
}
// Completed report cases and public tasks share the experiment's task order.
export function reportCandidateKey(e: PublicExperiment, caseIndex: number) {
  if (!e.report) return null;
  const [a, b] = e.tasks[caseIndex]?.outputs ?? [];
  if (!a?.modelName || !b?.modelName) return null;
  return '盲评时：候选 A = ' + a.modelName + '；候选 B = ' + b.modelName;
}
export function reportMarkdown(e: PublicExperiment) {
  const r = e.report;
  if (!r) throw Error('完成所有任务后才能导出报告');
  const lines = [
    '# ' + e.title,
    '',
    '数据来源：' +
      (e.demo
        ? '人工编写的演示材料，不代表任何模型表现'
        : '用户导入的候选输出，来源与调用记录未经平台核验'),
    '',
    '评测方式：单人匿名人工评分；每项 1 / 3 / 5 分。',
    '评测样本：' + r.count + ' / ' + r.total + '；创建时间：' + e.createdAt,
    '',
    '## 评分规则',
    ...e.rubric.map(
      (c) =>
        '- ' +
        c.name +
        ' ' +
        c.weight +
        '%：1 分 ' +
        c.anchors[0] +
        '；3 分 ' +
        c.anchors[1] +
        '；5 分 ' +
        c.anchors[2],
    ),
    '',
    '## 方案对比',
  ];
  for (const m of r.models)
    lines.push(
      '- ' +
        m.name +
        '：加权均分 ' +
        m.mean.toFixed(2) +
        '/5；胜出 ' +
        m.wins +
        ' 项；事实低分 ' +
        m.risks +
        ' 项；平均耗时 ' +
        (m.latencyMs === null
          ? '未提供'
          : m.latencyMs + ' ms，n=' + m.latencyCount) +
        '；平均成本 ' +
        (m.costCny === null
          ? '未提供'
          : '¥' + m.costCny.toFixed(4) + '，n=' + m.costCount),
    );
  lines.push(
    '',
    '并列任务：' + r.ties,
    '',
    '结论边界：仅代表当前样本中的人工评分；未经多人一致性检验或统计显著性检验，不能推断通用模型能力。存在事实低分时，应先复核风险再做选型。',
    '',
    '## 问题记录',
  );
  for (const [i, c] of r.cases.entries()) {
    const candidateKey = reportCandidateKey(e, i);
    lines.push(
      '### ' + c.title,
      c.scores.map((s, i) => r.models[i].name + ' ' + s.toFixed(2)).join(' / '),
      '',
    );
    if (candidateKey) lines.push(candidateKey, '');
    lines.push(
      '标签：' + (c.flags.join('、') || '无'),
      '说明：' + (c.note || '未填写'),
      '',
    );
  }
  return lines.join('\n');
}
