import {
	AssistantMessageContent,
	TextContent,
	ToolUse,
	ToolUseName,
	toolUseNames,
} from "./index.js"
import { DOMParser } from 'xmldom';

/**
 * アシスタントからのメッセージ文字列を解析し、テキストコンテンツやツール利用指示などのブロックに分割します。
 * ツール利用指示（<toolname>...</toolname>）と、そのパラメータ（<param>...</param>）を検出し、
 * テキスト部分は「text」ブロック、ツール利用は「tool_use」ブロックとして保持します。
 *
 * @param assistantMessage - アシスタントからのメッセージ文字列
 * @returns 分割後のコンテンツブロック配列
 */
export const parseAssistantMessage = (input: string): AssistantMessageContent[] => {
  const result: AssistantMessageContent[] = [];
  const xmlTagPattern = /<(\w+)>[\s\S]*?<\/\1>/g;
  let lastIndex = 0;

  let match;
  while ((match = xmlTagPattern.exec(input)) !== null) {
    // XMLタグの前のテキスト部分を取得
    if (match.index > lastIndex) {
      const textPart = input.slice(lastIndex, match.index).trim();
      if (textPart) {
        const textContent: TextContent = { type: 'text', content: textPart };
        result.push(textContent);
      }
    }

    // XMLタグ部分を処理
    const xmlContent = match[0];
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
    const rootNode = xmlDoc.documentElement;

    if (rootNode) {
      const params: Partial<Record<string, string>> = {};
      for (let i = 0; i < rootNode.childNodes.length; i++) {
        const node = rootNode.childNodes[i];
        if (node.nodeType === 1) { // ELEMENT_NODE
          params[node.nodeName] = node.textContent?.trim() || '';
        }
      }

      const toolName = rootNode.nodeName as ToolUseName
      if (toolUseNames.includes(toolName)) {
        const toolUse: ToolUse = {
          type: 'tool_use',
          name: toolName,
          params,
        };
        result.push(toolUse);
      } else {
        // 未知のタグの場合はテキストとして扱う
        const textContent: TextContent = { type: 'text', content: xmlContent };
        result.push(textContent);
      }
    }

    lastIndex = xmlTagPattern.lastIndex;
  }

  // 最後のXMLタグ以降のテキスト部分を取得
  if (lastIndex < input.length) {
    const textPart = input.slice(lastIndex).trim();
    if (textPart) {
      const textContent: TextContent = { type: 'text', content: textPart };
      result.push(textContent);
    }
  }

  return result;
}
