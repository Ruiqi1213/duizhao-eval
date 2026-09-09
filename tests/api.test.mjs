import assert from 'node:assert/strict';
const base = process.env.EVAL_TEST_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw Error('自检只允许本地环境，不写入线上数据');
async function call(path, body) {
  const r = await fetch(
    base + path,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  return { status: r.status, body: await r.json() };
}
await call('/api/experiments');
const created = await call('/api/experiments', {
  mode: 'example',
  title: '本地接口自检 · 非真实评测',
});
assert.equal(created.status, 201);
const id = created.body.id;
let e = (await call('/api/experiments/' + id)).body;
assert.equal(e.models, null);
assert.equal(e.tasks.length, 4);
const invalid = await call('/api/experiments/' + id, {
  taskId: 'wrong',
  scores: [
    [5, 5, 5],
    [3, 3, 3],
  ],
  note: '',
  flags: [],
});
assert.equal(invalid.status, 400);
const malformed = await fetch(base + '/api/experiments/' + id, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{',
});
assert.equal(malformed.status, 400);
const forbidden = await fetch(base + '/api/experiments/' + id, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://untrusted.example',
  },
  body: '{}',
});
assert.equal(forbidden.status, 403);
for (let i = 0; i < e.tasks.length; i++) {
  const body = {
    taskId: e.tasks[i].id,
    scores: [
      [5, 5, 5],
      [3, 3, 3],
    ],
    note: '接口测试写入，非真实评价',
    flags: [],
  };
  const saved = await call('/api/experiments/' + id, body);
  assert.equal(saved.status, 200);
  if (i === 0) {
    assert.equal((await call('/api/experiments/' + id, body)).status, 409);
    assert.equal((await call('/api/experiments/' + id)).body.report, null);
  }
}
const after = (await call('/api/experiments/' + id)).body;
assert.equal(after.report.count, 4);
assert.ok(after.tasks.every((t) => t.review));
assert.ok(after.models.length === 2);
assert.ok(after.tasks[0].outputs[0].modelName);
const again = (await call('/api/experiments/' + id)).body;
assert.deepEqual(after, again);
console.log(
  '接口自检通过：创建、数据校验、跨站保护、持久化、重复提交防覆盖、完整评测揭晓、刷新一致性。',
);
