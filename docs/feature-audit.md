# Feature audit — UAE law firm ERP vs. the Vision Law functional benchmark

Date: 2026-11-11. Baseline: `main` at effb65a. The Vision Law PDF was not attached to the session, so the
requirement list in the request is used as the benchmark.

Legend — status: **Done** (implemented and working), **Partial** (implemented but incomplete), **Improve**
(works but needs improvement), **Missing**. Priority: **P0** security/data integrity, **P1** essential legal
workflow, **P2** important business function, **P3** advanced/optional.

## 1. What the system already has (preserved as is)

| Area | Existing implementation |
|---|---|
| Auth & access | Credentials login, TOTP 2FA, lockout after failed attempts, 12 h JWT sessions, roles with module×action permissions, matter scope (assigned matters only) for restricted roles, portal users bound to one client |
| Audit | `defineAction` writes every create/update/delete/approve to `AuditLog` with user, IP, time; logins and failed logins logged; document downloads logged; audit viewer under Users |
| Clients & parties | Clients (individual/company, EID, TRN, phones), contacts, opponents/parties, conflict-of-interest check (Arabic-normalised), unique client codes |
| Powers of attorney | Number, notary, issue/expiry, scope, PDF attachment, expiry reminders (30 days) |
| Cases | File number + court case number, client capacity, type, level (first instance → execution), court, status/outcome/stage, parent/child (appeal/execution) links, team, parties, timeline, fee agreement & instalments |
| Hearings | Register, decision recording that schedules the next hearing, history (previous/next chain), pending-decision list, six-column roll with PDF, calendar |
| Deadlines | Presets, holiday-aware due-date calculation, reminders |
| Tasks | Assignment, priority, due dates, subtasks, comments, status, reminders, scope |
| Documents | Upload, versions, categories/folders/tags, client visibility, preview/download with access checks, templates with case/client placeholders → PDF/Word (Arabic RTL) |
| Time & fees | Time entries, approval, rate resolution |
| Billing | Tax invoices (draft → issued numbering), quotes, payments incl. cheques (cleared/bounced), credit notes, client trust, statements, PDFs (invoice/quote/receipt) |
| Accounting | Chart of accounts, automatic postings, manual journal, expenses, banks & reconciliation, trial balance, P&L, balance sheet, VAT return |
| HR | Employees, documents, attendance, leave, payroll with WPS SIF, gratuity |
| Settings | Office/TRN/VAT/logo, courts, case types, holidays, numbering (yearly, no reuse), deadline presets, email templates |
| Reports | Cases, hearings, time/productivity, revenue/collections, receivables aging |
| Portal | Client cases, hearings, issued invoices, shared documents, messaging |
| AI | OpenAI-compatible provider (key encrypted), permission-scoped tools, reminders as tasks, daily briefing, AI audit trail |
| Ops | Docker single image, daily pg_dump backup container, nginx/TLS deploy script |

## 2. Comparison matrix

### A. Dashboard
| Requirement | Status | Priority | Gap / plan |
|---|---|---|---|
| Totals, active cases, upcoming sessions, pending/overdue tasks | Done | — | — |
| Expiring powers of attorney, outstanding client payments, cases requiring attention | Missing | P2 | Add widgets (permission-aware) |
| Court updates, collection/execution stats | Missing | P2 | Comes with court updates & execution modules |
| Employee performance, financial summary | Partial (Reports, Accounting) | P3 | Link from dashboard |
| Customisable widgets | Missing | P3 | Pending |
| Mobile-responsive, role-based | Done | — | — |

### B. Modules
| # | Requirement | Status | Priority | Gap / plan |
|---|---|---|---|---|
| 1 | Contacts: clients, opponents, experts, opposing lawyers | Done | — | Parties carry roles per case |
| 1 | Duplicate detection during entry | Partial | P2 | Conflict check exists as a separate page; add warning in the client form flow (match on name/EID/licence) |
| 1 | Contact history | Partial | P3 | Timeline per case + messages; no unified per-contact history |
| 2 | PoA register, notary refs, dates, expiry reminders | Done | — | — |
| 2 | Link PoA to cases; block unverified PoA | Missing | P1 | Many-to-many PoA↔case, `verified` flag, case tab shows valid/expired PoAs and warns |
| 3 | Electronic case file, numbers, parties, court, stage, history, docs, sessions, finance | Done | — | — |
| 3 | Unified search by opponent / court reference | Partial | P2 | Global search lacks opponent name; add |
| 4 | Sessions, outcomes, next hearing, history, daily list without outcome | Done | — | — |
| 5 | Daily updates queue (pending sessions, overdue tasks/deadlines, inactive cases, by lawyer, auto-clears) | Partial | P1 | Pieces exist on separate pages; add one queue page |
| 6 | Court synchronisation (ADJD/Dubai Courts) | Missing | P2 | No official public API available to this project. Build adapter registry + court-updates inbox with manual entry/import, "from court" flag, review → apply to case, lawyer notification. Real adapters need official access |
| 7 | Tasks: assignment, due dates, subtasks, status, history | Done | — | — |
| 7 | Escalation of overdue tasks | Missing | P2 | Reminder job escalates to task creator / case lead after N days |
| 8 | Appointments & meetings (client/internal, location, language & contact preference, reminders, calendar) | Missing | P1 | New `Appointment` model, pages, calendar, reminders |
| 9 | Documents, templates, versions, Arabic/English, Arabic PDF | Done | — | Arabic PDF bidi fixes already in place |
| 9 | Edit Word inside the app | Missing | P3 | Needs an online office suite (OnlyOffice/Collabora) — pending |
| 9 | Document approval workflow | Missing | P3 | Pending |
| 10 | Legal notices: service dates, deadline calculation, delivery/acknowledgment, alerts | Missing | P1 | New `LegalNotice` model; deadline created through the existing holiday-aware calculator |
| 11 | Court requests (submitted/received, status, docs, dates, owner) | Missing | P2 | New `CourtFiling` model (direction + kind) |
| 12 | Court communications (delivery status, follow-up) | Missing | P2 | Same `CourtFiling` model, kind = communication |
| 13 | Execution management (procedures, decisions, court/office actions, attachments, collection) | Partial | P2 | Execution level exists on cases; add `ExecutionAction` log with typed actions, amounts and source |
| 14 | Tax invoices, independent yearly numbering, receipts, statements | Done | — | — |
| 14 | Payment vouchers (outgoing) | Partial | P2 | Expenses post payments; add payment-voucher PDF |
| 14 | One receipt allocated across several invoices | Missing | P1 | New `PaymentAllocation`; existing single-invoice payments kept working |
| 15 | Collections files, follow-ups, owner, reminders | Partial | P2 | Aging report exists; add follow-up log + next-action reminders |
| 16 | Engagement contracts, payment schedules, instalments | Done | — | Fee agreements + instalments |
| 16 | Overdue instalment tracking / reminders | Missing | P2 | Add to reminder job and collections page |
| 17 | Notary public transactions | Missing | P3 | Pending |
| 18 | Export to Excel/PDF | Partial | P2 | Tables export CSV only; add real XLSX, log exports in audit |
| 18 | Dynamic report builder, shared links with password/expiry/revocation/view history, background generation | Missing | P3 | Pending |
| 19 | Case/hearing/financial/workload analytics | Done | — | Reports module |
| 19 | Audit of additions, changes, deletions, logins | Done | — | — |
| 19 | Audit of exports | Missing | P2 | Add |

### C. Court execution synchronisation
| Requirement | Status | Priority | Plan |
|---|---|---|---|
| Classified execution updates (decisions/procedures/requests), attachments, travel bans, property/vehicle attachment, hearings, collections, deposits, expert reports, auctions, fees, history | Missing | P2 | `ExecutionAction` types cover each; court updates inbox applies them; follow-up tasks and lawyer notification on apply |
| Automatic retrieval | Missing | — | Requires officially authorised access; adapter interface only, clearly marked "not connected" |

### D. Finance
| Requirement | Status | Priority | Plan |
|---|---|---|---|
| Statements, invoices, receipts, expenses, cheques/bounced, reports, VAT configurable | Done | — | — |
| Multiple allocations | Missing | P1 | As above |
| Instalments linked to payments | Partial | P2 | Invoice instalments then allocate |
| Duplicate-transaction protection | Partial | P2 | Unique numbering; add duplicate-cheque-number guard per client/bank |

### E. Client portal
| Requirement | Status | Priority | Plan |
|---|---|---|---|
| Login, sessions, case status, shared docs, invoices, messages, notifications | Done | — | — |
| Account balance & payment history | Partial | P2 | Show statement |
| Upload documents into a case | Missing | P2 | Upload lands as "from client", not visible to other clients |
| Approval requests / acknowledgments | Missing | P2 | `ClientApproval` model: firm asks, client approves/declines with note |
| AI assistant in portal | Missing | P3 | Pending (needs portal-scoped tools) |

### F. AI
| Requirement | Status | Priority | Plan |
|---|---|---|---|
| Provider config, disabled by default, permission-scoped data tools, audit, no autonomous record changes except explicit reminders | Done | — | — |
| Conflict-of-interest tool | Missing | P2 | Expose existing conflict check as a tool |
| Translation, correspondence drafting, deadline-calculation assistance (with basis + lawyer verification) | Partial | P2 | Prompt modes + deadline tool using the existing calculator, results flagged "to verify" |
| Case analysis, contract review, judgment summary, document→record extraction | Missing | P3 | Needs document text extraction and an explicit "allow sending document content" switch (off by default) — pending |
| Legislation search with verified sources | Missing | P3 | Needs a licensed legislation source — pending |

### G. Notifications
| Requirement | Status | Priority | Plan |
|---|---|---|---|
| In-app + email, bilingual templates, recipient language, reminders (sessions, tasks, deadlines, PoA, documents, invoices) | Done | — | — |
| Per-user preferences, delivery history/status | Missing | P2 | Preferences per channel; delivery log |
| WhatsApp | Missing | P2 | Adapter for WhatsApp Business Cloud API; inactive until credentials are configured |
| Instalments, cheques due, inactive cases, escalation | Missing | P2 | Add to reminder job |

### H–I. Corporate legal departments, external firms, banking
Missing, P3, optional modules. Not built in this pass so the core firm workflow stays simple.

### J. Security
| Finding | Severity | Plan |
|---|---|---|
| Global search returns document names, invoice numbers and task titles outside the user's matter scope | **P0** | Apply `documentScope`, `invoiceScope`, `taskScope` |
| Client page: Invoices and Documents tabs ignore matter scope | **P0** | Apply scopes |
| Payments and Trust lists are not scoped for restricted roles holding `billing:view` | **P0** | Scope through invoice/matter |
| No IP-level rate limit on login (account lockout exists) | P1 | Per-IP throttle |
| Exports are not audited | P2 | Audit event on export |
| Dead `/api/files` signed-URL path in storage (route never created) | P3 | Leave documented; downloads go through the checked route |
| Multi-tenant isolation | N/A | Single-firm deployment |

## 3. Implementation order
1. P0 security fixes (+ login throttle, export audit, XLSX export).
2. P1 legal workflow: PoA↔case, daily updates queue, appointments, legal notices, multi-invoice receipts.
3. P2: court filings & communications, execution actions + court-updates inbox (manual, adapter-ready), collections follow-ups, instalment/escalation/inactive reminders, notification preferences + delivery log + WhatsApp adapter, portal uploads/approvals/statement, dashboard widgets, duplicate warning, search by opponent, AI conflict/deadline/drafting tools.
4. P3 stays pending and is listed in the final report.
