'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_RUBRIC, validateInput } from '@/lib/eval';
import { Download, FileJson, ArrowRight, LoaderCircle } from 'lucide-react';
export function CreateExperiment({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [mode, setMode] = useState('example');
  const [title, setTitle] = useState('文档生成方案对比');
  const [json, setJson] = useState('');
  const [rubric, setRubric] = useState(() => structuredClone(DEFAULT_RUBRIC));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function create() {
    setError('');
    setBusy(true);
    try {
      let payload: unknown;
      if (mode === 'example') payload = { mode, title, rubric };
      else {
        let data;
        try {
          data = JSON.parse(json);
        } catch {
          throw Error('请上传有效的 JSON 文件，或检查粘贴内容。');
        }
        payload = validateInput({ ...data, title, rubric });
      }
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { id: string; error?: string };
      if (!response.ok) throw Error(data.error);
      await onCreated(data.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败，请重试');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-7">
        <DialogHeader>
          <div className="eyebrow">NEW EXPERIMENT</div>
          <DialogTitle className="text-2xl">新建一轮评测</DialogTitle>
          <DialogDescription>
            确认任务和标准后开始盲评。本轮标准将锁定，评分不会覆盖其他记录。
          </DialogDescription>
        </DialogHeader>
        <label className="field">
          评测名称
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="例如：课程讲义生成 · Prompt v1 / v2"
          />
        </label>
        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(String(v));
            setError('');
          }}
        >
          <TabsList className="w-full h-10">
            <TabsTrigger value="example">使用示例任务</TabsTrigger>
            <TabsTrigger value="import">导入真实输出</TabsTrigger>
          </TabsList>
          <TabsContent value="example">
            <div className="notice mt-4">
              <strong>四类中文文档 · 两套人工编写的候选输出</strong>
              <p className="mt-1">
                会议清单、活动通知、版本说明、用户反馈。无预设分数；耗时和成本均未实测。
              </p>
            </div>
          </TabsContent>
          <TabsContent value="import">
            <div className="stack mt-4">
              <div className="row between wrap">
                <p className="small muted">先下载模板，替换材料与两套输出。</p>
                <a
                  href="/api/template"
                  download
                  className="small text-primary row"
                >
                  <Download size={16} />
                  下载 JSON 模板
                </a>
              </div>
              <label className="import-zone">
                <FileJson size={24} />
                <span>选择 JSON 文件</span>
                <span className="meta muted">最多 1 MB · 1—30 个任务</span>
                <Input
                  type="file"
                  accept=".json,application/json"
                  className="mt-2"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1000000) {
                      setError('文件不能超过 1 MB');
                      return;
                    }
                    setJson(await file.text());
                    setError('');
                  }}
                />
              </label>
              <label className="field">
                或粘贴 JSON
                <Textarea
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  placeholder='{"models":["方案一","方案二"],"tasks":[...]}'
                  className="font-mono min-h-32"
                />
              </label>
              <p className="meta muted">
                仅接收文本与调用记录，不执行文件内容。请勿上传公司内部资料、个人隐私或未经授权的数据。耗时单位
                ms，成本单位人民币；缺失填 null。
              </p>
            </div>
          </TabsContent>
        </Tabs>
        <details className="rubric-config">
          <summary>
            调整评分标准{' '}
            <span className="muted small">默认权重 40 / 35 / 25</span>
          </summary>
          <p className="small muted my-3">
            以下设置优先于导入文件中的 rubric。每项只能选 1、3、5 分。
          </p>
          {rubric.map((c, i) => (
            <div className="config-item" key={c.id}>
              <div className="row">
                <label className="field flex-1">
                  维度名称
                  <Input
                    value={c.name}
                    readOnly
                    aria-label={c.name + '，维度名称固定'}
                  />
                </label>
                <label className="field w-24">
                  权重 %
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={c.weight}
                    onChange={(e) =>
                      setRubric((r) =>
                        r.map((v, j) =>
                          j === i
                            ? { ...v, weight: Number(e.target.value) }
                            : v,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              {c.anchors.map((a, k) => (
                <label className="field mt-3" key={k}>
                  {[1, 3, 5][k]} 分
                  <Input
                    value={a}
                    maxLength={200}
                    onChange={(e) =>
                      setRubric((r) =>
                        r.map((v, j) =>
                          j === i
                            ? {
                                ...v,
                                anchors: v.anchors.map((s, l) =>
                                  l === k ? e.target.value : s,
                                ),
                              }
                            : v,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          ))}
          <p className="small">
            当前合计：{rubric.reduce((sum, c) => sum + c.weight, 0)}%（需为
            100%）
          </p>
        </details>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="row between border-t pt-4">
          <span className="meta muted">首版不调用模型，不消耗 API 费用</span>
          <Button
            className="h-10 px-4"
            disabled={
              busy ||
              !title.trim() ||
              rubric.reduce((s, c) => s + c.weight, 0) !== 100
            }
            onClick={create}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <ArrowRight size={16} />
            )}
            创建并开始
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
