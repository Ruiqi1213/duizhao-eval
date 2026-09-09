import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newExperiment,
  validateInput,
  validateReview,
  DEFAULT_RUBRIC,
  weighted,
  publicExperiment,
  aggregate,
  reportMarkdown,
} from '../lib/eval.ts';
import { exampleInput } from '../lib/example.ts';
const make = () => newExperiment(exampleInput, true);
test('人工示例四任务，无伪造耗时成本', () => {
  const e = make();
  assert.equal(e.tasks.length, 4);
  assert.ok(
    e.tasks.every((t) =>
      t.outputs.every((o) => o.latencyMs === null && o.costCny === null),
    ),
  );
});
test('每题匿名排列为完整双射，序列化后保持', () => {
  const e = make();
  assert.ok(e.tasks.every((t) => [...t.order].sort().join() === '0,1'));
  assert.deepEqual(
    JSON.parse(JSON.stringify(e)).tasks.map((t) => t.order),
    e.tasks.map((t) => t.order),
  );
});
test('盲评接口无方案身份、映射、成本耗时泄漏', () => {
  const e = make();
  e.tasks[0].outputs[0].costCny = 2;
  const p = publicExperiment(e, []);
  assert.equal(p.models, null);
  assert.equal(p.report, null);
  assert.ok(!JSON.stringify(p).includes(e.models[0]));
  assert.ok(
    p.tasks.every(
      (t) =>
        !('order' in t) &&
        t.outputs.every((o) => o.costCny === null && !('modelName' in o)),
    ),
  );
});
test('未完成所有任务时不可揭晓或导出报告', () => {
  const e = make();
  const p = publicExperiment(e, [
    validateReview(
      {
        scores: [
          [5, 5, 5],
          [3, 3, 3],
        ],
        note: '',
        flags: [],
      },
      e.tasks[0].id,
    ),
  ]);
  assert.equal(p.report, null);
  assert.throws(() => reportMarkdown(p));
});
test('A/B 随机换位后总分仍还原到对应方案', () => {
  const e = make();
  e.tasks.forEach((t, i) => (t.order = i % 2 ? [1, 0] : [0, 1]));
  const r = e.tasks.map((t) =>
    validateReview(
      {
        scores: t.order.map((m) => (m ? [3, 3, 3] : [5, 5, 5])),
        note: '',
        flags: [],
      },
      t.id,
    ),
  );
  const p = publicExperiment(e, r);
  assert.equal(p.report.models[0].mean, 5);
  assert.equal(p.report.models[1].mean, 3);
  assert.equal(p.report.models[0].wins, 4);
  assert.ok(p.tasks[1].outputs[0].modelName === e.models[1]);
});
test('并列不错误计为胜出', () => {
  const e = make();
  const r = e.tasks.map((t) =>
    validateReview(
      {
        scores: [
          [3, 3, 3],
          [3, 3, 3],
        ],
        note: '',
        flags: [],
      },
      t.id,
    ),
  );
  const out = aggregate(e, r);
  assert.equal(out.ties, 4);
  assert.equal(out.models[0].wins, 0);
});
test('缺失指标排除，零成本保留为有效值', () => {
  const e = make();
  e.tasks[0].outputs[0].costCny = 0;
  e.tasks[1].outputs[0].costCny = 2;
  e.tasks[0].outputs[0].latencyMs = 500;
  const r = e.tasks.map((t) =>
    validateReview(
      {
        scores: [
          [5, 5, 5],
          [3, 3, 3],
        ],
        note: '',
        flags: [],
      },
      t.id,
    ),
  );
  const out = aggregate(e, r);
  assert.equal(out.models[0].costCny, 1);
  assert.equal(out.models[0].costCount, 2);
  assert.equal(out.models[1].costCny, null);
  assert.equal(out.models[0].latencyMs, 500);
});
test('权重与总分计算', () =>
  assert.equal(weighted([5, 3, 1], DEFAULT_RUBRIC), 3.3));
test('无效权重与重复方案名拒绝', () => {
  assert.throws(() =>
    validateInput({
      ...exampleInput,
      rubric: DEFAULT_RUBRIC.map((r) => ({ ...r, weight: 30 })),
    }),
  );
  assert.throws(() =>
    validateInput({ ...exampleInput, models: ['same', 'same'] }),
  );
});
test('空任务、空输出和负数指标拒绝', () => {
  assert.throws(() => validateInput({ ...exampleInput, tasks: [] }));
  const x = structuredClone(exampleInput);
  x.tasks[0].outputs[0].text = ' ';
  assert.throws(() => validateInput(x));
  const y = structuredClone(exampleInput);
  y.tasks[0].outputs[0].latencyMs = -1;
  assert.throws(() => validateInput(y));
});
test('评分必填且仅允许三个锚点值', () => {
  for (const scores of [
    [
      [0, 3, 5],
      [5, 5, 5],
    ],
    [
      [2, 3, 5],
      [5, 5, 5],
    ],
    [[5, 5, 5]],
  ])
    assert.throws(() => validateReview({ scores, note: '', flags: [] }, 't'));
});
test('低分必须附问题说明；标签去重', () => {
  assert.throws(() =>
    validateReview(
      {
        scores: [
          [1, 3, 5],
          [5, 5, 5],
        ],
        note: '',
        flags: [],
      },
      't',
    ),
  );
  assert.equal(
    validateReview(
      {
        scores: [
          [1, 3, 5],
          [5, 5, 5],
        ],
        note: '材料事实冲突',
        flags: ['事实错误', '事实错误'],
      },
      't',
    ).flags.length,
    1,
  );
});
test('导出报告保留来源、分母和结论边界', () => {
  const e = make();
  const r = e.tasks.map((t) =>
    validateReview(
      {
        scores: [
          [5, 5, 5],
          [3, 3, 3],
        ],
        note: '',
        flags: [],
      },
      t.id,
    ),
  );
  const md = reportMarkdown(publicExperiment(e, r));
  assert.match(md, /人工编写的演示/);
  assert.match(md, /4 \/ 4/);
  assert.match(md, /统计显著性/);
  assert.match(md, /未提供/);
});
