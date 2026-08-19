import { registerTelemetry } from "ai";
import {
  isDefaultExportSpan,
  LangfuseSpanProcessor,
  type ShouldExportSpan,
} from "@langfuse/otel";
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import "server-only";

function tracingEnvironment() {
  return (
    process.env.LANGFUSE_TRACING_ENVIRONMENT?.trim() ||
    (process.env.NODE_ENV === "production" ? "production" : "development")
  );
}

const AI_SDK_WRAPPER_OPERATIONS = new Set(["invoke_agent", "agent_step"]);

const shouldExportSpan: ShouldExportSpan = ({ otelSpan }) => {
  const operation = otelSpan.attributes["gen_ai.operation.name"];

  if (typeof operation === "string" && AI_SDK_WRAPPER_OPERATIONS.has(operation)) {
    return false;
  }

  return isDefaultExportSpan(otelSpan);
};

export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  environment: tracingEnvironment(),
  exportMode: "immediate",
  shouldExportSpan,
});

let registered = false;

export function registerLangfuseTelemetry() {
  if (registered) {
    return;
  }

  registered = true;
  process.env.OTEL_SERVICE_NAME ??= "ai-invoice-assistant";

  const tracerProvider = new NodeTracerProvider({
    spanProcessors: [langfuseSpanProcessor],
  });

  tracerProvider.register();
  registerTelemetry(new LangfuseVercelAiSdkIntegration());
}

registerLangfuseTelemetry();
