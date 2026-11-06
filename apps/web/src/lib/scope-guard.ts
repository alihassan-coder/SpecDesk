/**
 * M1 stand-in for the Analyst's scope check. M4 replaces this with an LLM classifier
 * that also suggests the software angle ("plan the ordering app for your bakery?").
 */
const SOFTWARE_HINTS =
  /\b(app|apps|website|web|site|platform|software|saas|api|dashboard|tool|bot|chatbot|ai|mobile|ios|android|marketplace|tracker|portal|extension|plugin|system|crm|erp|automation|game|online|digital|service)\b/i;

export function looksLikeSoftware(idea: string) {
  return SOFTWARE_HINTS.test(idea);
}
