"use client";

import { useState, useTransition } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { schemas, type SchemaKey } from "@/server/schemas";
import type { ActionResult } from "@/lib/action";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input, Label, Select, Textarea } from "./ui/input";

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "password"
  | "number"
  | "money"
  | "date"
  | "datetime"
  | "time"
  | "textarea"
  | "select"
  | "checkbox"
  | "tags"
  | "file"
  | "multiselect";

export type Field = {
  name: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** Number of grid columns to span (out of `columns`). */
  span?: number;
  /** Shows the field only when another field has one of the given values. */
  showIf?: { field: string; values: string[] };
  dir?: "rtl" | "ltr";
};

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function prepareDefaults(fields: Field[], values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (v === null || v === undefined) out[f.name] = f.type === "checkbox" ? false : f.type === "multiselect" ? [] : "";
    else if (f.type === "date") out[f.name] = String(v).slice(0, 10);
    else if (f.type === "datetime") out[f.name] = toLocalInput(String(v));
    else if (f.type === "tags") out[f.name] = Array.isArray(v) ? v.join(", ") : String(v);
    else if (f.type === "file") out[f.name] = undefined;
    else if (f.type === "multiselect") out[f.name] = Array.isArray(v) ? v : [String(v)];
    else out[f.name] = typeof v === "number" ? String(v) : v;
  }
  return out;
}

export function EntityForm({
  fields,
  schema,
  action,
  defaultValues = {},
  submitLabel,
  redirectTo,
  columns = 2,
  resetOnSuccess,
  onSuccess,
  compact,
}: {
  fields: Field[];
  schema: SchemaKey;
  action: (values: unknown) => Promise<ActionResult>;
  defaultValues?: Record<string, unknown>;
  submitLabel?: string;
  /** Path to open after saving; `:id` is replaced with the saved record id. */
  redirectTo?: string;
  columns?: 1 | 2 | 3 | 4;
  resetOnSuccess?: boolean;
  onSuccess?: (res: ActionResult) => void;
  compact?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const initial = prepareDefaults(fields, defaultValues);
  const form = useForm<FieldValues>({
    resolver: zodResolver(schemas[schema] as never) as Resolver<FieldValues>,
    defaultValues: initial,
    mode: "onTouched",
  });
  const { register, handleSubmit, formState, setError, watch, reset } = form;

  const submit = handleSubmit((values) => {
    setFormError(null);
    const data: Record<string, unknown> = { ...values };
    for (const f of fields) {
      if (f.type === "datetime" && data[f.name]) data[f.name] = new Date(String(data[f.name])).toISOString();
    }
    // Forms with a file field are sent as FormData, which server actions accept natively.
    let payload: unknown = data;
    if (fields.some((f) => f.type === "file")) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(data)) {
        if (v === undefined || v === null) continue;
        // The Zod resolver may already have turned the FileList into a File.
        if (v instanceof Blob) fd.append(k, v);
        else if (typeof FileList !== "undefined" && v instanceof FileList) {
          if (v[0]) fd.append(k, v[0]);
        } else fd.append(k, String(v));
      }
      payload = fd;
    }
    startTransition(async () => {
      const res = await action(payload);
      if (!res.ok) {
        if (res.fieldErrors) for (const [name, msg] of Object.entries(res.fieldErrors)) setError(name, { message: msg });
        setFormError(res.error);
        toast.error(t(res.error));
        return;
      }
      toast.success(t("common.saved"));
      if (resetOnSuccess) reset(initial);
      onSuccess?.(res);
      if (redirectTo) router.push(redirectTo.replace(":id", res.id ?? ""));
      else router.refresh();
    });
  });

  const gridCols = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" }[columns];

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className={cn("grid grid-cols-1 gap-4", gridCols)}>
        {fields.map((f) => {
          if (f.showIf && !f.showIf.values.includes(String(watch(f.showIf.field) ?? ""))) return null;
          const err = formState.errors[f.name]?.message as string | undefined;
          const id = `f-${f.name}`;
          const common = { id, "aria-invalid": !!err, ...register(f.name) };
          const span = f.span ? { gridColumn: `span ${Math.min(f.span, columns)} / span ${Math.min(f.span, columns)}` } : undefined;
          return (
            <div key={f.name} className={cn("space-y-1.5", f.type === "textarea" && !f.span && "md:col-span-full")} style={span}>
              {f.type === "checkbox" ? (
                <label className="flex items-center gap-2 pt-6 text-sm">
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" {...common} />
                  {f.label}
                </label>
              ) : (
                <>
                  <Label htmlFor={id}>
                    {f.label}
                    {f.required && <span className="ms-0.5 text-destructive">*</span>}
                  </Label>
                  {f.type === "textarea" ? (
                    <Textarea {...common} placeholder={f.placeholder} dir={f.dir} rows={compact ? 2 : 4} />
                  ) : f.type === "select" ? (
                    <Select {...common}>
                      <option value="">{f.placeholder ?? t("common.select")}</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : f.type === "multiselect" ? (
                    <Select {...common} multiple size={Math.min(6, Math.max(3, f.options?.length ?? 3))} className="h-auto">
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : f.type === "file" ? (
                    <Input {...common} type="file" className="cursor-pointer file:me-3 file:border-0 file:bg-transparent file:text-sm file:font-medium" />
                  ) : (
                    <Input
                      {...common}
                      dir={f.dir ?? (["email", "tel", "number", "money"].includes(f.type ?? "") ? "ltr" : undefined)}
                      placeholder={f.placeholder}
                      type={
                        f.type === "money" || f.type === "number"
                          ? "number"
                          : f.type === "datetime"
                            ? "datetime-local"
                            : f.type === "tags"
                              ? "text"
                              : (f.type ?? "text")
                      }
                      step={f.type === "money" ? "0.01" : f.type === "number" ? "any" : undefined}
                    />
                  )}
                </>
              )}
              {err ? <p className="text-xs text-destructive">{t(err)}</p> : f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
            </div>
          );
        })}
      </div>
      {formError && formError !== "errors.validation" && <p className="text-sm text-destructive">{t(formError)}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : (submitLabel ?? t("common.save"))}
        </Button>
      </div>
    </form>
  );
}
