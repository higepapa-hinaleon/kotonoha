class v {
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
    const o = new URLSearchParams();
    e != null && e.groupId && o.set("groupId", e.groupId);
    const s = o.toString();
    return (await this.fetch(`/api/services${s ? `?${s}` : ""}`)).filter((r) => r.isActive);
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
  async fetch(e, o) {
    const s = {
      ...o == null ? void 0 : o.headers
    };
    this.authToken && (s.Authorization = `Bearer ${this.authToken}`), this.userName && (s["X-kotonoha-User-Name"] = this.sanitizeHeaderValue(this.userName)), this.userId && (s["X-kotonoha-User-Id"] = this.sanitizeHeaderValue(this.userId));
    const r = await fetch(`${this.baseUrl}${e}`, {
      ...o,
      headers: s
    });
    if (!r.ok) {
      const d = await r.text().catch(() => "");
      throw new Error(`kotonohaChatClient: ${r.status} ${r.statusText} - ${d}`);
    }
    return r.json();
  }
  /** ヘッダー値のサニタイズ（CRLF除去・長さ制限） */
  sanitizeHeaderValue(e) {
    return e.replace(/[\r\n\0<>]/g, "").slice(0, 200);
  }
}
const y = (
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
`
);
class x extends HTMLElement {
  constructor() {
    super(), this.client = null, this.messages = [], this.sending = !1, this.errorMessage = "", this.shadow = this.attachShadow({ mode: "open" });
  }
  static get observedAttributes() {
    return ["api-base-url", "service-id", "auth-token", "placeholder", "user-name", "user-id"];
  }
  connectedCallback() {
    this.render(), this.bindElements(), this.bindEvents(), this.initClient();
  }
  attributeChangedCallback(e, o, s) {
    o !== s && this.messagesEl && ((e === "api-base-url" || e === "auth-token" || e === "user-name" || e === "user-id") && this.initClient(), e === "service-id" && (this.messages = [], this.conversationId = void 0, this.renderMessages()), e === "placeholder" && this.inputEl && (this.inputEl.placeholder = s || "質問を入力..."));
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
    this.apiBaseUrl && (this.client = new v({
      baseUrl: this.apiBaseUrl,
      authToken: this.authToken || void 0,
      userName: this.userName || void 0,
      userId: this.externalUserId || void 0
    }));
  }
  render() {
    this.shadow.innerHTML = `
      <style>${y}</style>
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
        const o = await this.client.sendMessage({
          serviceId: this.serviceId,
          message: e,
          conversationId: this.conversationId
        });
        this.conversationId = o.conversationId, this.messages.push({
          role: "assistant",
          content: o.message.content,
          sources: o.message.sources,
          confidence: o.message.confidence,
          formUrl: o.formUrl
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
    for (const o of this.messages)
      e += this.renderMessage(o);
    this.sending && (e += `
        <div class="kotonoha-loading">
          <div class="kotonoha-loading-bubble">
            <div class="kotonoha-spinner"></div>
            回答を生成中...
          </div>
        </div>
      `), this.messagesEl.innerHTML = e, this.messagesEl.scrollTop = this.messagesEl.scrollHeight, this.messagesEl.querySelectorAll(".kotonoha-sources-toggle").forEach((o) => {
      o.addEventListener("click", () => {
        const s = o.nextElementSibling;
        s && (s.style.display = s.style.display === "none" ? "block" : "none");
      });
    });
  }
  renderMessage(e) {
    const o = `kotonoha-message--${e.role}`, s = `kotonoha-bubble--${e.role}`;
    let r;
    e.role === "assistant" ? r = this.renderMarkdown(e.content) : r = `<div style="white-space:pre-wrap">${this.escapeHtml(e.content)}</div>`;
    let d = "";
    return e.role === "assistant" && e.sources && e.sources.length > 0 && (d += this.renderSources(e.sources)), e.role === "assistant" && e.formUrl && /^https?:\/\//i.test(e.formUrl) && (d += `
        <div class="kotonoha-form-guide">
          <p>より詳しいサポートが必要な場合：
            <a href="${this.escapeHtml(e.formUrl)}" target="_blank" rel="noopener noreferrer">お問い合わせフォーム</a>
          </p>
        </div>
      `), `
      <div class="kotonoha-message ${o}">
        <div class="kotonoha-bubble ${s}">
          ${r}
          ${d}
        </div>
      </div>
    `;
  }
  renderSources(e) {
    const o = e.map(
      (s) => `
      <div class="kotonoha-source-item">
        <div class="kotonoha-source-title">${this.escapeHtml(s.documentTitle)}</div>
        <div class="kotonoha-source-content">${this.escapeHtml(s.chunkContent)}...</div>
        <div class="kotonoha-source-similarity">類似度: ${(s.similarity * 100).toFixed(0)}%</div>
      </div>
    `
    ).join("");
    return `
      <button class="kotonoha-sources-toggle">参照元 (${e.length}件) ▼</button>
      <div class="kotonoha-sources-list" style="display:none">
        ${o}
      </div>
    `;
  }
  /** 簡易 Markdown → HTML 変換（軽量、外部依存なし） */
  renderMarkdown(e) {
    let o = this.escapeHtml(e);
    const s = [], r = Math.random().toString(36).slice(2, 10);
    o = o.replace(
      /```(\w*)\r?\n([\s\S]*?)```/g,
      (c, a, h) => {
        const u = s.length;
        return s.push(`<pre><code>${h}</code></pre>`), `
%%CB_${r}_${u}%%
`;
      }
    ), o = o.replace(/`([^`]+)`/g, "<code>$1</code>");
    const d = o.split(`
`), t = [];
    let n = !1, i = !1, l = !1;
    const f = new RegExp(`^%%CB_${r}_\\d+%%$`);
    for (let c = 0; c < d.length; c++) {
      const a = d[c];
      if (f.test(a.trim())) {
        n && (t.push("</ul>"), n = !1), i && (t.push("</ol>"), i = !1), l && (t.push("</blockquote>"), l = !1), t.push(a);
        continue;
      }
      if (/^(?:---+|___+)\s*$/.test(a)) {
        n && (t.push("</ul>"), n = !1), i && (t.push("</ol>"), i = !1), l && (t.push("</blockquote>"), l = !1), t.push("<hr>");
        continue;
      }
      const h = a.match(/^(#{1,3})\s+(.+)$/);
      if (h) {
        n && (t.push("</ul>"), n = !1), i && (t.push("</ol>"), i = !1), l && (t.push("</blockquote>"), l = !1);
        const m = h[1].length + 2;
        t.push(`<h${m}>${h[2]}</h${m}>`);
        continue;
      }
      const u = a.match(/^&gt;\s?(.*)$/);
      if (u) {
        n && (t.push("</ul>"), n = !1), i && (t.push("</ol>"), i = !1), l ? t.push("<br>") : (t.push("<blockquote>"), l = !0), t.push(u[1]);
        continue;
      }
      l && (t.push("</blockquote>"), l = !1);
      const b = a.match(/^[\-\*]\s+(.+)$/);
      if (b) {
        i && (t.push("</ol>"), i = !1), n || (t.push("<ul>"), n = !0), t.push(`<li>${b[1]}</li>`);
        continue;
      }
      const p = a.match(/^\d+\.\s+(.+)$/);
      if (p) {
        n && (t.push("</ul>"), n = !1), i || (t.push("<ol>"), i = !0), t.push(`<li>${p[1]}</li>`);
        continue;
      }
      n && (t.push("</ul>"), n = !1), i && (t.push("</ol>"), i = !1), t.push(a);
    }
    n && t.push("</ul>"), i && t.push("</ol>"), l && t.push("</blockquote>"), o = t.join(`
`), o = o.replace(/~~(.+?)~~/g, "<del>$1</del>"), o = o.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"), o = o.replace(new RegExp("(?<!\\w)\\*(?!\\s)(.+?)(?<!\\s)\\*(?!\\w)", "g"), "<em>$1</em>"), o = o.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (c, a, h) => {
        const u = h.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
        return /^https?:\/\//i.test(u) ? `<a href="${u.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">${a}</a>` : a;
      }
    );
    const k = new RegExp(`%%CB_${r}_(\\d+)%%`, "g");
    return o = o.replace(k, (c, a) => {
      const h = s[Number(a)];
      return h !== void 0 ? h : "";
    }), o = o.replace(
      /(?:<pre>[\s\S]*?<\/pre>)|(?:<ul>[\s\S]*?<\/ul>)|(?:<ol>[\s\S]*?<\/ol>)|(?:<blockquote>[\s\S]*?<\/blockquote>)|(\n)/g,
      (c, a) => a ? "<br>" : c
    ), o;
  }
  escapeHtml(e) {
    const o = document.createElement("div");
    return o.textContent = e, o.innerHTML;
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
customElements.get("kotonoha-chat-widget") || customElements.define("kotonoha-chat-widget", x);
export {
  x as kotonohaChatWidget
};
