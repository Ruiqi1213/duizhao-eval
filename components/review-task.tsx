'use client';
import { useState, useEffect } from 'react';
import type { PublicTask, Criterion } from '@/lib/eval';
import { FLAGS, POINTS, validateReview } from '@/lib/eval';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Check,
  LoaderCircle,
  ArrowRight,
} from 'lucide-react';
export type ReviewDraft = { scores: number[][]; note: string; flags: string[] };
export function ReviewTask({
  task,
  rubric,
  index,
  total,
  onNavigate,
  onSubmit,
  complete,
  onReport,
  staged,
}: {
  task: PublicTask;
  rubric: Criterion[];
  index: number;
  total: number;
  onNavigate: (n: number) => void;
  onSubmit: (draft: ReviewDraft) => Promise<void>;
  complete: boolean;
  onReport: () => void;
  staged: ReviewDraft | null;
}) {
  const [scores, setScores] = useState<number[][]>(
    task.review?.scores ?? [
      [0, 0, 0],
      [0, 0, 0],
    ],
  );
  const [note, setNote] = useState(task.review?.note ?? '');
  const [flags, setFlags] = useState<string[]>(task.review?.flags ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (staged && !task.review) {
      setScores(staged.scores);
      setNote(staged.note);
      setFlags(staged.flags);
    }
  }, [staged, task.review]);
  const saved = !!task.review;
  const picked = scores.flat().filter(Boolean).length;
  async function submit() {
    setError('');
    setBusy(true);
    try {
      validateReview({ scores, note, flags }, task.id);
      await onSubmit({ scores, note, flags });
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head row between wrap">
          <div className="row">
            <span className="chip">
              {String(index + 1).padStart(2, '0')} /{' '}
              {String(total).padStart(2, '0')}
            </span>
            <h2>{task.title}</h2>
            <span className="chip">{task.category}</span>
          </div>
          <div className="row">
            <Button
              variant="ghost"
              disabled={index === 0 || busy}
              aria-label="上一个任务"
              onClick={() => onNavigate(index - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              disabled={index === total - 1 || busy}
              aria-label="下一个任务"
              onClick={() => onNavigate(index + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="panel-body stack">
          <div>
            <span className="eyebrow">任务要求</span>
            <p className="mt-1 whitespace-pre-wrap">{task.instruction}</p>
          </div>
          <div className="source">
            <h3>参考材料</h3>
            <p className="whitespace-pre-wrap">{task.source}</p>
          </div>
        </div>
      </section>
      <div className="compare">
        {task.outputs.map((output, m) => (
          <section className={'panel ' + (m ? 'candidate-b' : '')} key={m}>
            <div className="panel-head row between">
              <div className="row">
                <span className="letter">{m ? 'B' : 'A'}</span>
                <h3>候选输出</h3>
              </div>
              <span className="meta muted row">
                <LockKeyhole size={14} />
                {saved ? '已提交评分' : '身份已隐藏'}
              </span>
            </div>
            {output.modelName && (
              <div className="px-5 pt-4 small text-primary">
                本题方案：{output.modelName}
              </div>
            )}
            <div className="panel-body candidate">{output.text}</div>
            <div className="output-meta">
              <span>{Array.from(output.text).length} 字符</span>
              {task.maxChars !== null && (
                <span
                  className={
                    Array.from(output.text).length > task.maxChars
                      ? 'text-destructive'
                      : ''
                  }
                >
                  字数检查：
                  {Array.from(output.text).length <= task.maxChars
                    ? '通过'
                    : '超出'}{' '}
                  {task.maxChars} 字符上限
                </span>
              )}
              <span>字数检查不计入质量总分</span>
            </div>
            <div className="scoring">
              {rubric.map((c, i) => (
                <fieldset className="score-row" key={c.id}>
                  <legend className="row between w-full mb-2">
                    <span>{c.name}</span>
                    <span className="meta muted">{c.weight}%</span>
                  </legend>
                  <RadioGroup
                    value={String(scores[m][i])}
                    disabled={saved || busy}
                    onValueChange={(v) =>
                      setScores((s) =>
                        s.map((a, k) =>
                          k === m
                            ? a.map((n, j) => (j === i ? Number(v) : n))
                            : a,
                        ),
                      )
                    }
                    aria-label={String.fromCharCode(65 + m) + ' ' + c.name}
                    className="score-options"
                  >
                    {POINTS.map((n, k) => (
                      <label
                        key={n}
                        className={
                          'score-option ' +
                          (scores[m][i] === n ? 'selected' : '')
                        }
                      >
                        <RadioGroupItem value={String(n)} />
                        <span>{n} 分</span>
                        <span className="meta muted">
                          {['需重写', '需修改', '可采用'][k]}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                  <p className="anchor">
                    {scores[m][i]
                      ? c.anchors[POINTS.indexOf(scores[m][i])]
                      : '选择分数后显示对应标准'}
                  </p>
                </fieldset>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className="panel panel-body">
        <div className="row between wrap">
          <h3>问题记录</h3>
          <span className="meta muted">
            出现 1 分项时，请说明问题及对应原文
          </span>
        </div>
        <div className="row wrap my-4">
          {FLAGS.map((f) => (
            <label className="row small mr-3" key={f}>
              <Checkbox
                checked={flags.includes(f)}
                disabled={saved || busy}
                onCheckedChange={(v) =>
                  setFlags((a) => (v ? [...a, f] : a.filter((x) => x !== f)))
                }
              />
              {f}
            </label>
          ))}
        </div>
        <Textarea
          value={note}
          disabled={saved || busy}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：候选 B 将“无需报名”改成“提前线上报名”，与材料矛盾。"
          className="min-h-24 text-base"
        />
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="review-footer row between wrap">
        <div>
          <p className="small">
            {saved ? (
              <span className="text-primary row">
                <Check size={16} />
                已保存 · 评分记录已锁定
              </span>
            ) : (
              '已评分 ' + picked + ' / 6 项'
            )}
          </p>
          <p className="meta muted">
            {saved
              ? '修改标准或重新评测，请新建一轮。'
              : '先独立评分。全部任务完成后统一揭晓方案身份；切换任务不保存未提交评分。'}
          </p>
        </div>
        {saved ? (
          <Button
            className="h-10 px-5"
            onClick={() =>
              complete ? onReport() : onNavigate((index + 1) % total)
            }
          >
            {complete ? '查看评测报告' : '继续评审'}
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button
            className="h-10 px-5"
            disabled={busy || picked !== 6}
            onClick={submit}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            提交本组评分
          </Button>
        )}
      </div>
    </div>
  );
}
