module.exports = (output, context) => {
  const amount = String(context.config?.amount ?? "");

  if (!/^\d+(\.\d+)?$/.test(amount)) {
    return {
      pass: false,
      score: 0,
      reason: "Assertion config.amount must be a number string",
    };
  }

  const [whole, fraction] = amount.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "[,\\s]?");
  const pattern = fraction
    ? `${grouped}(?:[.,]${fraction}0*)?`
    : `${grouped}(?:[.,]0+)?`;
  const re = new RegExp(pattern);

  const pass = re.test(String(output));

  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? `Found amount ${amount}`
      : `Expected amount ${amount} (commas allowed), not found`,
  };
};
