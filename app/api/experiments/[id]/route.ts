import { getDb } from '@/db';
import { publicExperiment, validateReview } from '@/lib/eval';
import type { Experiment, Review } from '@/lib/eval';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, ctx: Context) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const row = await db
      .prepare('SELECT data FROM experiments WHERE id=?')
      .bind(id)
      .first<{ data: string }>();
    if (!row) return Response.json({ error: '评测不存在' }, { status: 404 });
    const reviews = await db
      .prepare('SELECT data FROM reviews WHERE experiment_id=?')
      .bind(id)
      .all<{ data: string }>();
    return Response.json(
      publicExperiment(
        JSON.parse(row.data) as Experiment,
        reviews.results.map((r) => JSON.parse(r.data) as Review),
      ),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ error: '评测读取失败，请重试' }, { status: 503 });
  }
}
export async function POST(request: Request, ctx: Context) {
  if (
    request.headers.get('origin') &&
    request.headers.get('origin') !== new URL(request.url).origin
  )
    return Response.json({ error: '不允许跨站提交' }, { status: 403 });
  if (!request.headers.get('content-type')?.includes('application/json'))
    return Response.json({ error: '请提交 JSON 数据' }, { status: 415 });
  try {
    const { id } = await ctx.params;
    const text = await request.text();
    if (text.length > 10000) throw Error('评分内容过长');
    const body = JSON.parse(text);
    const db = getDb();
    const row = await db
      .prepare('SELECT data FROM experiments WHERE id=?')
      .bind(id)
      .first<{ data: string }>();
    if (!row) return Response.json({ error: '评测不存在' }, { status: 404 });
    const e = JSON.parse(row.data) as Experiment;
    if (
      typeof body.taskId !== 'string' ||
      !e.tasks.some((t) => t.id === body.taskId)
    )
      throw Error('任务不属于本轮评测');
    const review = validateReview(body, body.taskId);
    const saved = await db
      .prepare(
        'INSERT OR IGNORE INTO reviews (experiment_id,task_id,data) VALUES (?,?,?)',
      )
      .bind(id, review.taskId, JSON.stringify(review))
      .run();
    if (saved.meta.changes === 0)
      return Response.json(
        { error: '该任务已经提交，请刷新查看；评分记录不可覆盖。' },
        { status: 409 },
      );
    return Response.json({ saved: true, taskId: review.taskId });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof SyntaxError
            ? '评分格式不正确'
            : err instanceof Error
              ? err.message
              : '保存失败，请重试',
      },
      { status: 400 },
    );
  }
}
