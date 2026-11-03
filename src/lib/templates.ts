export type TemplateVars = Record<string, unknown>;

const lookup = (vars: TemplateVars, path: string) =>
  path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), vars);

/** Replaces {{path.to.value}} placeholders; unknown placeholders are left visible so they can be spotted. */
export function renderTemplate(body: string, vars: TemplateVars) {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path: string) => {
    const v = lookup(vars, path);
    return v === undefined || v === null ? match : String(v);
  });
}

export const TEMPLATE_PLACEHOLDERS = [
  "office.name",
  "office.trn",
  "office.address",
  "client.name",
  "client.code",
  "client.emiratesId",
  "client.address",
  "client.phone",
  "case.number",
  "case.fileNo",
  "case.title",
  "case.court",
  "case.type",
  "opponent.name",
  "lawyer.name",
  "today",
] as const;
