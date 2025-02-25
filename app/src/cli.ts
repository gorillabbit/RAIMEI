#!/usr/bin/env node
import { LabelManager } from './labelManager';

/**
 * イシューのラベルを手動で更新するためのCLIツール
 * 
 * 使用方法:
 * node cli.js <issue_url> <action>
 * 
 * 例:
 * node cli.js https://github.com/user/repo/issues/1 "イシュー記載完了"
 */

const updateLabel = async (issueUrl: string, action: string) => {
  try {
    console.log(`イシュー ${issueUrl} のラベルを更新します...`);
    console.log(`アクション: ${action}`);
    
    const labelManager = new LabelManager();
    await labelManager.loadLabels();
    
    const success = await labelManager.transitionLabel(issueUrl, action);
    
    if (success) {
      console.log('✅ ラベルが正常に更新されました');
    } else {
      console.error('❌ ラベルの更新に失敗しました');
      process.exit(1);
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
};

// コマンドライン引数を解析
const [,, issueUrl, action] = process.argv;

if (!issueUrl || !action) {
  console.error('使用方法: node cli.js <issue_url> <action>');
  console.error('例: node cli.js https://github.com/user/repo/issues/1 "イシュー記載完了"');
  process.exit(1);
}

// ラベル更新を実行
updateLabel(issueUrl, action).catch(error => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
});
