// bundle-report-v6.mjs — 聚合 v6 训练全链路量化数据 → report-data-v6.json（HTML 报告唯一数据源）
// 数据源：train-v6-stats.json（数据质量管线）/ trainer_log.jsonl（loss 曲线）/
//         train_results.json（训练终态指标）/ accept-result-v6.json（验收七项指标）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const HERE = new URL('.', import.meta.url);
const ROOT = new URL('../../', HERE);
const LF = new URL('../../training-env/LlamaFactory-main/', HERE);
const rd = (p) => readFileSync(p, 'utf8');

// 1. 数据集质量管线统计
const stats = JSON.parse(rd(new URL('train-v6-stats.json', HERE)));

// 2. loss 曲线（trainer_log.jsonl）
const lossCurve = [];
let evalLosses = [];
if (existsSync(new URL('saves/dreamcraft-1.5b-lora-v6/trainer_log.jsonl', LF))) {
  for (const line of rd(new URL('saves/dreamcraft-1.5b-lora-v6/trainer_log.jsonl', LF)).split('\n')) {
    if (!line.trim()) continue;
    const j = JSON.parse(line);
    if (typeof j.loss === 'number') lossCurve.push({ step: j.current_steps, loss: j.loss, epoch: j.epoch, lr: j.lr });
  }
}
// eval loss（eval_log.jsonl，若存在）
const evalPath = new URL('saves/dreamcraft-1.5b-lora-v6/eval_log.jsonl', LF);
if (existsSync(evalPath)) {
  for (const line of rd(evalPath).split('\n')) {
    if (!line.trim()) continue;
    const j = JSON.parse(line);
    if (typeof j.eval_loss === 'number') evalLosses.push({ step: j.current_steps, eval_loss: j.eval_loss });
  }
}

// 3. 训练终态指标（train_results.json）
let trainResults = null;
const trPath = new URL('saves/dreamcraft-1.5b-lora-v6/train_results.json', LF);
if (existsSync(trPath)) trainResults = JSON.parse(rd(trPath));

// 4. 验收结果
let accept = null;
const accPath = new URL('accept-result-v6.json', HERE);
if (existsSync(accPath)) accept = JSON.parse(rd(accPath));

// 5. 训练配置（从 yaml 提取关键超参）
const yaml = rd(new URL('../../training-env/LlamaFactory-main/examples/train_lora/dreamcraft_lora_sft_v6_craft.yaml', HERE));
const yval = (k) => { const m = yaml.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')); return m ? m[1].trim() : null; };
const config = {
  base_model: 'Qwen2.5-1.5B-Instruct',
  method: 'LoRA SFT',
  lora_rank: Number(yval('lora_rank')),
  lora_alpha: Number(yval('lora_alpha')),
  lora_dropout: Number(yval('lora_dropout')),
  learning_rate: yval('learning_rate'),
  num_train_epochs: Number(yval('num_train_epochs')),
  batch_per_device: Number(yval('per_device_train_batch_size')),
  grad_accum: Number(yval('gradient_accumulation_steps')),
  lr_scheduler: yval('lr_scheduler_type'),
  warmup_ratio: Number(yval('warmup_ratio')),
  bf16: true,
  cutoff_len: Number(yval('cutoff_len')),
  val_size: Number(yval('val_size'))
};

const out = {
  version: 'v6',
  generated_at: new Date().toISOString(),
  dataset: stats,
  config,
  train: {
    total_steps: trainResults ? null : (lossCurve.at(-1)?.step ?? null),
    loss_curve: lossCurve,
    eval_loss_curve: evalLosses,
    final_train_loss: lossCurve.length ? lossCurve.reduce((a, b) => (b.step > a.step ? b : a)).loss : null,
    train_results: trainResults
  },
  accept
};

if (trainResults) out.train.total_steps = trainResults.global_step ?? out.train.total_steps;

writeFileSync(new URL('report-data-v6.json', HERE), JSON.stringify(out, null, 2), 'utf8');
console.log('report-data-v6.json 已生成：');
console.log(`  数据集统计: ${Object.keys(stats).length} 项指标`);
console.log(`  loss 曲线: ${lossCurve.length} 个点${evalLosses.length ? `，eval loss ${evalLosses.length} 个点` : ''}`);
console.log(`  训练终态: ${trainResults ? 'train_results.json ✓' : '缺失（训练未完成？）'}`);
console.log(`  验收结果: ${accept ? `pass_rate=${(accept.pass_rate * 100).toFixed(0)}% (${accept.pass_all}/${accept.cases})` : '缺失（验收未执行）'}`);
