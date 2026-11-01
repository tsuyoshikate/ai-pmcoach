// Converts authored question files (question-sources/d1.txt … d6.txt) into question-bank entries.
// Usage: node scripts/build-extra-questions.mjs <out.json> <firstId> question-sources/d1.txt … d6.txt
// Authoring format: the correct option is always written first ("+"); positions are
// assigned here so that A/B/C/D are balanced across the whole new set.
import { readFileSync, writeFileSync } from 'node:fs';

const names = ['AI 基础认知', '用户与场景洞察', 'AI 产品设计', '数据与效果评估', '项目落地与协作', '商业与增长'];
const labels = ['入门', '基础', '进阶', '高阶', '专家'];
const [, , outPath, startId, ...files] = process.argv;

const blocks = files.flatMap(f => readFileSync(f, 'utf8').replace(/\r/g, '').split(/^@ /m).slice(1).map(b => ({ f, b })));
let n = Number(startId);
const out = blocks.map(({ f, b }, i) => {
  const lines = b.trim().split('\n').map(s => s.trim()).filter(Boolean);
  const head = Object.fromEntries(lines[0].split('|').map(s => s.trim().split('=')).map(([k, v]) => [k.trim(), v.trim()]));
  const get = p => { const l = lines.find(x => x.startsWith(p + ':')); if (!l) throw Error(`${f} #${i}: missing ${p}\n${b}`); return l.slice(p.length + 1).trim(); };
  const opts = lines.filter(l => /^[+-] /.test(l)).map(l => { const [t, e] = l.slice(2).split('||').map(s => s.trim()); if (!t || !e) throw Error(`${f} #${i}: bad option ${l}`); return { t, e, ok: l[0] === '+' }; });
  if (opts.length !== 4 || opts.filter(o => o.ok).length !== 1 || !opts[0].ok) throw Error(`${f} #${i}: need 4 options, first correct\n${b}`);
  const dim = Number(head.dim), lv = Number(head.lv);
  if (!(dim >= 1 && dim <= 6 && lv >= 1 && lv <= 5)) throw Error(`${f} #${i}: bad head`);
  // Balanced but not sequential: each run of 4 questions uses a different permutation of A–D.
  const perms = [[0,1,2,3],[2,0,3,1],[1,3,0,2],[3,2,1,0],[2,3,0,1],[1,0,3,2],[3,1,2,0],[0,2,1,3]];
  const pos = perms[Math.floor(i / 4) % perms.length][i % 4];
  const wrong = opts.slice(1);
  const rot = (i * 7) % 3; // vary distractor order too
  const ws = [...wrong.slice(rot), ...wrong.slice(0, rot)];
  const ordered = [...ws.slice(0, pos), opts[0], ...ws.slice(pos)];
  const id = String(n++).padStart(3, '0');
  return {
    id, number: Number(id), originalTitle: get('T'), dimension: names[dim - 1], dimensionId: dim,
    difficulty: labels[lv - 1], difficultyLevel: lv, prompt: get('Q'),
    options: ordered.map(o => o.t), correctAnswer: 'ABCD'[pos],
    assessmentPoints: get('P').split('｜').map(s => s.trim()).filter(Boolean).map(s => /[。！？]$/.test(s) ? s : s + '。'),
    focus: /[。]$/.test(get('F')) ? get('F') : get('F') + '。',
    keywords: get('K').split('、').map(s => s.trim()).filter(Boolean),
    explanations: Object.fromEntries(ordered.map((o, k) => ['ABCD'[k], /[。！？]$/.test(o.e) ? o.e : o.e + '。'])),
    source: head.src,
  };
});
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`built ${out.length} questions -> ${outPath}`);
