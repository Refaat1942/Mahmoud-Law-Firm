import { z } from "zod";
import { zEnum, zFile, zOptId, zOptText, zText } from "../common";

export const messageSchema = z.object({ body: zText(5000), matterId: zOptId() });

/** Staff ask a client to approve or acknowledge something through the portal. */
export const approvalRequestSchema = z.object({ title: zText(300), details: zOptText(5000), matterId: zOptId() });

/** The client's answer to an approval request. */
export const approvalResponseSchema = z.object({ status: zEnum(["APPROVED", "DECLINED"]), response: zOptText(2000) });

/** A file the client sends to the office from the portal. */
export const portalUploadSchema = z.object({ file: zFile(), name: zOptText(200), matterId: zOptId() });
