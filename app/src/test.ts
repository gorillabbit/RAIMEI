#!/usr/bin/env node
/**
 * RAIMEI タスク管理システムのテストスクリプト
 * 
 * 使用方法:
 * ts-node src/test.ts
 */

import { LabelManager } from './labelManager';
import { TaskManager } from './taskManager';
import * as dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config();

/**
 * ラベル管理機能をテストする
 */
const testLabelManager = async () => {
  try {
    console.log('ラベル管理機能のテストを開始します...');
    
    // LabelManagerのインスタンスを作成
    const labelManager = new LabelManager();
    
    // ラベル定義を読み込む
    console.log('ラベル定義を読み込んでいます...');
    await labelManager.loadLabels();
    
    // 遷移テスト
    console.log('\n--- ラベル遷移テスト ---');
    
    // 現在のラベルから次のラベルへの遷移をテスト
    const testTransitions = [
      { current: '未着手 (Open)', action: '割り当て', expected: '作業中 (In Progress)' },
      { current: '作業中 (In Progress)', action: 'イシュー記載', expected: 'RAIMEI イシュー記載中' },
      { current: 'RAIMEI イシュー記載中', action: 'イシュー記載完了', expected: 'RAIMEI イシューレビュー待ち' },
      { current: 'RAIMEI イシューレビュー待ち', action: 'イシューレビュー完了', expected: 'RAIMEI 実装中' },
      { current: 'RAIMEI 実装中', action: 'PR作成', expected: 'RAIMEI PRレビュー待ち' },
      { current: 'RAIMEI PRレビュー待ち', action: 'PRレビュー完了', expected: '人間 PRレビュー待ち' },
      { current: '人間 PRレビュー待ち', action: 'マージ', expected: '完了 (Closed)' },
    ];
    
    for (const test of testTransitions) {
      const nextLabel = labelManager.getNextLabel(test.current, test.action);
      const result = nextLabel === test.expected ? '✅ 成功' : `❌ 失敗 (期待値: ${test.expected}, 実際: ${nextLabel})`;
      console.log(`${test.current} + "${test.action}" => ${nextLabel} ... ${result}`);
    }
    
    console.log('\nラベル管理機能のテストが完了しました');
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
};

/**
 * タスク管理機能をテストする
 */
const testTaskManager = async () => {
  try {
    console.log('\nタスク管理機能のテストを開始します...');
    
    // TaskManagerのインスタンスを作成
    const taskManager = new TaskManager();
    
    // 初期化
    console.log('タスクマネージャーを初期化しています...');
    await taskManager.initialize();
    
    // 各メソッドのモック実装をテスト
    console.log('\n--- タスクマネージャーメソッドテスト ---');
    
    // extractIssueNumber メソッドのテスト
    const testIssueUrl = 'https://github.com/user/repo/issues/123';
    const issueNumber = (taskManager as any).extractIssueNumber(testIssueUrl);
    console.log(`extractIssueNumber('${testIssueUrl}') => ${issueNumber} ... ${issueNumber === '123' ? '✅ 成功' : '❌ 失敗'}`);
    
    // extractRepoInfo メソッドのテスト
    const repoInfo = (taskManager as any).extractRepoInfo(testIssueUrl);
    console.log(`extractRepoInfo('${testIssueUrl}') => ${JSON.stringify(repoInfo)} ... ${repoInfo?.owner === 'user' && repoInfo?.repo === 'repo' ? '✅ 成功' : '❌ 失敗'}`);
    
    console.log('\nタスク管理機能のテストが完了しました');
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
};

// テストを実行
const runTests = async () => {
  await testLabelManager();
  await testTaskManager();
  console.log('\n全てのテストが完了しました');
};

runTests().catch(console.error);
