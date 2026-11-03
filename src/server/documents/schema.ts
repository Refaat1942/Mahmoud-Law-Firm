import { z } from "zod";
import { zBool, zEnum, zId, zOptId, zOptText, zTags, zText } from "../common";

export const DOCUMENT_CATEGORIES = ["MEMO", "JUDGMENT", "CONTRACT", "POWER_OF_ATTORNEY", "EVIDENCE", "CORRESPONDENCE", "ID_DOCUMENT", "OTHER"] as const;

export const documentSchema = z.object({
  name: zText(),
  matterId: zOptId(),
  clientId: zOptId(),
  folder: z.preprocess((v) => (v === "" || v === undefined ? "/" : v), z.string().trim().max(200)),
  category: zEnum([...DOCUMENT_CATEGORIES]),
  tags: zTags(),
  visibleToClient: zBool(),
});

export const templateSchema = z.object({
  name: zText(),
  category: zEnum([...DOCUMENT_CATEGORIES]),
  language: zEnum(["ar", "en"]),
  body: zText(100_000),
});

export const generateSchema = z.object({ matterId: zId(), format: zEnum(["pdf", "docx"]), saveToMatter: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()), note: zOptText() });
