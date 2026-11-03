import { getTranslations } from "next-intl/server";
import { HttpError, apiLocale, apiUser, withErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getOffice } from "@/lib/settings";
import { buildSif } from "@/lib/wps";

/** WPS Salary Information File for the payroll; refuses when the employer or an employee lacks WPS details. */
export const GET = withErrors(async (req, { params }) => {
  await apiUser("hr", "approve");
  const { id } = await params;
  const t = await getTranslations({ locale: apiLocale(req), namespace: "hr" });
  const pr = await prisma.payroll.findUnique({ where: { id }, include: { lines: { include: { employee: true }, orderBy: { employee: { code: "asc" } } } } });
  if (!pr) throw new HttpError(404);
  if (pr.status === "DRAFT") return new Response(t("sifDraft"), { status: 409, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const office = await getOffice();
  const missing = pr.lines.filter((l) => !l.employee.molPersonId || !l.employee.bankRoutingCode || !l.employee.iban).map((l) => `${l.employee.code} ${l.employee.nameEn}`);
  if (!office.wpsEmployerId || !office.wpsBankCode || missing.length) {
    const reason = [!office.wpsEmployerId || !office.wpsBankCode ? t("sifEmployerMissing") : "", missing.length ? t("sifEmployeesMissing", { list: missing.join(", ") }) : ""].filter(Boolean).join("\n");
    return new Response(reason, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const sif = buildSif({
    employerId: office.wpsEmployerId,
    bankCode: office.wpsBankCode,
    period: pr.period,
    employees: pr.lines.map((l) => ({
      molPersonId: l.employee.molPersonId!,
      bankRoutingCode: l.employee.bankRoutingCode!,
      iban: l.employee.iban!,
      fixed: l.net.minus(l.additions),
      variable: l.additions,
      leaveDays: l.leaveDays,
    })),
  });
  return new Response(sif.content, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${sif.fileName}"`, "Cache-Control": "private, no-store" },
  });
});
