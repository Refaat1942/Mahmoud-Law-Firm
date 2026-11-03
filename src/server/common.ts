import { z } from "zod";

const empty = (v: unknown) => (v === "" || v === null ? undefined : v);

export const zText = (max = 300) => z.string({ required_error: "v.required" }).trim().min(1, "v.required").max(max, "v.tooLong");

export const zOptText = (max = 5000) => z.preprocess(empty, z.string().trim().max(max, "v.tooLong").optional());

export const zOptEmail = () => z.preprocess(empty, z.string().trim().toLowerCase().email("v.email").optional());

export const zEmail = () => z.string({ required_error: "v.required" }).trim().toLowerCase().min(1, "v.required").email("v.email");

export const zId = () => z.string({ required_error: "v.required" }).min(1, "v.required");

export const zOptId = () => z.preprocess(empty, z.string().optional());

const dateError: z.ZodErrorMap = (issue) => ({
  message: issue.code === "invalid_type" && issue.received === "undefined" ? "v.required" : "v.date",
});

const toDate = (v: unknown) => {
  const e = empty(v);
  if (e === undefined) return undefined;
  return e instanceof Date ? e : new Date(String(e));
};

export const zDate = () => z.preprocess(toDate, z.date({ errorMap: dateError }));

export const zOptDate = () => z.preprocess(toDate, z.date({ errorMap: dateError }).optional());

const toNumber = (v: unknown) => {
  const e = empty(v);
  if (e === undefined) return undefined;
  return typeof e === "number" ? e : Number(String(e).replace(/,/g, ""));
};

const numberError: z.ZodErrorMap = (issue) => ({
  message: issue.code === "invalid_type" && issue.received === "undefined" ? "v.required" : "v.number",
});

export const zMoney = () => z.preprocess(toNumber, z.number({ errorMap: numberError }).finite("v.number").min(0, "v.min0"));

export const zOptMoney = () => z.preprocess(toNumber, z.number({ errorMap: numberError }).finite("v.number").min(0, "v.min0").optional());

export const zInt = (min = 0) => z.preprocess(toNumber, z.number({ errorMap: numberError }).int("v.number").min(min, "v.min0"));

export const zBool = () => z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean());

export const zEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values, { errorMap: () => ({ message: "v.required" }) });

export const zTags = () =>
  z.preprocess(
    (v) =>
      Array.isArray(v)
        ? v
        : String(v ?? "")
            .split(/[,،]/)
            .map((s) => s.trim())
            .filter(Boolean),
    z.array(z.string().max(50)),
  );

// Below the 25 MB server-action and nginx body limits, leaving room for the form fields.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const firstFile = (v: unknown) => (typeof FileList !== "undefined" && v instanceof FileList ? v[0] : v);

// Duck-typed: the server runtime's File class is not always the global one.
const isFile = (v: unknown): v is File =>
  !!v && typeof v === "object" && typeof (v as File).arrayBuffer === "function" && typeof (v as File).name === "string" && (v as File).size > 0;

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/** A single uploaded file (FileList from the browser form, File on the server). */
export const zFile = () =>
  z.preprocess(firstFile, z.custom<File>(isFile, "v.required").refine((f) => f.size <= MAX_UPLOAD_BYTES, "v.fileTooLarge"));

/** An optional PDF; an empty file input counts as no file. */
export const zOptPdf = () =>
  z.preprocess(
    (v) => {
      const f = firstFile(v);
      return isFile(f) ? f : undefined;
    },
    z
      .custom<File>(isFile)
      .refine((f) => f.size <= MAX_UPLOAD_BYTES, "v.fileTooLarge")
      .refine(isPdf, "v.pdfOnly")
      .optional(),
  );
