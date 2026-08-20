module.exports = (output, context) => {
  const tool = context.config?.tool;
  const tools =
    context.metadata?.tools ??
    context.providerResponse?.metadata?.tools ??
    [];

  if (!tool) {
    return {
      pass: false,
      score: 0,
      reason: "Assertion config.tool is required",
    };
  }

  const called = Array.isArray(tools) && tools.includes(tool);

  return {
    pass: called,
    score: called ? 1 : 0,
    reason: called
      ? `Called ${tool}`
      : `Expected tool ${tool}, got: ${tools.join(", ") || "none"}`,
  };
};
