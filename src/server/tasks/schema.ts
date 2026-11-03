import { z } from "zod";
import { zEnum, zOptDate, zOptId, zOptText, zText } from "../common";

export const taskSchema = z.object({
  title: zText(),
  description: zOptText(),
  matterId: zOptId(),
  clientId: zOptId(),
  assigneeId: zOptId(),
  priority: zEnum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: zEnum(["TODO", "IN_PROGRESS", "DONE"]),
  dueDate: zOptDate(),
  parentId: zOptId(),
});

export const commentSchema = z.object({ body: zText(5000) });
