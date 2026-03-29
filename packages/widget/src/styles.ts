/**
 * ウィジェットの埋め込みCSS
 * CSS Custom Properties で外部からテーマ調整が可能
 */
export const widgetStyles = /* css */ `
  :host {
    --kotonoha-primary: #2563eb;
    --kotonoha-primary-hover: #1d4ed8;
    --kotonoha-bg: #ffffff;
    --kotonoha-bg-secondary: #f9fafb;
    --kotonoha-border: #e5e7eb;
    --kotonoha-text: #111827;
    --kotonoha-text-secondary: #6b7280;
    --kotonoha-text-on-primary: #ffffff;
    --kotonoha-radius: 0.5rem;
    --kotonoha-font: system-ui, -apple-system, sans-serif;
    --kotonoha-font-size: 14px;

    display: block;
    font-family: var(--kotonoha-font);
    font-size: var(--kotonoha-font-size);
    color: var(--kotonoha-text);
    line-height: 1.5;
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .kotonoha-chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 300px;
    border: 1px solid var(--kotonoha-border);
    border-radius: var(--kotonoha-radius);
    overflow: hidden;
    background: var(--kotonoha-bg);
  }

  /* メッセージエリア */
  .kotonoha-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .kotonoha-messages-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--kotonoha-text-secondary);
    font-size: 0.875rem;
  }

  .kotonoha-message {
    display: flex;
    margin-bottom: 0.75rem;
  }

  .kotonoha-message--user {
    justify-content: flex-end;
  }

  .kotonoha-message--assistant {
    justify-content: flex-start;
  }

  .kotonoha-bubble {
    max-width: 80%;
    padding: 0.75rem 1rem;
    border-radius: var(--kotonoha-radius);
    word-break: break-word;
  }

  .kotonoha-bubble--user {
    background: var(--kotonoha-primary);
    color: var(--kotonoha-text-on-primary);
  }

  .kotonoha-bubble--assistant {
    background: var(--kotonoha-bg);
    border: 1px solid var(--kotonoha-border);
    color: var(--kotonoha-text);
  }

  .kotonoha-bubble--assistant p {
    margin: 0.25em 0;
  }

  .kotonoha-bubble--assistant p:first-child {
    margin-top: 0;
  }

  .kotonoha-bubble--assistant p:last-child {
    margin-bottom: 0;
  }

  .kotonoha-bubble--assistant pre {
    background: var(--kotonoha-bg-secondary);
    padding: 0.5rem;
    border-radius: 0.25rem;
    overflow-x: auto;
    font-size: 0.8125rem;
  }

  .kotonoha-bubble--assistant code {
    font-size: 0.8125rem;
    background: var(--kotonoha-bg-secondary);
    padding: 0.125em 0.25em;
    border-radius: 0.2em;
  }

  .kotonoha-bubble--assistant pre code {
    background: none;
    padding: 0;
    border-radius: 0;
  }

  .kotonoha-bubble--assistant a {
    color: var(--kotonoha-primary);
    text-decoration: underline;
  }

  .kotonoha-bubble--assistant h3 {
    font-size: 1.1em;
    font-weight: 700;
    margin: 0.6em 0 0.3em;
  }

  .kotonoha-bubble--assistant h4 {
    font-size: 1em;
    font-weight: 700;
    margin: 0.5em 0 0.25em;
  }

  .kotonoha-bubble--assistant h5 {
    font-size: 0.95em;
    font-weight: 600;
    margin: 0.4em 0 0.2em;
  }

  .kotonoha-bubble--assistant h3:first-child,
  .kotonoha-bubble--assistant h4:first-child,
  .kotonoha-bubble--assistant h5:first-child {
    margin-top: 0;
  }

  .kotonoha-bubble--assistant ul,
  .kotonoha-bubble--assistant ol {
    margin: 0.4em 0;
    padding-left: 1.5em;
  }

  .kotonoha-bubble--assistant li {
    margin: 0.15em 0;
  }

  .kotonoha-bubble--assistant blockquote {
    border-left: 3px solid var(--kotonoha-border);
    padding-left: 0.75em;
    margin: 0.4em 0;
    color: var(--kotonoha-text-secondary);
  }

  .kotonoha-bubble--assistant hr {
    border: none;
    border-top: 1px solid var(--kotonoha-border);
    margin: 0.5em 0;
  }

  .kotonoha-bubble--assistant del {
    text-decoration: line-through;
    opacity: 0.7;
  }

  /* ソース表示 */
  .kotonoha-sources-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.5rem;
    padding: 0;
    border: none;
    background: none;
    color: var(--kotonoha-text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
  }

  .kotonoha-sources-toggle:hover {
    color: var(--kotonoha-text);
  }

  .kotonoha-sources-list {
    margin-top: 0.5rem;
  }

  .kotonoha-source-item {
    background: var(--kotonoha-bg-secondary);
    border-radius: 0.25rem;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.375rem;
    font-size: 0.75rem;
  }

  .kotonoha-source-title {
    font-weight: 600;
    color: var(--kotonoha-text);
  }

  .kotonoha-source-content {
    color: var(--kotonoha-text-secondary);
    margin-top: 0.125rem;
  }

  .kotonoha-source-similarity {
    color: var(--kotonoha-text-secondary);
    margin-top: 0.125rem;
    opacity: 0.7;
  }

  /* フォーム案内 */
  .kotonoha-form-guide {
    margin-top: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #fffbeb;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: #92400e;
  }

  .kotonoha-form-guide a {
    color: #b45309;
    font-weight: 500;
    text-decoration: underline;
  }

  /* 読み込み中インジケーター */
  .kotonoha-loading {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 0.75rem;
  }

  .kotonoha-loading-bubble {
    background: var(--kotonoha-bg);
    border: 1px solid var(--kotonoha-border);
    border-radius: var(--kotonoha-radius);
    padding: 0.75rem 1rem;
    color: var(--kotonoha-text-secondary);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  @keyframes kotonoha-spin {
    to { transform: rotate(360deg); }
  }

  .kotonoha-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--kotonoha-border);
    border-top-color: var(--kotonoha-primary);
    border-radius: 50%;
    animation: kotonoha-spin 0.6s linear infinite;
  }

  /* 入力エリア */
  .kotonoha-input-area {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--kotonoha-border);
    background: var(--kotonoha-bg);
  }

  .kotonoha-input {
    flex: 1;
    resize: none;
    border: 1px solid var(--kotonoha-border);
    border-radius: var(--kotonoha-radius);
    padding: 0.625rem 0.75rem;
    font-family: var(--kotonoha-font);
    font-size: var(--kotonoha-font-size);
    color: var(--kotonoha-text);
    outline: none;
    line-height: 1.4;
  }

  .kotonoha-input:focus {
    border-color: var(--kotonoha-primary);
    box-shadow: 0 0 0 1px var(--kotonoha-primary);
  }

  .kotonoha-input:disabled {
    opacity: 0.5;
  }

  .kotonoha-send-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border: none;
    border-radius: var(--kotonoha-radius);
    background: var(--kotonoha-primary);
    color: var(--kotonoha-text-on-primary);
    cursor: pointer;
  }

  .kotonoha-send-btn:hover:not(:disabled) {
    background: var(--kotonoha-primary-hover);
  }

  .kotonoha-send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .kotonoha-send-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  /* エラー */
  .kotonoha-error {
    padding: 0.75rem 1rem;
    background: #fef2f2;
    color: #991b1b;
    font-size: 0.8125rem;
    text-align: center;
  }
`;
