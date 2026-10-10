#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_PROJECT_REF = 'zjsvkdmpjxtlxqyzaxpa';
export const REQUIRED_REMOTE_BASELINE = [
  '202609050001',
  '202609050002',
  '202609050003',
  '202609130001',
  '202609220001',
];

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDirectory, '..');
const migrationDirectory = join(mobileRoot, 'supabase', 'migrations');
const linkedProjectFile = join(mobileRoot, 'supabase', '.temp', 'project-ref');
const supabaseCli = join(mobileRoot, 'node_modules', 'supabase', 'dist', 'supabase.js');

function fail(message) {
  throw new Error(`Supabase 部署前置检查失败：${message}`);
}

export function listLocalMigrations(directory) {
  const sqlFiles = readdirSync(directory).filter((name) => name.endsWith('.sql'));
  const invalid = sqlFiles.filter((name) => !/^\d{12}_[a-z0-9_]+\.sql$/.test(name));
  if (invalid.length > 0) fail(`迁移文件命名不合法：${invalid.join(', ')}`);

  const migrations = sqlFiles
    .map((name) => ({ name, version: name.slice(0, 12) }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const versions = migrations.map(({ version }) => version);
  const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);
  if (duplicates.length > 0) fail(`存在重复迁移版本：${[...new Set(duplicates)].join(', ')}`);
  if (migrations.length === 0) fail('没有找到迁移文件');
  return migrations;
}

function cleanMigrationCell(value) {
  return value.replaceAll('`', '').trim();
}

export function parseMigrationList(output) {
  const rows = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.includes('|')) continue;
    const [localCell = '', remoteCell = ''] = line.split('|');
    const local = cleanMigrationCell(localCell);
    const remote = cleanMigrationCell(remoteCell);
    if (!/^\d{12}$/.test(local) && !/^\d{12}$/.test(remote)) continue;
    rows.push({
      local: /^\d{12}$/.test(local) ? local : null,
      remote: /^\d{12}$/.test(remote) ? remote : null,
    });
  }
  if (rows.length === 0) fail('无法解析 Supabase CLI 返回的迁移历史');
  return rows;
}

export function assertMigrationHistory(
  localMigrations,
  rows,
  requiredRemoteBaseline = REQUIRED_REMOTE_BASELINE,
) {
  const localVersions = localMigrations.map(({ version }) => version);
  const listedLocal = rows.flatMap(({ local }) => (local ? [local] : []));
  const remoteVersions = rows.flatMap(({ remote }) => (remote ? [remote] : []));

  if (listedLocal.join(',') !== localVersions.join(',')) {
    fail('CLI 列出的本地迁移与仓库文件不一致');
  }
  if (new Set(remoteVersions).size !== remoteVersions.length) {
    fail('远端迁移历史包含重复版本');
  }
  const unknownRemote = remoteVersions.filter((version) => !localVersions.includes(version));
  if (unknownRemote.length > 0) fail(`远端存在未知版本：${unknownRemote.join(', ')}`);

  const expectedRemotePrefix = localVersions.slice(0, remoteVersions.length);
  if (remoteVersions.join(',') !== expectedRemotePrefix.join(',')) {
    fail('本地与远端迁移历史存在顺序分叉或中间缺口');
  }
  const missingBaseline = requiredRemoteBaseline.filter((version) => !remoteVersions.includes(version));
  if (missingBaseline.length > 0) {
    fail(`远端缺少必须已登记的历史版本：${missingBaseline.join(', ')}`);
  }

  return localVersions.slice(remoteVersions.length);
}

export function assertProjectRef(linkedRef, publicUrl) {
  if (linkedRef.trim() !== EXPECTED_PROJECT_REF) {
    fail(`链接项目不是允许的项目 ${EXPECTED_PROJECT_REF}`);
  }
  if (!publicUrl) fail('.env 缺少 EXPO_PUBLIC_SUPABASE_URL');

  let configuredRef;
  try {
    configuredRef = new URL(publicUrl).hostname.split('.')[0];
  } catch {
    fail('EXPO_PUBLIC_SUPABASE_URL 不是有效 URL');
  }
  if (configuredRef !== EXPECTED_PROJECT_REF) {
    fail(`客户端配置指向 ${configuredRef || '未知项目'}，与允许项目不一致`);
  }
}

function readPublicUrl() {
  const content = readFileSync(join(mobileRoot, '.env'), 'utf8');
  const match = content.match(/^EXPO_PUBLIC_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
  return match?.[1]?.trim() ?? null;
}

function runSupabase(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [supabaseCli, ...args], {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
  });
  if (result.error) fail(`无法启动 Supabase CLI：${result.error.message}`);
  if (result.status !== 0) fail(`Supabase CLI 命令失败：${args.slice(0, 2).join(' ')}`);
  return result;
}

function readRemoteHistory(localMigrations) {
  const result = runSupabase(['migration', 'list', '--linked', '--output', 'pretty'], {
    capture: true,
  });
  const rows = parseMigrationList(`${result.stdout}\n${result.stderr}`);
  return assertMigrationHistory(localMigrations, rows);
}

function parseJsonArray(output, label) {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start < 0 || end < start) fail(`无法解析${label}`);
  try {
    return JSON.parse(output.slice(start, end + 1));
  } catch {
    fail(`无法解析${label}`);
  }
}

export function runDeployment({ checkOnly = false } = {}) {
  const linkedRef = readFileSync(linkedProjectFile, 'utf8');
  assertProjectRef(linkedRef, readPublicUrl());
  const localMigrations = listLocalMigrations(migrationDirectory);
  const pending = readRemoteHistory(localMigrations);

  console.log(`目标项目已锁定：${EXPECTED_PROJECT_REF}`);
  console.log(pending.length > 0 ? `待部署迁移：${pending.join(', ')}` : '迁移历史已完全对齐');
  if (checkOnly) return { pending };

  runSupabase(['db', 'push', '--linked', '--yes', '--output-format', 'text', '--agent', 'no']);
  const remaining = readRemoteHistory(localMigrations);
  if (remaining.length > 0) fail(`数据库部署后仍有待执行迁移：${remaining.join(', ')}`);

  runSupabase([
    'functions',
    'deploy',
    'delete-account',
    '--project-ref',
    EXPECTED_PROJECT_REF,
    '--use-api',
    '--output-format',
    'text',
    '--agent',
    'no',
  ]);
  const functionResult = runSupabase(
    ['functions', 'list', '--project-ref', EXPECTED_PROJECT_REF, '--output', 'json'],
    { capture: true },
  );
  const functions = parseJsonArray(functionResult.stdout, '函数列表');
  const accountFunction = functions.find(({ slug }) => slug === 'delete-account');
  if (!accountFunction || accountFunction.status !== 'ACTIVE' || accountFunction.verify_jwt !== true) {
    fail('delete-account 未处于 ACTIVE 且 verify_jwt=true 的安全状态');
  }
  console.log('Supabase 迁移和 delete-account 已完成受保护部署');
  return { pending };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const allowedArguments = new Set(['--check']);
  const unknownArguments = process.argv.slice(2).filter((argument) => !allowedArguments.has(argument));
  if (unknownArguments.length > 0) fail(`未知参数：${unknownArguments.join(', ')}`);
  runDeployment({ checkOnly: process.argv.includes('--check') });
}
