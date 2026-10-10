import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Provide the source Markdown path.');
const source = readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');
const dimensionNames = ['AI 基础认知', '用户与场景洞察', 'AI 产品设计', '数据与效果评估', '项目落地与协作', '商业与增长'];
const sections = [...source.matchAll(/^### (\d{3})｜([^\n]+)\n([\s\S]*?)(?=^### |^## 查证来源|$(?![\s\S]))/gm)];
function field(body, name) {
  const match = body.match(new RegExp(`\\*\\*${name}：\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|$)`));
  if (!match) throw new Error(`Missing field ${name}`);
  return match[1].trim();
}
const bank = sections.map(([, id, originalTitle, body]) => {
  const dimension = field(body, '主维度');
  const dimensionId = dimensionNames.indexOf(dimension) + 1;
  const options = [...field(body, '选项').matchAll(/^- ([ABCD])\. (.+)$/gm)];
  const correctAnswer = field(body, '正确答案');
  if (!dimensionId || options.map(m => m[1]).join('') !== 'ABCD' || !/^[ABCD]$/.test(correctAnswer)) throw new Error(`Invalid question ${id}`);
  return { id, number: Number(id), originalTitle, dimension, dimensionId,
    difficulty: field(body, '难度'), prompt: field(body, '选择题题干'),
    options: options.map(m => m[2]), correctAnswer };
});
if (bank.length !== 100 || bank.some((q, i) => q.number !== i + 1)) throw new Error('Expected 100 consecutive questions.');
writeFileSync(fileURLToPath(new URL('../src/question-bank.js', import.meta.url)),
  '// Imported from AI_PMCoach_完整标注选择题库.md. Regenerate with scripts/import-question-bank.mjs.\nexport const questionBank = ' + JSON.stringify(bank, null, 2) + ';\n');
console.log(`Imported ${bank.length} questions across ${new Set(bank.map(q => q.dimensionId)).size} dimensions.`);
