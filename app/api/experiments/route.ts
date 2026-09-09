import { getDb } from '@/db';
import { newExperiment } from '@/lib/eval';
import type { Experiment } from '@/lib/eval';
import { exampleInput } from '@/lib/example';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const db = getDb();
    const seed = newExperiment(exampleInput, true, 'demo');
    await db
      .prepare(
        'INSERT OR IGNORE INTO experiments (id,title,data,created_at) VALUES (?,?,?,?)',
      )
      .bind(seed.id, seed.title, JSON.stringify(seed), seed.createdAt)
      .run();
    const rows = await db
      .prepare(
        'SELECT e.id,e.data,COUNT(r.task_id) AS reviewed FROM experiments e LEFT JOIN reviews r ON r.experiment_id=e.id GROUP BY e.id ORDER BY e.created_at DESC LIMIT 100',
      )
      .all<{ id: string; data: string; reviewed: number }>();
    return Response.json(
      {
        experiments: rows.results.map((row) => {
          const e = JSON.parse(row.data) as Experiment;
          return {
            id: e.id,
            title: e.title,
            demo: e.demo,
            total: e.tasks.length,
            reviewed: row.reviewed,
            createdAt: e.createdAt,
          };
        }),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: '暂时无法读取评测，请稍后重试。' },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  if (
    request.headers.get('origin') &&
    request.headers.get('origin') !== new URL(request.url).origin
  )
    return Response.json({ error: '不允许跨站提交' }, { status: 403 });
  if (!request.headers.get('content-type')?.includes('application/json'))
    return Response.json({ error: '请提交 JSON 数据' }, { status: 415 });
  try {
    const text = await request.text();
    if (text.length > 1_000_000)
      return Response.json(
        { error: '数据请控制在 1 MB 以内' },
        { status: 413 },
      );
    const body = JSON.parse(text);
    const isDemo = body.mode === 'example';
    const e = newExperiment(
      isDemo
        ? {
            ...exampleInput,
            title: body.title || exampleInput.title,
            rubric: body.rubric,
          }
        : body,
      isDemo,
    );
    const db = getDb();
    await db
      .prepare(
        'INSERT INTO experiments (id,title,data,created_at) VALUES (?,?,?,?)',
      )
      .bind(e.id, e.title, JSON.stringify(e), e.createdAt)
      .run();
    return Response.json({ id: e.id }, { status: 201 });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof SyntaxError
            ? 'JSON 格式不正确'
            : err instanceof Error
              ? err.message
              : '创建失败，请重试',
      },
      { status: 400 },
    );
  }
}
