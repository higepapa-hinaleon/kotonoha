class i {
  constructor(e) {
    this.baseUrl = e.baseUrl.replace(/\/+$/, ""), this.authToken = e.authToken, this.userName = e.userName, this.userId = e.userId;
  }
  /** 認証トークンを更新する */
  setAuthToken(e) {
    this.authToken = e;
  }
  /** ユーザー情報を更新する */
  setUserInfo(e) {
    this.userName = e.userName, this.userId = e.userId;
  }
  /** 利用可能なサービス一覧を取得する */
  async getServices(e) {
    const t = new URLSearchParams();
    e != null && e.groupId && t.set("groupId", e.groupId);
    const o = t.toString();
    return (await this.fetch(
      `/api/services${o ? `?${o}` : ""}`
    )).filter((s) => s.isActive);
  }
  /** チャットメッセージを送信する */
  async sendMessage(e) {
    return this.fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: e.serviceId,
        message: e.message,
        conversationId: e.conversationId
      })
    });
  }
  /** フォーム URL を取得する */
  async getFormUrl(e) {
    return (await this.fetch(
      `/api/settings/form-url?serviceId=${encodeURIComponent(e)}`
    )).formUrl || "";
  }
  async fetch(e, t) {
    const o = {
      ...t == null ? void 0 : t.headers
    };
    this.authToken && (o.Authorization = `Bearer ${this.authToken}`), this.userName && (o["X-kotonoha-User-Name"] = this.sanitizeHeaderValue(this.userName)), this.userId && (o["X-kotonoha-User-Id"] = this.sanitizeHeaderValue(this.userId));
    const s = await fetch(`${this.baseUrl}${e}`, {
      ...t,
      headers: o
    });
    if (!s.ok) {
      const r = await s.text().catch(() => "");
      throw new Error(
        `kotonohaChatClient: ${s.status} ${s.statusText} - ${r}`
      );
    }
    return s.json();
  }
  /** ヘッダー値のサニタイズ（CRLF除去・長さ制限） */
  sanitizeHeaderValue(e) {
    return e.replace(/[\r\n\0<>]/g, "").slice(0, 200);
  }
}
const d = (
  /* css */
  `
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
  }

  .kotonoha-bubble--assistant a {
    color: var(--kotonoha-primary);
    text-decoration: underline;
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
`
);
class h extends HTMLElement {
  constructor() {
    super(), this.client = null, this.messages = [], this.sending = !1, this.errorMessage = "", this.shadow = this.attachShadow({ mode: "open" });
  }
  static get observedAttributes() {
    return ["api-base-url", "service-id", "auth-token", "placeholder", "user-name", "user-id"];
  }
  connectedCallback() {
    this.render(), this.bindElements(), this.bindEvents(), this.initClient();
  }
  attributeChangedCallback(e, t, o) {
    t !== o && this.messagesEl && ((e === "api-base-url" || e === "auth-token" || e === "user-name" || e === "user-id") && this.initClient(), e === "service-id" && (this.messages = [], this.conversationId = void 0, this.renderMessages()), e === "placeholder" && this.inputEl && (this.inputEl.placeholder = o || "質問を入力..."));
  }
  get apiBaseUrl() {
    return this.getAttribute("api-base-url") || "";
  }
  get serviceId() {
    return this.getAttribute("service-id") || "";
  }
  get authToken() {
    return this.getAttribute("auth-token") || "";
  }
  get placeholderText() {
    return this.getAttribute("placeholder") || "質問を入力...";
  }
  get userName() {
    return this.getAttribute("user-name") || "";
  }
  get externalUserId() {
    return this.getAttribute("user-id") || "";
  }
  initClient() {
    this.apiBaseUrl && (this.client = new i({
      baseUrl: this.apiBaseUrl,
      authToken: this.authToken || void 0,
      userName: this.userName || void 0,
      userId: this.externalUserId || void 0
    }));
  }
  render() {
    this.shadow.innerHTML = `
      <style>${d}</style>
      <div class="kotonoha-chat-container">
        <div class="kotonoha-messages" data-ref="messages">
          <div class="kotonoha-messages-empty">質問を入力してください</div>
        </div>
        <div class="kotonoha-error" data-ref="error" style="display:none"></div>
        <div class="kotonoha-input-area">
          <textarea
            class="kotonoha-input"
            data-ref="input"
            rows="1"
            placeholder="${this.escapeHtml(this.placeholderText)}"
          ></textarea>
          <button class="kotonoha-send-btn" data-ref="send" aria-label="送信">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    `;
  }
  bindElements() {
    this.messagesEl = this.shadow.querySelector('[data-ref="messages"]'), this.inputEl = this.shadow.querySelector('[data-ref="input"]'), this.sendBtn = this.shadow.querySelector('[data-ref="send"]');
  }
  bindEvents() {
    this.sendBtn.addEventListener("click", () => this.handleSend()), this.inputEl.addEventListener("keydown", (e) => {
      e.key === "Enter" && !e.shiftKey && (e.preventDefault(), this.handleSend());
    });
  }
  async handleSend() {
    const e = this.inputEl.value.trim();
    if (!(!e || this.sending || !this.client || !this.serviceId)) {
      this.messages.push({ role: "user", content: e }), this.inputEl.value = "", this.errorMessage = "", this.sending = !0, this.updateInputState(), this.renderMessages();
      try {
        const t = await this.client.sendMessage({
          serviceId: this.serviceId,
          message: e,
          conversationId: this.conversationId
        });
        this.conversationId = t.conversationId, this.messages.push({
          role: "assistant",
          content: t.message.content,
          sources: t.message.sources,
          confidence: t.message.confidence,
          formUrl: t.formUrl
        });
      } catch {
        this.messages.push({
          role: "assistant",
          content: "申し訳ございません。エラーが発生しました。しばらく経ってからもう一度お試しください。"
        });
      } finally {
        this.sending = !1, this.updateInputState(), this.renderMessages();
      }
    }
  }
  renderMessages() {
    if (this.messages.length === 0) {
      this.messagesEl.innerHTML = '<div class="kotonoha-messages-empty">質問を入力してください</div>';
      return;
    }
    let e = "";
    for (const t of this.messages)
      e += this.renderMessage(t);
    this.sending && (e += `
        <div class="kotonoha-loading">
          <div class="kotonoha-loading-bubble">
            <div class="kotonoha-spinner"></div>
            回答を生成中...
          </div>
        </div>
      `), this.messagesEl.innerHTML = e, this.messagesEl.scrollTop = this.messagesEl.scrollHeight, this.messagesEl.querySelectorAll(".kotonoha-sources-toggle").forEach((t) => {
      t.addEventListener("click", () => {
        const o = t.nextElementSibling;
        o && (o.style.display = o.style.display === "none" ? "block" : "none");
      });
    });
  }
  renderMessage(e) {
    const t = `kotonoha-message--${e.role}`, o = `kotonoha-bubble--${e.role}`;
    let s;
    e.role === "assistant" ? s = this.renderMarkdown(e.content) : s = `<div style="white-space:pre-wrap">${this.escapeHtml(e.content)}</div>`;
    let r = "";
    return e.role === "assistant" && e.sources && e.sources.length > 0 && (r += this.renderSources(e.sources)), e.role === "assistant" && e.formUrl && (r += `
        <div class="kotonoha-form-guide">
          <p>より詳しいサポートが必要な場合：
            <a href="${this.escapeHtml(e.formUrl)}" target="_blank" rel="noopener noreferrer">お問い合わせフォーム</a>
          </p>
        </div>
      `), `
      <div class="kotonoha-message ${t}">
        <div class="kotonoha-bubble ${o}">
          ${s}
          ${r}
        </div>
      </div>
    `;
  }
  renderSources(e) {
    const t = e.map(
      (o) => `
      <div class="kotonoha-source-item">
        <div class="kotonoha-source-title">${this.escapeHtml(o.documentTitle)}</div>
        <div class="kotonoha-source-content">${this.escapeHtml(o.chunkContent)}...</div>
        <div class="kotonoha-source-similarity">類似度: ${(o.similarity * 100).toFixed(0)}%</div>
      </div>
    `
    ).join("");
    return `
      <button class="kotonoha-sources-toggle">参照元 (${e.length}件) ▼</button>
      <div class="kotonoha-sources-list" style="display:none">
        ${t}
      </div>
    `;
  }
  /** 簡易 Markdown → HTML 変換（軽量、外部依存なし） */
  renderMarkdown(e) {
    let t = this.escapeHtml(e);
    return t = t.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      "<pre><code>$2</code></pre>"
    ), t = t.replace(/`([^`]+)`/g, "<code>$1</code>"), t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"), t = t.replace(/\*(.+?)\*/g, "<em>$1</em>"), t = t.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (o, s, r) => {
        const a = r.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
        return /^https?:\/\//i.test(a) ? `<a href="${a.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">${s}</a>` : s;
      }
    ), t = t.replace(
      /(?:<pre>[\s\S]*?<\/pre>)|(\n)/g,
      (o, s) => s ? "<br>" : o
    ), t;
  }
  escapeHtml(e) {
    const t = document.createElement("div");
    return t.textContent = e, t.innerHTML;
  }
  updateInputState() {
    this.inputEl.disabled = this.sending, this.sendBtn.disabled = this.sending;
  }
  // --- Public API ---
  /** 会話をリセットする */
  resetConversation() {
    this.messages = [], this.conversationId = void 0, this.renderMessages();
  }
  /** プログラムからメッセージを送信する */
  async send(e) {
    this.inputEl.value = e, await this.handleSend();
  }
}
customElements.get("kotonoha-chat-widget") || customElements.define("kotonoha-chat-widget", h);
export {
  h as kotonohaChatWidget
};
