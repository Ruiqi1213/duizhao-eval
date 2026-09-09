'use client';
import type { PublicExperiment } from '@/lib/eval';
import { reportMarkdown } from '@/lib/eval';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty';
import { Download, LockKeyhole, ArrowRight, TriangleAlert } from 'lucide-react';
export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function EvalReport({
  experiment: e,
  onResume,
}: {
  experiment: PublicExperiment;
  onResume: () => void;
}) {
  const r = e.report;
  if (!r)
    return (
      <section className="panel">
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LockKeyhole />
            </EmptyMedia>
            <EmptyTitle className="text-xl">
              评审结束后，统一揭晓结果
            </EmptyTitle>
            <EmptyDescription>
              已完成 {e.tasks.filter((t) => t.review).length} / {e.tasks.length}{' '}
              个任务。为避免方案身份影响后续评分，报告暂不解锁。
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={onResume}>
            继续匿名评审
            <ArrowRight />
          </Button>
        </Empty>
      </section>
    );
  const diff = Math.abs(r.models[0].mean - r.models[1].mean);
  const winner =
    diff < 1e-8
      ? null
      : r.models[0].mean > r.models[1].mean
        ? r.models[0]
        : r.models[1];
  const hasRisk = r.models.some((m) => m.risks > 0);
  return (
    <div className="stack">
      <div className="report-lead">
        <div>
          <div className="eyebrow">EVALUATION SUMMARY</div>
          <h2 className="text-2xl mt-2">
            {winner
              ? winner.name + ' 在本轮评分更高'
              : '两套方案在本轮评分并列'}
          </h2>
          <p className="small mt-2">
            基于 {r.count} 个任务的单人评分；差值 {diff.toFixed(2)} / 5。
            {e.demo
              ? '当前为人工编写的演示样本，不代表模型实测。'
              : '结果仅适用于本轮材料和评分标准。'}
          </p>
        </div>
        <div className="row wrap mt-5">
          <Button
            onClick={() =>
              download(
                '对照-评测报告.md',
                reportMarkdown(e),
                'text/markdown;charset=utf-8',
              )
            }
          >
            <Download />
            导出报告
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              download(
                'duizhao-review-records.json',
                JSON.stringify(e, null, 2),
                'application/json',
              )
            }
          >
            <Download />
            导出评分记录
          </Button>
        </div>
      </div>
      {hasRisk && (
        <div className="warning row">
          <TriangleAlert size={18} />
          <p>
            发现事实忠实度 1
            分项。高总分不能抵消事实风险，请先复核对应问题，再做选型。
          </p>
        </div>
      )}
      <div className="compare">
        {r.models.map((m, i) => (
          <section className="panel panel-body" key={m.name}>
            <div className="row between">
              <span className="chip">方案 {i + 1}</span>
              <span className="small muted">
                胜出 {m.wins} 项 / 并列 {r.ties} 项
              </span>
            </div>
            <h3 className="mt-3">{m.name}</h3>
            <div className="result-score">
              {m.mean.toFixed(2)}
              <span> / 5</span>
            </div>
            <div className="dimension-bars">
              {e.rubric.map((c, j) => (
                <div key={c.id}>
                  <div className="row between small">
                    <span>{c.name}</span>
                    <strong>{m.dimensions[j].toFixed(2)}</strong>
                  </div>
                  <div className="bar-track">
                    <div
                      style={{
                        width: (m.dimensions[j] / 5) * 100 + '%',
                        background: i ? '#5976a9' : '#228c74',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="cost-grid">
              <div>
                <span>平均生成耗时</span>
                <strong>
                  {m.latencyMs === null
                    ? '未提供'
                    : (m.latencyMs / 1000).toFixed(2) + ' s'}
                </strong>
                <small>
                  有效记录 {m.latencyCount} / {r.count}
                </small>
              </div>
              <div>
                <span>平均单次成本</span>
                <strong>
                  {m.costCny === null ? '未提供' : '¥' + m.costCny.toFixed(4)}
                </strong>
                <small>
                  有效记录 {m.costCount} / {r.count}
                </small>
              </div>
            </div>
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>逐项对照与问题记录</h2>
          <p className="small muted">
            A / B 在不同任务中随机排列；下表已还原为同一方案顺序。
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>任务</TableHead>
              <TableHead>方案 1</TableHead>
              <TableHead>方案 2</TableHead>
              <TableHead>问题与依据</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.cases.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{c.title}</TableCell>
                {c.scores.map((s, j) => (
                  <TableCell key={j}>{s.toFixed(2)}</TableCell>
                ))}
                <TableCell className="whitespace-normal min-w-64">
                  <div className="row wrap mb-1">
                    {c.flags.map((f) => (
                      <span className="chip" key={f}>
                        {f}
                      </span>
                    ))}
                  </div>
                  <span className="small">{c.note || '未填写问题说明'}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <div className="notice">
        <strong>如何使用这份报告</strong>
        <p className="mt-1">
          加权总分 = 各维度评分 ×
          对应权重，再按任务取平均。胜出数按同任务总分比较；缺失耗时与成本不按 0
          计算。当前未进行多人一致性、统计显著性或线上效果验证，不能据此宣称某模型全面更强。
        </p>
      </div>
    </div>
  );
}
