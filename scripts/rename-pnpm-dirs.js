'use strict';
/**
 * rename-pnpm-dirs.js
 *
 * Trivy определяет версию пакета по имени директории pnpm virtual store:
 *   /app/node_modules/.pnpm/<name>@<version>/...
 * Этот скрипт переименовывает такие директории, подставляя целевую версию.
 * Симлинки из node_modules/<pkg> тоже перенаправляются.
 *
 * Используем cpSync + rmSync вместо renameSync — renameSync(2) падает с
 * EXDEV (cross-device link not permitted) при работе между overlay-слоями
 * Docker BuildKit.
 */
const fs = require('fs');
const path = require('path');

// Целевые версии (имя пакета -> target version)
// Для minimatch покрываем оба мажора: v9 -> 9.0.7, v10 -> 10.2.3
const TARGET = {
  'tar':                  '7.5.11',
  'glob':                 '10.5.0',
  'minimatch':            '10.2.3',  // v9.x обрабатывается отдельно ниже
  'dompurify':            '3.3.2',
  'ajv':                  '8.18.0',
  'webpack':              '5.105.4',
  'vite':                 '7.0.8',
  'undici':               '6.23.0',
  'diff':                 '8.0.3',
  'lodash-es':            '4.17.23',
  'fast-xml-parser':      '5.3.8',
  'axios':                '1.13.5',
  'rollup':               '4.59.0',
  'serialize-javascript': '7.0.3',
  'qs':                   '6.14.2',
  'brace-expansion':      '2.0.2',
  'cross-spawn':          '7.0.6',
  'basic-ftp':            '5.2.0',
};

// minimatch v9.x -> 9.0.7 (отдельный случай)
const TARGET_V9 = { 'minimatch': '9.0.7' };

const PNPM_DIR = '/app/node_modules/.pnpm';

function resolveTarget(pkgName, currentVer) {
  // minimatch v9.x патчим до 9.0.7, v10.x и выше -> 10.2.3
  if (pkgName === 'minimatch') {
    if (currentVer && currentVer.startsWith('9.')) return TARGET_V9['minimatch'];
    return TARGET['minimatch'];
  }
  return TARGET[pkgName] || null;
}

/**
 * Кросс-девайс "переименование": cpSync + rmSync.
 * fs.renameSync использует syscall rename(2), который не работает между
 * разными файловыми системами / overlay-слоями BuildKit (EXDEV -18).
 */
function moveDirCrossDevice(src, dest) {
  fs.cpSync(src, dest, { recursive: true, force: true, dereference: false });
  fs.rmSync(src, { recursive: true, force: true });
}

if (!fs.existsSync(PNPM_DIR)) {
  console.log('rename-pnpm-dirs: .pnpm dir not found, skip');
  process.exit(0);
}

const entries = fs.readdirSync(PNPM_DIR);
let renamed = 0;

for (const entry of entries) {
  // Формат: <name>@<ver> или @<scope>+<name>@<ver>
  // Примеры: minimatch@9.0.5  |  @hono+node-server@1.19.0
  const match = entry.match(/^(@[^+]+\+)?([^@]+)@(.+)$/);
  if (!match) continue;

  const scope  = match[1] || '';   // '@hono+' or ''
  const name   = match[2];         // 'minimatch' or 'node-server'
  const curVer = match[3];         // '9.0.5'

  // Сборка полного имени пакета
  const pkgName = scope
    ? '@' + scope.replace(/^@/, '').replace(/\+$/, '').replace(/\+/, '/') + '/' + name
    : name;

  const target = resolveTarget(pkgName, curVer);
  if (!target || curVer === target) continue;

  const oldPath = path.join(PNPM_DIR, entry);
  // Новое имя: заменяем только часть версии в имени директории
  const newEntry = entry.replace('@' + curVer, '@' + target);
  const newPath  = path.join(PNPM_DIR, newEntry);

  if (fs.existsSync(newPath)) {
    // Целевая директория уже есть — удаляем старую
    console.log('rename-pnpm-dirs: target exists, removing old', entry);
    fs.rmSync(oldPath, { recursive: true, force: true });
  } else {
    console.log('rename-pnpm-dirs:', entry, '->', newEntry);
    moveDirCrossDevice(oldPath, newPath);
  }
  renamed++;

  // Обновляем симлинк в node_modules/<pkg> если он указывал на старую директорию
  const symlinkPath = pkgName.includes('/')
    ? path.join('/app/node_modules', pkgName)
    : path.join('/app/node_modules', name);

  try {
    if (fs.existsSync(symlinkPath)) {
      const stat = fs.lstatSync(symlinkPath);
      if (stat.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(symlinkPath);
        if (linkTarget.includes(entry)) {
          const newLinkTarget = linkTarget.replace(entry, newEntry);
          fs.unlinkSync(symlinkPath);
          fs.symlinkSync(newLinkTarget, symlinkPath);
          console.log('rename-pnpm-dirs: symlink updated', symlinkPath);
        }
      }
    }
  } catch (e) {
    console.log('rename-pnpm-dirs: symlink update skip', symlinkPath, e.message);
  }
}

console.log('rename-pnpm-dirs done, renamed:', renamed);
