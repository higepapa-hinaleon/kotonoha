import { VertexAI } from "@google-cloud/vertexai";

let vertexAiInstance: VertexAI | null = null;

export function getVertexAI() {
  if (vertexAiInstance) return vertexAiInstance;

  const config = useRuntimeConfig();

  vertexAiInstance = new VertexAI({
    project: config.firebaseProjectId,
    location: config.vertexAiLocation,
    googleAuthOptions: {
      credentials: {
        client_email: config.firebaseClientEmail,
        private_key: config.firebasePrivateKey?.replace(/\\n/g, "\n"),
      },
      projectId: config.firebaseProjectId,
    },
  });

  return vertexAiInstance;
}

export function getGenerativeModel() {
  const config = useRuntimeConfig();
  const vertexAi = getVertexAI();

  return vertexAi.getGenerativeModel({
    model: config.vertexAiModel,
  });
}
