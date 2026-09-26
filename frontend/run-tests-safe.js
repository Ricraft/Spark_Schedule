#!/usr/bin/env node

/**
 * 安全测试运行器 - 防止无限循环
 * 
 * 这个脚本会：
 * 1. 设置严格的超时限制
 * 2. 监控测试进程
 * 3. 如果测试运行超过指定时间，强制终止
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置
const MAX_TEST_TIME = 5 * 60 * 1000; // 5分钟最大测试时间
const TEST_TIMEOUT = 30000; // 30秒单个测试超时

console.log('🚀 启动安全测试运行器...');
console.log(`⏱️  最大测试时间: ${MAX_TEST_TIME / 1000}秒`);
console.log(`⏱️  单个测试超时: ${TEST_TIMEOUT / 1000}秒\n`);

// 启动Jest进程
const jestProcess = spawn('npx', [
  'jest',
  '--testTimeout=' + TEST_TIMEOUT,
  '--maxWorkers=1',
  '--forceExit',
  '--detectOpenHandles',
  '--verbose'
], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// 设置全局超时
const globalTimeout = setTimeout(() => {
  console.error('\n❌ 测试运行时间超过限制，强制终止...');
  jestProcess.kill('SIGKILL');
  process.exit(1);
}, MAX_TEST_TIME);

// 监听进程退出
jestProcess.on('exit', (code) => {
  clearTimeout(globalTimeout);
  console.log(`\n✅ 测试完成，退出码: ${code}`);
  process.exit(code || 0);
});

// 监听错误
jestProcess.on('error', (error) => {
  clearTimeout(globalTimeout);
  console.error('\n❌ 测试进程错误:', error);
  process.exit(1);
});

// 处理中断信号
process.on('SIGINT', () => {
  console.log('\n⚠️  收到中断信号，终止测试...');
  clearTimeout(globalTimeout);
  jestProcess.kill('SIGTERM');
  setTimeout(() => {
    jestProcess.kill('SIGKILL');
    process.exit(130);
  }, 2000);
});
