import { promises as fs } from 'fs';
import path from 'path';
import clipboardy from 'clipboardy';

// --- КОНФИГУРАЦИЯ ---
const ROOT_DIR = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.vscode',
  '.idea',
  'bridge',
  'katex',
  'skulpt',
  'ace',
]);

const IGNORE_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.snapshot.js', // Игнорируем сам этот скрипт
]);

const IGNORE_EXTENSIONS = new Set([
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.eot',
  '.ttf',
  '.otf'
]);
// --- КОНЕЦ КОНФИГУРАЦИИ ---

// Определяем язык для подсветки синтаксиса в Markdown
function getLanguage(filePath) {
  const ext = path.extname(filePath).slice(1);
  const langMap = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    sh: 'shell',
    py: 'python',
    mjs: 'javascript',
  };
  return langMap[ext] || '';
}

async function processProject(dir) {
  const filePaths = [];
  const treeLines = [];

  async function traverse(currentDir, prefix = '') {
    const dirents = await fs.readdir(currentDir, { withFileTypes: true });
    // Фильтруем и сортируем: сначала папки, потом файлы
    const sortedDirents = dirents
      .filter(dirent => !IGNORE_DIRS.has(dirent.name) && !IGNORE_FILES.has(dirent.name))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (let i = 0; i < sortedDirents.length; i++) {
      const dirent = sortedDirents[i];
      const isLast = i === sortedDirents.length - 1;
      const connector = isLast ? '└── ' : '├── ';

      const fullPath = path.join(currentDir, dirent.name);
      const relativePath = path.relative(ROOT_DIR, fullPath);

      treeLines.push(`${prefix}${connector}${dirent.name}`);

      if (dirent.isDirectory()) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        await traverse(fullPath, newPrefix);
      } else {
        const ext = path.extname(dirent.name);
        if (!IGNORE_EXTENSIONS.has(ext) && fullPath.indexOf('.min.') === -1) {
          filePaths.push(relativePath);
        }
      }
    }
  }

  await traverse(dir);

  const treeStructure = `.\n${treeLines.join('\n')}`;

  const contentBlocks = [];
  console.log('--- Начинаю обработку файлов ---');
  for (const filePath of filePaths) {
    console.log(filePath); // Выводим только имя файла в лог
    const fullPath = path.join(ROOT_DIR, filePath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lang = getLanguage(filePath);

      const block = [
        `# vvvvvvvv ${filePath} begin`,
        `\`\`\`${lang}`,
        content.trim(),
        `\`\`\``,
        `# ^^^^^^^^ ${filePath} end`
      ].join('\n');

      contentBlocks.push(block);
    } catch (error) {
      console.error(`Ошибка чтения файла ${filePath}:`, error);
    }
  }
  console.log('--- Обработка файлов завершена ---\n');

  return `${treeStructure}\n\n${contentBlocks.join('\n\n')}`;
}

async function main() {
  console.log('Генерирую структуру проекта и содержимое файлов...');
  try {
    const fullOutput = await processProject(ROOT_DIR);

    await clipboardy.write(fullOutput);

    console.log('✅ Готово! Структура проекта и содержимое файлов скопированы в буфер обмена.');
    console.log(`Общий размер: ${Math.round(fullOutput.length / 1024)} KB`);
  } catch (error) {
    console.error('Произошла ошибка:', error);
  }
}

main();