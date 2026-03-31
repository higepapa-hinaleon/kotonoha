import nodemailer from "nodemailer";
import { BANK_TRANSFER_INFO } from "~~/shared/bank-transfer";
// nodemailer メール送信ユーティリティ

let transporterInstance: nodemailer.Transporter | null = null;

/**
 * メールトランスポーターを取得する（シングルトン）
 */
function getTransporter(): nodemailer.Transporter {
  if (transporterInstance) return transporterInstance;

  const config = useRuntimeConfig();
  if (!config.smtpHost) {
    throw createError({ statusCode: 500, statusMessage: "SMTP が設定されていません" });
  }

  transporterInstance = nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort) || 587,
    secure: Number(config.smtpPort) === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  return transporterInstance;
}

/**
 * メールを送信する
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const config = useRuntimeConfig();

  if (!config.smtpHost) {
    console.warn("[email] SMTP未設定のためメール送信をスキップ:", params.subject);
    return;
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: config.smtpFrom || config.smtpUser,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

/**
 * 銀行振込の請求メールを送信する
 */
export async function sendInvoiceEmail(params: {
  to: string;
  organizationName: string;
  contactName: string;
  planName: string;
  amount: number;
  invoiceNumber?: string;
}): Promise<void> {
  const b = BANK_TRANSFER_INFO;
  const invoiceRef = params.invoiceNumber ? `\n請求番号: ${params.invoiceNumber}` : "";
  const invoiceNote = params.invoiceNumber
    ? `\n※振込人名の前に請求番号「${params.invoiceNumber}」を付けてください。\n　例: ${params.invoiceNumber} ${params.contactName}`
    : "";

  const text = `${params.organizationName} 様

この度は Kotonoha のご利用申し込みありがとうございます。
ご利用申請が承認されましたので、下記の通りお振込みをお願いいたします。

【ご請求内容】${invoiceRef}
プラン: ${params.planName}
金額: ¥${params.amount.toLocaleString()}（税込）/ 月

【お振込先】
銀行名: ${b.bankName}
支店名: ${b.branchName}
口座種別: ${b.accountType}
口座番号: ${b.accountNumber}
口座名義: ${b.accountHolder}

※振込手数料はお客様負担となります。
※お振込の際は、登録時のお名前と同一の名義でお願いします。${invoiceNote}
※入金確認後、サービスが有効化されます。

ご不明な点がございましたら、お気軽にお問い合わせください。

──────────────
Kotonoha 運営チーム
`;

  await sendEmail({
    to: params.to,
    subject: `【Kotonoha】ご利用料金のお振込みのお願い（${params.planName}プラン）`,
    text,
  });
}

/**
 * 申請承認通知メールを送信する
 */
export async function sendApplicationApprovedEmail(params: {
  to: string;
  organizationName: string;
  loginUrl: string;
}): Promise<void> {
  const text = `${params.organizationName} 様

Kotonoha のご利用申請が承認されました。
以下のURLからログインしてご利用いただけます。

${params.loginUrl}

ご不明な点がございましたら、お気軽にお問い合わせください。

──────────────
Kotonoha 運営チーム
`;

  await sendEmail({
    to: params.to,
    subject: "【Kotonoha】ご利用申請が承認されました",
    text,
  });
}

/**
 * 申請却下通知メールを送信する
 */
export async function sendApplicationRejectedEmail(params: {
  to: string;
  organizationName: string;
  reason?: string;
}): Promise<void> {
  const reasonText = params.reason ? `\n却下理由: ${params.reason}\n` : "";

  const text = `${params.organizationName} 様

Kotonoha のご利用申請について、審査の結果、今回はお受けすることができませんでした。
${reasonText}
ご不明な点がございましたら、お気軽にお問い合わせください。

──────────────
Kotonoha 運営チーム
`;

  await sendEmail({
    to: params.to,
    subject: "【Kotonoha】ご利用申請の審査結果について",
    text,
  });
}
