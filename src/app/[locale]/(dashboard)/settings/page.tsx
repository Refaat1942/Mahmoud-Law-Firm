import { getLocale, getTranslations } from "next-intl/server";
import { Pencil, Trash2, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { getDeadlinePresets, getEmailTemplates, getOffice } from "@/lib/settings";
import { SEQUENCE_DEFAULTS, formatNumber } from "@/lib/sequence";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText } from "@/components/format";
import { PageHeader, Section, Tabs } from "@/components/page";
import { enumOptions } from "@/server/options";
import {
  addHoliday,
  createCourt,
  createMatterType,
  deleteHoliday,
  deletePreset,
  removeLogo,
  saveEmailTemplate,
  saveOffice,
  savePreset,
  updateCourt,
  updateMatterType,
  updateSequence,
  uploadLogo,
} from "@/server/settings/actions";

const TABS = ["office", "courts", "types", "holidays", "numbering", "deadlines", "emails"] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; edit?: string }> }) {
  const user = await requirePermission("settings");
  const sp = await searchParams;
  const tab = TABS.find((x) => x === sp.tab) ?? "office";
  const t = await getTranslations();
  const locale = await getLocale();
  const canEdit = can(user, "settings", "update");
  const editLink = (id: string) => (
    <Link href={`/settings?tab=${tab}&edit=${id}`} scroll={false} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t("common.edit")}>
      <Pencil />
    </Link>
  );
  const cancel = (
    <Link href={`/settings?tab=${tab}`} scroll={false} className={buttonVariants({ variant: "ghost", size: "sm" })}>
      <X /> {t("common.cancel")}
    </Link>
  );

  let content: React.ReactNode;
  if (tab === "office") {
    const office = await getOffice();
    content = (
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title={t("settings.office")} className="xl:col-span-2">
          <EntityForm
            schema="office"
            action={saveOffice}
            defaultValues={office as unknown as Record<string, unknown>}
            fields={[
              { name: "nameAr", label: t("f.nameAr"), required: true },
              { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" },
              { name: "addressAr", label: t("settings.addressAr") },
              { name: "addressEn", label: t("settings.addressEn"), dir: "ltr" },
              { name: "phone", label: t("f.phone"), type: "tel" },
              { name: "email", label: t("f.email"), type: "email" },
              { name: "trn", label: t("f.trn"), dir: "ltr", help: t("settings.trnHelp") },
              { name: "currency", label: t("f.currency"), type: "select", options: await enumOptions("Currency"), required: true },
              { name: "vatRate", label: t("f.vatRate"), type: "number", required: true },
              { name: "defaultHourlyRate", label: t("f.defaultHourlyRate"), type: "money", required: true },
              { name: "reminderDaysBefore", label: t("f.reminderDaysBefore"), type: "number", required: true },
              { name: "showHijri", label: t("f.showHijri"), type: "checkbox" },
              { name: "wpsEmployerId", label: t("f.wpsEmployerId"), dir: "ltr", help: t("settings.wpsHelp") },
              { name: "wpsBankCode", label: t("f.wpsBankCode"), dir: "ltr" },
            ]}
          />
        </Section>
        <Section title={t("f.logo")}>
          <p className="mb-3 text-sm text-muted-foreground">{office.logoKey ? t("settings.logoCustom") : t("settings.logoDefault")}</p>
          {canEdit && (
            <>
              <EntityForm
                schema="logo"
                action={uploadLogo}
                columns={1}
                resetOnSuccess
                fields={[{ name: "file", label: t("f.logo"), type: "file", required: true, help: t("settings.logoHelp") }]}
                submitLabel={t("common.upload")}
              />
              {office.logoKey && (
                <ActionButton variant="outline" className="mt-3" action={removeLogo}>
                  <Trash2 /> {t("settings.logoReset")}
                </ActionButton>
              )}
            </>
          )}
        </Section>
      </div>
    );
  } else if (tab === "courts" || tab === "types") {
    const isCourts = tab === "courts";
    const rows = isCourts ? await prisma.court.findMany({ orderBy: [{ isActive: "desc" }, { nameAr: "asc" }] }) : await prisma.matterType.findMany({ orderBy: [{ isActive: "desc" }, { nameAr: "asc" }] });
    const editing = rows.find((r) => r.id === sp.edit);
    const emirates = await enumOptions("Emirate");
    const fields = isCourts
      ? [
          { name: "nameAr", label: t("f.nameAr"), required: true },
          { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" as const },
          { name: "emirate", label: t("f.emirate"), type: "select" as const, options: emirates },
          { name: "isActive", label: t("f.isActive"), type: "checkbox" as const },
        ]
      : [
          { name: "key", label: t("f.key"), required: true, dir: "ltr" as const, help: t("settings.keyHelp") },
          { name: "nameAr", label: t("f.nameAr"), required: true },
          { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" as const },
          { name: "isActive", label: t("f.isActive"), type: "checkbox" as const },
        ];
    content = (
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2">
          <Table>
            <thead>
              <tr>
                <Th>{t("f.name")}</Th>
                <Th>{isCourts ? t("f.emirate") : t("f.key")}</Th>
                <Th>{t("f.status")}</Th>
                {canEdit && <Th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.id === sp.edit ? "bg-accent/10" : r.isActive ? "" : "opacity-50"}>
                  <Td>{localized(r, locale)}</Td>
                  <Td dir="ltr">{"emirate" in r ? (r.emirate ? t(`enum.Emirate.${r.emirate}`) : "") : (r as { key: string }).key}</Td>
                  <Td>{r.isActive ? <Badge tone="success">{t("settings.active")}</Badge> : <Badge tone="neutral">{t("settings.inactive")}</Badge>}</Td>
                  {canEdit && <Td>{editLink(r.id)}</Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
        {canEdit && (
          <Section title={editing ? t("common.edit") : isCourts ? t("settings.newCourt") : t("settings.newType")} actions={editing && cancel}>
            <EntityForm
              key={editing?.id ?? "new"}
              schema={isCourts ? "court" : "matterType"}
              action={editing ? (isCourts ? updateCourt : updateMatterType).bind(null, editing.id) : isCourts ? createCourt : createMatterType}
              columns={1}
              resetOnSuccess={!editing}
              defaultValues={editing ? (editing as unknown as Record<string, unknown>) : { isActive: true }}
              fields={fields}
            />
          </Section>
        )}
      </div>
    );
  } else if (tab === "holidays") {
    const holidays = await prisma.holiday.findMany({ where: { date: { gte: new Date(new Date().getFullYear() - 1, 0, 1) } }, orderBy: { date: "asc" } });
    content = (
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2">
          <p className="mb-3 text-sm text-muted-foreground">{t("settings.holidaysHelp")}</p>
          <Table>
            <thead>
              <tr>
                <Th>{t("f.date")}</Th>
                <Th>{t("f.name")}</Th>
                {can(user, "settings", "delete") && <Th />}
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id}>
                  <Td>
                    <DateText value={h.date} />
                  </Td>
                  <Td>{localized(h, locale)}</Td>
                  {can(user, "settings", "delete") && (
                    <Td>
                      <ActionButton variant="ghost" size="icon" action={deleteHoliday.bind(null, h.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                        <Trash2 />
                      </ActionButton>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
        {can(user, "settings", "create") && (
          <Section title={t("settings.newHoliday")}>
            <EntityForm
              schema="holiday"
              action={addHoliday}
              columns={1}
              resetOnSuccess
              fields={[
                { name: "date", label: t("f.date"), type: "date", required: true },
                { name: "nameAr", label: t("f.nameAr"), required: true },
                { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" },
              ]}
            />
          </Section>
        )}
      </div>
    );
  } else if (tab === "numbering") {
    const saved = new Map((await prisma.sequence.findMany()).map((s) => [s.key, s]));
    const year = new Date().getFullYear();
    const rows = Object.entries(SEQUENCE_DEFAULTS).map(([key, d]) => {
      const s = saved.get(key);
      const next = s ? (s.yearly && s.year !== year ? 1 : s.next) : 1;
      return { key, prefix: s?.prefix ?? d.prefix, padding: s?.padding ?? d.padding, yearly: s?.yearly ?? d.yearly, next };
    });
    const editing = rows.find((r) => r.key === sp.edit);
    content = (
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2">
          <Table>
            <thead>
              <tr>
                <Th>{t("settings.document")}</Th>
                <Th>{t("f.prefix")}</Th>
                <Th>{t("f.yearly")}</Th>
                <Th>{t("settings.nextNumber")}</Th>
                {canEdit && <Th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={r.key === sp.edit ? "bg-accent/10" : ""}>
                  <Td>{t(`settings.sequences.${r.key}`)}</Td>
                  <Td dir="ltr">{r.prefix}</Td>
                  <Td>{r.yearly ? t("common.yes") : t("common.no")}</Td>
                  <Td dir="ltr" className="font-mono text-xs">
                    {formatNumber(r.prefix, r.next, r.padding, r.yearly ? year : null)}
                  </Td>
                  {canEdit && <Td>{editLink(r.key)}</Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
        {canEdit && editing && (
          <Section title={t(`settings.sequences.${editing.key}`)} actions={cancel}>
            <EntityForm
              key={editing.key}
              schema="sequence"
              action={updateSequence.bind(null, editing.key)}
              columns={1}
              defaultValues={editing}
              fields={[
                { name: "prefix", label: t("f.prefix"), required: true, dir: "ltr" },
                { name: "padding", label: t("f.padding"), type: "number", required: true },
                { name: "next", label: t("f.nextValue"), type: "number", required: true },
                { name: "yearly", label: t("f.yearly"), type: "checkbox" },
              ]}
            />
            <p className="mt-3 text-xs text-muted-foreground">{t("settings.sequenceHelp")}</p>
          </Section>
        )}
      </div>
    );
  } else if (tab === "deadlines") {
    const presets = await getDeadlinePresets();
    const editing = presets.find((p) => p.key === sp.edit);
    content = (
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2">
          <p className="mb-3 text-sm text-muted-foreground">{t("settings.presetsHelp")}</p>
          <Table>
            <thead>
              <tr>
                <Th>{t("f.name")}</Th>
                <Th>{t("f.key")}</Th>
                <Th>{t("f.days")}</Th>
                {canEdit && <Th />}
              </tr>
            </thead>
            <tbody>
              {presets.map((p) => (
                <tr key={p.key} className={p.key === sp.edit ? "bg-accent/10" : ""}>
                  <Td>{locale === "en" ? p.nameEn : p.nameAr}</Td>
                  <Td dir="ltr">{p.key}</Td>
                  <Td className="tabular-nums">{p.days}</Td>
                  {canEdit && (
                    <Td className="whitespace-nowrap">
                      {editLink(p.key)}
                      <ActionButton variant="ghost" size="icon" action={deletePreset.bind(null, p.key)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                        <Trash2 />
                      </ActionButton>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
        {canEdit && (
          <Section title={editing ? t("common.edit") : t("settings.newPreset")} actions={editing && cancel}>
            <EntityForm
              key={editing?.key ?? "new"}
              schema="preset"
              action={savePreset}
              columns={1}
              resetOnSuccess={!editing}
              defaultValues={editing ?? {}}
              fields={[
                { name: "key", label: t("f.key"), required: true, dir: "ltr", help: t("settings.keyHelp") },
                { name: "nameAr", label: t("f.nameAr"), required: true },
                { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" },
                { name: "days", label: t("f.days"), type: "number", required: true },
              ]}
            />
          </Section>
        )}
      </div>
    );
  } else {
    const templates = await getEmailTemplates();
    const key = sp.edit && sp.edit in templates ? sp.edit : Object.keys(templates)[0];
    content = (
      <div className="grid gap-5 xl:grid-cols-3">
        <Section>
          <ul className="space-y-1">
            {Object.keys(templates).map((k) => (
              <li key={k}>
                <Link href={`/settings?tab=emails&edit=${k}`} scroll={false} className={buttonVariants({ variant: k === key ? "default" : "ghost", className: "w-full justify-start" })}>
                  {t(`settings.emails.${k}`)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">{t("settings.emailHelp")}</p>
        </Section>
        <Section title={t(`settings.emails.${key}`)} className="xl:col-span-2">
          <EntityForm
            key={key}
            schema="emailTemplate"
            action={saveEmailTemplate.bind(null, key)}
            defaultValues={templates[key]}
            fields={[
              { name: "subjectAr", label: t("f.subjectAr"), required: true },
              { name: "subjectEn", label: t("f.subjectEn"), required: true, dir: "ltr" },
              { name: "bodyAr", label: t("f.bodyAr"), type: "textarea", required: true },
              { name: "bodyEn", label: t("f.bodyEn"), type: "textarea", required: true, dir: "ltr" },
            ]}
          />
        </Section>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={t("nav.settings")} />
      <Tabs base="/settings" active={tab} tabs={TABS.map((key) => ({ key, label: t(`settings.tabs.${key}`) }))} />
      {content}
    </>
  );
}
