import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

/** A simple Word document: office header, title and one paragraph per line, right-to-left for Arabic. */
export async function renderLetterDocx(input: { officeName: string; officeLine: string; title: string; body: string; rtl: boolean }) {
  const align = input.rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const run = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) => new TextRun({ text, rightToLeft: input.rtl, font: "Arial", size: opts.size ?? 24, bold: opts.bold, color: opts.color });
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: input.rtl, children: [run(input.officeName, { bold: true, size: 28, color: "1B2A4A" })] }),
          ...(input.officeLine ? [new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: input.rtl, children: [run(input.officeLine, { size: 18, color: "666666" })] })] : []),
          new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, bidirectional: input.rtl, spacing: { before: 300, after: 300 }, children: [run(input.title, { bold: true, size: 30 })] }),
          ...input.body.split(/\r?\n/).map((line) => new Paragraph({ alignment: align, bidirectional: input.rtl, spacing: { after: 120 }, children: [run(line)] })),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
