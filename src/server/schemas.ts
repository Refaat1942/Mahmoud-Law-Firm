import * as users from "./users/schema";
import * as clients from "./clients/schema";
import * as matters from "./matters/schema";
import * as hearings from "./hearings/schema";
import * as tasks from "./tasks/schema";
import * as documents from "./documents/schema";
import * as time from "./time/schema";
import * as billing from "./billing/schema";
import * as accounting from "./accounting/schema";
import * as hr from "./hr/schema";
import * as settings from "./settings/schema";
import * as portal from "./portal/schema";
import * as ai from "./ai/schema";
import * as appointments from "./appointments/schema";
import * as notices from "./notices/schema";

/** Lets client forms look up a schema by key, since Zod schemas cannot be passed from server components. */
export const schemas = {
  userCreate: users.userCreateSchema,
  userUpdate: users.userUpdateSchema,
  role: users.roleSchema,
  profile: users.profileSchema,
  passwordChange: users.passwordChangeSchema,
  totp: users.totpSchema,
  client: clients.clientSchema,
  contact: clients.contactSchema,
  poa: clients.poaSchema,
  party: clients.partySchema,
  matter: matters.matterSchema,
  matterParty: matters.matterPartySchema,
  poaLink: matters.poaLinkSchema,
  member: matters.memberSchema,
  event: matters.eventSchema,
  feeAgreement: matters.feeAgreementSchema,
  installment: matters.installmentSchema,
  hearing: hearings.hearingSchema,
  decision: hearings.decisionSchema,
  deadline: hearings.deadlineSchema,
  task: tasks.taskSchema,
  comment: tasks.commentSchema,
  document: documents.documentSchema,
  documentUpload: documents.documentUploadSchema,
  documentVersion: documents.versionSchema,
  template: documents.templateSchema,
  generate: documents.generateSchema,
  timeEntry: time.timeEntrySchema,
  rate: time.rateSchema,
  invoice: billing.invoiceSchema,
  quote: billing.quoteSchema,
  line: billing.lineSchema,
  payment: billing.paymentSchema,
  creditNote: billing.creditNoteSchema,
  trust: billing.trustSchema,
  applyTrust: billing.applyTrustSchema,
  account: accounting.accountSchema,
  journal: accounting.journalSchema,
  expense: accounting.expenseSchema,
  bankAccount: accounting.bankAccountSchema,
  employee: hr.employeeSchema,
  employeeDoc: hr.employeeDocSchema,
  attendance: hr.attendanceSchema,
  leave: hr.leaveSchema,
  payroll: hr.payrollSchema,
  payrollLine: hr.payrollLineSchema,
  payPayroll: hr.payPayrollSchema,
  gratuity: hr.gratuitySchema,
  office: settings.officeSchema,
  logo: settings.logoSchema,
  court: settings.courtSchema,
  matterType: settings.matterTypeSchema,
  holiday: settings.holidaySchema,
  sequence: settings.sequenceSchema,
  preset: settings.presetSchema,
  emailTemplate: settings.emailTemplateSchema,
  message: portal.messageSchema,
  aiSettings: ai.aiSettingsSchema,
  appointment: appointments.appointmentSchema,
  notice: notices.noticeSchema,
} as const;

export type SchemaKey = keyof typeof schemas;
