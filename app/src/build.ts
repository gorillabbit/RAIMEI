#!/usr/bin/env node
/**
 * ビルドスクリプト
 * 
 * このスクリプトは以下の処理を行います:
 * 1. TypeScriptファイルをコンパイル
 * 2. 必要なファイルをdistディレクトリにコピー
 * 3. 実行可能なCLIスクリプトを作成
 */

import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BUILD_DIR = path.join(process.cwd(), 'dist');
const SRC_DIR = path.join(process.cwd(), 'src');
const CLI_SCRIPT = path.join(BUILD_DIR, 'cli.js');

/**
 * ディレクトリが存在しない場合は作成する
 * @param dir ディレクトリパス
 */
const ensureDirectoryExists = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * TypeScriptファイルをコンパイルする
 */
const compileTypeScript = async () => {
  console.log('TypeScriptファイルをコンパイルしています...');
  try {
    const { stdout, stderr } = await execAsync('npx tsc');
    if (stderr) {
      console.error('コンパイル中にエラーが発生しました:', stderr);
    } else {
      console.log('コンパイルが完了しました');
    }
  } catch (error) {
    console.error('コンパイルに失敗しました:', error);
    process.exit(1);
  }
};

/**
 * CLIスクリプトを実行可能にする
 */
const makeCliExecutable = async () => {
  if (fs.existsSync(CLI_SCRIPT)) {
    console.log('CLIスクリプトを実行可能にしています...');
    try {
      // スクリプトの先頭に#!/usr/bin/env nodeを追加
      let content = fs.readFileSync(CLI_SCRIPT, 'utf8');
      if (!content.startsWith('#!/usr/bin/env node')) {
        content = '#!/usr/bin/env node\n' + content;
        fs.writeFileSync(CLI_SCRIPT, content);
      }
      
      // 実行権限を付与
      await execAsync(`chmod +x ${CLI_SCRIPT}`);
      console.log('CLIスクリプトを実行可能にしました');
    } catch (error) {
      console.error('CLIスクリプトの権限設定に失敗しました:', error);
    }
  } else {
    console.warn('CLIスクリプトが見つかりません:', CLI_SCRIPT);
  }
};

/**
 * ビルドプロセスを実行
 */
const build = async () => {
  console.log('ビルドを開始します...');
  
  // ビルドディレクトリを作成
  ensureDirectoryExists(BUILD_DIR);
  
  // TypeScriptファイルをコンパイル
  await compileTypeScript();
  
  // CLIスクリプトを実行可能にする
  await makeCliExecutable();
  
  console.log('ビルドが完了しました');
};

// ビルドを実行
build().catch(error => {
  console.error('ビルド中にエラーが発生しました:', error);
  process.exit(1);
});
