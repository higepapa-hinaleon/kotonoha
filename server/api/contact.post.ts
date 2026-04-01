import { sendEmail } from "~~/server/utils/email";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // ハニーポット: bot が入力した場合は黙って成功を返す
  if (body.honeypot) {
    return { ok: true };
  }

  // 必須フィールドバリデーション
  const required = ["name", "email", "category", "message"] as const;
  for (const field of required) {
    if (!body[field] || typeof body[field] !== "string" || !body[field].trim()) {
      throw createError({ statusCode: 400, statusMessage: `${field} は必須です` });
    }
  }

  // メール形式チェック
  if (!body.email.includes("@")) {
    throw createError({ statusCode: 400, statusMessage: "有効なメールアドレスを入力してください" });
  }

  // メッセージ長チェック
  if (body.message.trim().length < 10) {
    throw createError({
      statusCode: 400,
      statusMessage: "お問い合わせ内容は10文字以上で入力してください",
    });
  }

  const config = useRuntimeConfig();
  const supportEmail = config.supportEmail || config.smtpUser;

  if (!supportEmail) {
    throw createError({ statusCode: 500, statusMessage: "メール設定がされていません" });
  }

  const name = body.name.trim();
  const email = body.email.trim();
  const category = body.category.trim();
  const message = body.message.trim();

  await sendEmail({
    to: supportEmail,
    subject: `【Kotonoha お問い合わせ】${category} - ${name}`,
    text:
      `お問い合わせを受け付けました。\n\n` +
      `お名前: ${name}\n` +
      `メールアドレス: ${email}\n` +
      `種別: ${category}\n\n` +
      `内容:\n${message}\n`,
  });

  return { ok: true };
});
