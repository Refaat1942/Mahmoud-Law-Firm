import { z } from "zod";
import { zOptId, zText } from "../common";

export const messageSchema = z.object({ body: zText(5000), matterId: zOptId() });
