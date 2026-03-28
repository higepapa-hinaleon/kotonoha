import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { generateEmbedding } from "~~/server/utils/embeddings";
import type { FaqUpsertRequest } from "~~/shared/types/api";
import type { Faq } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }
  const body = await readBody<FaqUpsertRequest>(event);

  if (!body.question?.trim() || !body.answer?.trim() || !body.serviceId) {
    throw createError({ statusCode: 400, statusMessage: "question, answer, serviceId は必須です" });
  }

  const db = getAdminFirestore();
  const now = new Date().toISOString();

  const docRef = db.collection("faqs").doc();
  const embedding = await generateEmbedding(body.question.trim());

  await docRef.set({
    organizationId: user.organizationId,
    groupId,
    serviceId: body.serviceId,
    question: body.question.trim(),
    answer: body.answer.trim(),
    frequency: 0,
    isPublished: body.isPublished ?? false,
    embedding: FieldValue.vector(embedding),
    generatedFrom: "manual" as const,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: docRef.id,
    organizationId: user.organizationId,
    groupId,
    serviceId: body.serviceId,
    question: body.question.trim(),
    answer: body.answer.trim(),
    frequency: 0,
    isPublished: body.isPublished ?? false,
    embedding,
    generatedFrom: "manual",
    createdAt: now,
    updatedAt: now,
  } as Faq;
});
