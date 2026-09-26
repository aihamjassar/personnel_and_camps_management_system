# Local browser verification notes

**Source URL:** http://localhost:5173/ (redirected to `/login`)  
**Observed title:** نظام إدارة الأفراد والمعسكرات  
**Observed on:** 2026-09-26

The login screen rendered in Arabic with `lang="ar"` and RTL flow. It includes labeled username and password fields, a submit action, localized error/notice region, academic-use disclaimer, and a desktop split-panel layout. The browser extracted the visible Arabic title, login prompt, two form labels, submit button, and fake-data warning. Next manual interaction check: authenticate as the seeded local admin, verify dashboard and core CRUD screens, and watch console/network errors.

## Successful session smoke test

The seeded development administrator authenticated through the login form and was redirected to `/app/dashboard`. The browser showed the authenticated username and role, a role-filtered navigation sidebar, live zero-state dashboard metrics, Arabic numeral formatting, and clear no-data/academic-scope messaging. No blank-screen or client-side exception appeared. Further checks will exercise reference-data creation, personnel forms/history, assignments, and user screens using explicitly fictional sample values.

The camp screen loaded through the administrator navigation and rendered a two-row table from the local seed (`North Camp` / `Sector A` / capacity 500 and `South Camp` / `Sector B` / capacity 300). The Arabic page title, search input, add action, and edit controls were visible. These are local demo records, not real operational data.

Creating a local `Sandbox Demo Camp` (location `Fictional test sector`, capacity 42) succeeded. The modal closed, a localized success notice appeared, and the refreshed table showed three rows including the new test record. This confirms the camp form → API → database → list refresh path; the test record exists only in the sandbox's local development database.

The units screen rendered three seeded fictional organizations and resolved the associated camp labels. The live navigation pass caught that the previous camp-success toast persisted when switching between reference modules (same reusable component instance); the page now resets transient search/modal/success state when the module changes.

The unit form fetched the available camp options and saved `Sandbox Training Unit` under `Sandbox Demo Camp`. The success toast appeared and the updated four-row table showed the correct parent camp label.

The ranks screen displays the four seeded fictional rank levels (Captain, Lieutenant, Sergeant, Private), ascending by level, with working localized list/search/edit controls.

The positions screen successfully loaded three seeded entries (Administrative Officer, Company Commander, Platoon Leader) and rendered the Arabic list/search/edit layout. The units association column is currently blank for these seed rows, which is valid because the model permits optional units.

Assignments loaded successfully through its protected route. With no local assignment records, the screen displayed its contextual empty state, separate total/current counters, and create action rather than a blank/error screen.

Using clearly synthetic values (Alex Sandbox / DEMO-ID-001 / example.com / synthetic phone, linked to Sandbox Demo Camp and Sandbox Training Unit) created a person successfully. The API returned the expected success notice and the list refreshed with correct linked labels, rank and active status. The initial status history was created as part of the workflow.

The personnel status-history dialog fetched and displayed the initial `active` event with its localized date, confirming the read endpoint, modal, and append-only history presentation.

After local sample creation, the dashboard refreshed to 1 total/active person, 1 registered camp, capacity 42 with 1 person assigned, and 1 Captain. The summary values and derived capacity percentage were consistent with the inserted fictional data.

A status transition to `on_leave` with a fictional note was submitted after checking the new explicit acknowledgement box. It completed without the previous browser-native confirmation stall, displayed a success notice, and refreshed the person row to “في إجازة”.

The history was reopened after the update and displayed two separate records in reverse chronological order: the new on-leave transition and the original active event. The original was not overwritten.

The assignment form populated the synthetic person, unit, and seeded position selectors. Saving an assignment dated 2026-09-26 succeeded; the list shows the linked person/unit/position, localized date, and one current assignment. A native browser date control required locale-formatted input (`09/26/2026`) during the smoke test; a blank/partial date is rejected by the browser before submission.

The users screen loaded with the local seed administrator and four predefined roles. Its copy explicitly states passwords/hashes are not displayed; the table contains only username/profile, email, role, active status, and an edit action.

A synthetic `demo_viewer` account with only the Report Viewer role was created successfully through the UI. The users list refreshed to two accounts, showed the selected role and status, and did not expose the password.

The report-only account authenticated successfully and received a dashboard-only sidebar (plus logout); personnel, camps, reference data, assignments, and user administration were absent from its visible navigation. The dashboard correctly reflected the updated inactive/on-leave sample status counts.

Opening `/app/personnel` directly as the report-only user displayed the explicit no-permission state instead of the protected page, confirming the client route guard complements backend authorization.
