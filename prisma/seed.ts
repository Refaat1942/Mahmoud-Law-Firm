import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { DEFAULT_ROLES } from "../src/lib/rbac";
import { SEQUENCE_DEFAULTS } from "../src/lib/sequence";
import { DEFAULT_DEADLINE_PRESETS, DEFAULT_EMAIL_TEMPLATES, DEFAULT_OFFICE } from "../src/lib/settings";

const OFFICE_PROFILE = {
  nameAr: "مكتب مريم مبارك النوفلي للمحاماة",
  nameEn: "Maryam M. Al Noufli Law Firm",
  addressAr: "أبوظبي - شارع خليفة - خلف بنك أبوظبي الأول (FAB) - الطابق العاشر - مكتب 1006",
  addressEn: "Office 1006, 10th Floor, behind FAB Bank, Khalifa Street, Abu Dhabi, UAE",
};
const PLACEHOLDER_OFFICE_NAME_EN = "Vision Advocates & Legal Consultants";
import { seedDemo } from "./seed-demo";

const prisma = new PrismaClient();

const ACCOUNTS: { code: string; nameAr: string; nameEn: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"; parent?: string }[] = [
  { code: "1000", nameAr: "الأصول", nameEn: "Assets", type: "ASSET" },
  { code: "1100", nameAr: "النقدية والبنوك", nameEn: "Cash and banks", type: "ASSET", parent: "1000" },
  { code: "1110", nameAr: "الصندوق", nameEn: "Cash on hand", type: "ASSET", parent: "1100" },
  { code: "1120", nameAr: "البنك - الحساب الجاري", nameEn: "Bank - current account", type: "ASSET", parent: "1100" },
  { code: "1130", nameAr: "البنك - حساب الأمانات", nameEn: "Bank - client trust account", type: "ASSET", parent: "1100" },
  { code: "1200", nameAr: "ذمم العملاء المدينة", nameEn: "Accounts receivable", type: "ASSET", parent: "1000" },
  { code: "1300", nameAr: "ضريبة القيمة المضافة على المدخلات", nameEn: "VAT recoverable (input)", type: "ASSET", parent: "1000" },
  { code: "1500", nameAr: "الأصول الثابتة", nameEn: "Fixed assets", type: "ASSET", parent: "1000" },
  { code: "2000", nameAr: "الالتزامات", nameEn: "Liabilities", type: "LIABILITY" },
  { code: "2100", nameAr: "أمانات العملاء", nameEn: "Client trust funds", type: "LIABILITY", parent: "2000" },
  { code: "2200", nameAr: "ضريبة القيمة المضافة المستحقة (المخرجات)", nameEn: "VAT payable (output)", type: "LIABILITY", parent: "2000" },
  { code: "2300", nameAr: "رواتب مستحقة", nameEn: "Salaries payable", type: "LIABILITY", parent: "2000" },
  { code: "2400", nameAr: "مخصص مكافأة نهاية الخدمة", nameEn: "End-of-service provision", type: "LIABILITY", parent: "2000" },
  { code: "3000", nameAr: "رأس المال", nameEn: "Capital", type: "EQUITY" },
  { code: "3100", nameAr: "الأرباح المحتجزة", nameEn: "Retained earnings", type: "EQUITY" },
  { code: "4000", nameAr: "إيرادات الأتعاب القانونية", nameEn: "Legal fees revenue", type: "REVENUE" },
  { code: "4100", nameAr: "إيرادات مصروفات مستردة", nameEn: "Reimbursed expenses revenue", type: "REVENUE" },
  { code: "4900", nameAr: "إيرادات أخرى", nameEn: "Other income", type: "REVENUE" },
  { code: "5000", nameAr: "المصروفات", nameEn: "Expenses", type: "EXPENSE" },
  { code: "5100", nameAr: "الرواتب والأجور", nameEn: "Salaries and wages", type: "EXPENSE", parent: "5000" },
  { code: "5200", nameAr: "الإيجار", nameEn: "Rent", type: "EXPENSE", parent: "5000" },
  { code: "5300", nameAr: "رسوم المحاكم", nameEn: "Court fees", type: "EXPENSE", parent: "5000" },
  { code: "5310", nameAr: "أتعاب الخبراء", nameEn: "Expert fees", type: "EXPENSE", parent: "5000" },
  { code: "5400", nameAr: "الكهرباء والمياه والاتصالات", nameEn: "Utilities and telecom", type: "EXPENSE", parent: "5000" },
  { code: "5500", nameAr: "مستلزمات مكتبية", nameEn: "Office supplies", type: "EXPENSE", parent: "5000" },
  { code: "5600", nameAr: "رسوم حكومية وتراخيص", nameEn: "Government fees and licences", type: "EXPENSE", parent: "5000" },
  { code: "5900", nameAr: "مصروفات أخرى", nameEn: "Other expenses", type: "EXPENSE", parent: "5000" },
];

const SYSTEM_ACCOUNTS = new Set(["1110", "1120", "1130", "1200", "1300", "2100", "2200", "2300", "3000", "3100", "4000", "4100", "5100"]);

const COURTS = [
  { nameAr: "محاكم دبي", nameEn: "Dubai Courts", emirate: "DUBAI" },
  { nameAr: "دائرة القضاء - أبوظبي", nameEn: "Abu Dhabi Judicial Department", emirate: "ABU_DHABI" },
  { nameAr: "المحاكم الاتحادية", nameEn: "Federal Courts", emirate: "FEDERAL" },
  { nameAr: "محاكم رأس الخيمة", nameEn: "Ras Al Khaimah Courts", emirate: "RAS_AL_KHAIMAH" },
  { nameAr: "محاكم مركز دبي المالي العالمي", nameEn: "DIFC Courts", emirate: "DUBAI" },
  { nameAr: "محاكم سوق أبوظبي العالمي", nameEn: "ADGM Courts", emirate: "ABU_DHABI" },
  { nameAr: "مركز فض المنازعات الإيجارية - دبي", nameEn: "Rental Dispute Center - Dubai", emirate: "DUBAI" },
];

const MATTER_TYPES = [
  { key: "CIVIL", nameAr: "مدني", nameEn: "Civil" },
  { key: "COMMERCIAL", nameAr: "تجاري", nameEn: "Commercial" },
  { key: "CRIMINAL", nameAr: "جزائي", nameEn: "Criminal" },
  { key: "LABOUR", nameAr: "عمالي", nameEn: "Labour" },
  { key: "PERSONAL_STATUS", nameAr: "أحوال شخصية", nameEn: "Personal status" },
  { key: "RENTAL", nameAr: "إيجارات", nameEn: "Rental" },
  { key: "EXECUTION", nameAr: "تنفيذ", nameEn: "Execution" },
  { key: "ARBITRATION", nameAr: "تحكيم", nameEn: "Arbitration" },
];

// Fixed-date UAE public holidays; Hijri-based holidays are announced yearly and should be added in Settings.
const HOLIDAYS = [
  { date: "01-01", nameAr: "رأس السنة الميلادية", nameEn: "New Year's Day" },
  { date: "12-01", nameAr: "يوم الشهيد", nameEn: "Commemoration Day" },
  { date: "12-02", nameAr: "اليوم الوطني", nameEn: "National Day" },
  { date: "12-03", nameAr: "عطلة اليوم الوطني", nameEn: "National Day holiday" },
];

async function main() {
  for (const r of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      create: { key: r.key, nameAr: r.nameAr, nameEn: r.nameEn, scopeAll: r.scopeAll, isSystem: true },
      update: { nameAr: r.nameAr, nameEn: r.nameEn, isSystem: true },
    });
    const existing = await prisma.permission.count({ where: { roleId: role.id } });
    if (existing === 0 && r.permissions.length) {
      await prisma.permission.createMany({
        data: r.permissions.map((p) => {
          const [module, action] = p.split(":");
          return { roleId: role.id, module, action };
        }),
      });
    }
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: "admin" } });
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@lawoffice.ae";
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      nameAr: "مدير النظام",
      nameEn: "System Admin",
      roleId: adminRole.id,
      passwordHash: await hash(process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345"),
    },
    update: {},
  });

  for (const a of ACCOUNTS) {
    await prisma.account.upsert({
      where: { code: a.code },
      create: { code: a.code, nameAr: a.nameAr, nameEn: a.nameEn, type: a.type, isSystem: SYSTEM_ACCOUNTS.has(a.code) },
      update: {},
    });
  }
  for (const a of ACCOUNTS.filter((x) => x.parent)) {
    const parent = await prisma.account.findUniqueOrThrow({ where: { code: a.parent! } });
    await prisma.account.update({ where: { code: a.code }, data: { parentId: parent.id } });
  }

  const banks = [
    { code: "1110", nameAr: "الصندوق", nameEn: "Cash box", type: "CASH" as const },
    { code: "1120", nameAr: "البنك - الحساب الجاري", nameEn: "Main bank account", type: "BANK" as const },
    { code: "1130", nameAr: "البنك - حساب الأمانات", nameEn: "Client trust bank account", type: "BANK" as const },
  ];
  for (const b of banks) {
    const account = await prisma.account.findUniqueOrThrow({ where: { code: b.code } });
    await prisma.bankAccount.upsert({
      where: { accountId: account.id },
      create: { nameAr: b.nameAr, nameEn: b.nameEn, type: b.type, accountId: account.id },
      update: {},
    });
  }

  if ((await prisma.court.count()) === 0) await prisma.court.createMany({ data: COURTS });
  for (const t of MATTER_TYPES) await prisma.matterType.upsert({ where: { key: t.key }, create: t, update: {} });

  const year = new Date().getFullYear();
  for (const y of [year, year + 1]) {
    for (const h of HOLIDAYS) {
      const date = new Date(`${y}-${h.date}T00:00:00Z`);
      await prisma.holiday.upsert({ where: { date }, create: { date, nameAr: h.nameAr, nameEn: h.nameEn }, update: {} });
    }
  }

  for (const [key, d] of Object.entries(SEQUENCE_DEFAULTS)) {
    await prisma.sequence.upsert({ where: { key }, create: { key, ...d, next: 1, year }, update: {} });
  }

  const settings: Record<string, unknown> = {
    office: { ...DEFAULT_OFFICE, ...OFFICE_PROFILE },
    deadlinePresets: DEFAULT_DEADLINE_PRESETS,
    emailTemplates: DEFAULT_EMAIL_TEMPLATES,
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value: value as object }, update: {} });
  }

  // Databases seeded before the office profile was set still carry the placeholder
  // name; replace it once. Offices that already edited their name are left alone.
  const office = await prisma.setting.findUnique({ where: { key: "office" } });
  const current = (office?.value ?? {}) as Record<string, unknown>;
  if (current.nameEn === PLACEHOLDER_OFFICE_NAME_EN) {
    await prisma.setting.update({ where: { key: "office" }, data: { value: { ...current, ...OFFICE_PROFILE } } });
  }

  if (process.env.SEED_DEMO !== "false") await seedDemo(prisma);
  console.log(`Seed complete. Admin: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
