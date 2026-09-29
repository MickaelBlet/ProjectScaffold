// Webview page: the single-file web build (media/index.html) with a webview Content Security
// Policy and the document inlined before the app scripts run.
import { randomBytes } from 'node:crypto'
import * as vscode from 'vscode'
import type { WebviewInit } from './protocol'

let template: string | undefined

async function readTemplate(media: vscode.Uri): Promise<string> {
  template ??= new TextDecoder().decode(
    await vscode.workspace.fs.readFile(vscode.Uri.joinPath(media, 'index.html'))
  )
  return template
}

export async function webviewHtml(
  media: vscode.Uri,
  webview: vscode.Webview,
  init: WebviewInit
): Promise<string> {
  const nonce = randomBytes(16).toString('base64')
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `img-src ${webview.cspSource} data: blob:`,
    `font-src ${webview.cspSource} data:`
  ].join('; ')
  // '<' escaped: the text may contain '</script>'.
  const data = JSON.stringify(init).replace(/</g, '\\u003c')
  const html = await readTemplate(media)
  return html
    .replace(
      /<meta\s+http-equiv="Content-Security-Policy"[^>]*>/,
      () => `<meta http-equiv="Content-Security-Policy" content="${csp}" />`
    )
    .replace('<script type="module">', () => `<script type="module" nonce="${nonce}">`)
    .replace('<head>', () => `<head>\n<script nonce="${nonce}">window.scaffoldInit = ${data}</script>`)
}
