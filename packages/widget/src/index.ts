import { kotonohaChatClient } from "@kotonoha/chat-sdk";
import type { ChatSendResponse, MessageSource } from "@kotonoha/chat-sdk";
import { widgetStyles } from "./styles";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: MessageSource[];
  confidence?: number | null;
  formUrl?: string;
}

/**
 * <kotonoha-chat-widget> カスタムエレメント
 *
 * 外部サイトへの埋め込み:
 * デプロイ先の `/embed/kotonoha-chat-widget.js` から読み込みます。
 *
 * @example
 * ```html
 * <script type="module" src="https://<your-domain>/embed/kotonoha-chat-widget.js"></script>
 * <kotonoha-chat-widget
 *   api-base-url="https://<your-domain>"
 *   service-id="your-service-id"
 *   placeholder="ご質問をどうぞ..."
 *   user-name="山田太郎"
 *   user-id="ext-user-123"
 * ></kotonoha-chat-widget>
 *
 * <style>
 *   kotonoha-chat-widget {
 *     --kotonoha-primary: #0ea5e9;
 *     width: 400px;
 *     height: 600px;
 *   }
 * </style>
 * ```
 *
 * user-name / user-id は任意属性です。適用先アプリからログインユーザー情報を
 * 渡すことで、管理画面のサポート履歴にユーザー名が表示されます。
 * 未設定の場合は従来通り「ウィジェット（ゲスト）」として記録されます。
 */
class kotonohaChatWidget extends HTMLElement {
  static get observedAttributes() {
    return ["api-base-url", "service-id", "auth-token", "placeholder", "user-name", "user-id"];
  }

  private shadow: ShadowRoot;
  private client: kotonohaChatClient | null = null;
  private messages: ChatMessage[] = [];
  private conversationId: string | undefined;
  private sending = false;
  private errorMessage = "";

  // DOM参照
  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.bindElements();
    this.bindEvents();
    this.initClient();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;
    // connectedCallback 前は DOM 未構築のためスキップ
    if (!this.messagesEl) return;
    if (name === "api-base-url" || name === "auth-token" || name === "user-name" || name === "user-id") {
      this.initClient();
    }
    if (name === "service-id") {
      // サービス変更時に会話をリセット
      this.messages = [];
      this.conversationId = undefined;
      this.renderMessages();
    }
    if (name === "placeholder") {
      if (this.inputEl) {
        this.inputEl.placeholder = newValue || "質問を入力...";
      }
    }
  }

  private get apiBaseUrl(): string {
    return this.getAttribute("api-base-url") || "";
  }

  private get serviceId(): string {
    return this.getAttribute("service-id") || "";
  }

  private get authToken(): string {
    return this.getAttribute("auth-token") || "";
  }

  private get placeholderText(): string {
    return this.getAttribute("placeholder") || "質問を入力...";
  }

  private get userName(): string {
    return this.getAttribute("user-name") || "";
  }

  private get externalUserId(): string {
    return this.getAttribute("user-id") || "";
  }

  private initClient() {
    if (!this.apiBaseUrl) return;
    this.client = new kotonohaChatClient({
      baseUrl: this.apiBaseUrl,
      authToken: this.authToken || undefined,
      userName: this.userName || undefined,
      userId: this.externalUserId || undefined,
    });
  }

  private render() {
    this.shadow.innerHTML = `
      <style>${widgetStyles}</style>
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

  private bindElements() {
    this.messagesEl = this.shadow.querySelector('[data-ref="messages"]')!;
    this.inputEl = this.shadow.querySelector('[data-ref="input"]')!;
    this.sendBtn = this.shadow.querySelector('[data-ref="send"]')!;
  }

  private bindEvents() {
    this.sendBtn.addEventListener("click", () => this.handleSend());
    this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  private async handleSend() {
    const text = this.inputEl.value.trim();
    if (!text || this.sending || !this.client || !this.serviceId) return;

    // ユーザーメッセージを即座に表示
    this.messages.push({ role: "user", content: text });
    this.inputEl.value = "";
    this.errorMessage = "";
    this.sending = true;
    this.updateInputState();
    this.renderMessages();

    try {
      const response: ChatSendResponse = await this.client.sendMessage({
        serviceId: this.serviceId,
        message: text,
        conversationId: this.conversationId,
      });

      this.conversationId = response.conversationId;

      this.messages.push({
        role: "assistant",
        content: response.message.content,
        sources: response.message.sources,
        confidence: response.message.confidence,
        formUrl: response.formUrl,
      });
    } catch (err) {
      this.messages.push({
        role: "assistant",
        content:
          "申し訳ございません。エラーが発生しました。しばらく経ってからもう一度お試しください。",
      });
    } finally {
      this.sending = false;
      this.updateInputState();
      this.renderMessages();
    }
  }

  private renderMessages() {
    if (this.messages.length === 0) {
      this.messagesEl.innerHTML =
        '<div class="kotonoha-messages-empty">質問を入力してください</div>';
      return;
    }

    let html = "";
    for (const msg of this.messages) {
      html += this.renderMessage(msg);
    }
    if (this.sending) {
      html += `
        <div class="kotonoha-loading">
          <div class="kotonoha-loading-bubble">
            <div class="kotonoha-spinner"></div>
            回答を生成中...
          </div>
        </div>
      `;
    }
    this.messagesEl.innerHTML = html;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    // ソーストグルのイベントをバインド
    this.messagesEl.querySelectorAll(".kotonoha-sources-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const list = btn.nextElementSibling as HTMLElement;
        if (list) {
          list.style.display =
            list.style.display === "none" ? "block" : "none";
        }
      });
    });
  }

  private renderMessage(msg: ChatMessage): string {
    const roleClass = `kotonoha-message--${msg.role}`;
    const bubbleClass = `kotonoha-bubble--${msg.role}`;

    let content: string;
    if (msg.role === "assistant") {
      content = this.renderMarkdown(msg.content);
    } else {
      content = `<div style="white-space:pre-wrap">${this.escapeHtml(msg.content)}</div>`;
    }

    let extras = "";
    if (msg.role === "assistant" && msg.sources && msg.sources.length > 0) {
      extras += this.renderSources(msg.sources);
    }
    if (msg.role === "assistant" && msg.formUrl) {
      extras += `
        <div class="kotonoha-form-guide">
          <p>より詳しいサポートが必要な場合：
            <a href="${this.escapeHtml(msg.formUrl)}" target="_blank" rel="noopener noreferrer">お問い合わせフォーム</a>
          </p>
        </div>
      `;
    }

    return `
      <div class="kotonoha-message ${roleClass}">
        <div class="kotonoha-bubble ${bubbleClass}">
          ${content}
          ${extras}
        </div>
      </div>
    `;
  }

  private renderSources(sources: MessageSource[]): string {
    const items = sources
      .map(
        (s) => `
      <div class="kotonoha-source-item">
        <div class="kotonoha-source-title">${this.escapeHtml(s.documentTitle)}</div>
        <div class="kotonoha-source-content">${this.escapeHtml(s.chunkContent)}...</div>
        <div class="kotonoha-source-similarity">類似度: ${(s.similarity * 100).toFixed(0)}%</div>
      </div>
    `,
      )
      .join("");

    return `
      <button class="kotonoha-sources-toggle">参照元 (${sources.length}件) ▼</button>
      <div class="kotonoha-sources-list" style="display:none">
        ${items}
      </div>
    `;
  }

  /** 簡易 Markdown → HTML 変換（軽量、外部依存なし） */
  private renderMarkdown(text: string): string {
    let html = this.escapeHtml(text);

    // コードブロック
    html = html.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      "<pre><code>$2</code></pre>",
    );
    // インラインコード
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    // 太字
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // 斜体
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    // リンク（javascript: 等の危険なスキームを排除、URL内の引用符をサニタイズ）
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_match: string, text: string, url: string) => {
        // escapeHtml 済みの &amp; 等をデコードしてから検証
        const decodedUrl = url.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
        if (/^https?:\/\//i.test(decodedUrl)) {
          // href 属性に安全な URL を再エスケープして挿入
          const safeUrl = decodedUrl.replace(/"/g, "&quot;");
          return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        return text;
      },
    );
    // 改行 → <br> (コードブロック外)
    html = html.replace(
      /(?:<pre>[\s\S]*?<\/pre>)|(\n)/g,
      (match, newline) => {
        if (newline) return "<br>";
        return match;
      },
    );

    return html;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private updateInputState() {
    this.inputEl.disabled = this.sending;
    this.sendBtn.disabled = this.sending;
  }

  // --- Public API ---

  /** 会話をリセットする */
  resetConversation() {
    this.messages = [];
    this.conversationId = undefined;
    this.renderMessages();
  }

  /** プログラムからメッセージを送信する */
  async send(message: string) {
    this.inputEl.value = message;
    await this.handleSend();
  }
}

// カスタムエレメントを登録
if (!customElements.get("kotonoha-chat-widget")) {
  customElements.define("kotonoha-chat-widget", kotonohaChatWidget);
}

export { kotonohaChatWidget };
