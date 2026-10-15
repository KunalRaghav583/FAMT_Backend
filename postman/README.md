# FAMT Postman Collection Guide

This directory contains the official Postman collection and environment files for the Field Asset Maintenance Tracker (FAMT) Backend API.

## Files

1. `FAMT_Backend.postman_collection.json` — Comprehensive collection (v2.1.0) covering all 24 endpoint operations.
2. `FAMT_Local.postman_environment.json` — Pre-configured local environment with variables for local testing (`http://localhost:5000`).

## How to Import

1. Open **Postman**.
2. Click **Import** (top left).
3. Drag and drop both `FAMT_Backend.postman_collection.json` and `FAMT_Local.postman_environment.json`.
4. In the top right corner of Postman, switch the active environment dropdown to **FAMT Local Environment**.

## Automated Token & ID Chaining

The collection includes Postman test scripts that automatically capture and persist IDs and tokens across requests:

- **`Login Admin`** sets `adminToken` and sets the active `token` to the admin token.
- **`Login Technician`** sets `techToken` and sets `assigneeId`.
- **`Login Viewer`** sets `viewerToken`.
- **`List Sites`** extracts the first site's UUID to `siteId`.
- **`Create Site`** extracts the new site's UUID to `createdSiteId`.
- **`List Assets`** extracts the first asset's UUID to `assetId`.
- **`Create Asset`** extracts the new asset's UUID to `createdAssetId`.
- **`List Tickets`** extracts the first ticket's UUID to `ticketId`.
- **`Create Ticket`** extracts the new ticket's UUID to `createdTicketId`.

## Recommended Execution Order

For an end-to-end automated walkthrough:

1. `01. Authentication` -> `Login Admin`
2. `01. Authentication` -> `Login Technician`
3. `01. Authentication` -> `Login Viewer`
4. `01. Authentication` -> `Get Current User Profile (/me)`
5. `02. Sites` -> `List Sites`
6. `02. Sites` -> `Get Site by ID`
7. `02. Sites` -> `Create Site (Admin Only)`
8. `02. Sites` -> `Update Site (Admin Only)`
9. `02. Sites` -> `Delete Site with Assets (Should Fail 400)`
10. `02. Sites` -> `Delete Created Site (Admin Only - Empty)`
11. `03. Assets` -> `List Assets (Default Pagination)`
12. `03. Assets` -> `List Assets (Search & Status Filter)`
13. `03. Assets` -> `List Assets (Filter by Site ID)`
14. `03. Assets` -> `List Assets (Pagination Page 2 Limit 5)`
15. `03. Assets` -> `Get Asset by ID`
16. `03. Assets` -> `Create Asset (Admin Only)`
17. `03. Assets` -> `Update Asset (Admin Only)`
18. `03. Assets` -> `Delete Asset with Tickets (Should Fail 400)`
19. `03. Assets` -> `Delete Created Asset (Admin Only - Without Tickets)`
20. `04. Tickets` -> `List Tickets (Default Pagination)`
21. `04. Tickets` -> `List Tickets (Filter by Status & Priority)`
22. `04. Tickets` -> `Get Ticket by ID`
23. `04. Tickets` -> `Create Ticket (Any Authenticated User)`
24. `04. Tickets` -> `Update Ticket Details (Assigned Tech or Admin)`
25. `04. Tickets` -> `Update Status: Open -> In progress (Tech/Admin)`
26. `04. Tickets` -> `Update Status: In progress -> Resolved (Tech/Admin)`
27. `04. Tickets` -> `Update Status: Resolved -> Closed (Admin Only)`
28. `04. Tickets` -> `Technician Reopen Closed Ticket (Should Fail 403)`
29. `04. Tickets` -> `Admin Reopen Closed Ticket (Admin Allowed)`
30. `05. Comments` -> `List Comments for Ticket`
31. `05. Comments` -> `Add Comment to Ticket`
32. `06. Dashboard Summary` -> `Get Dashboard Summary Metrics`
33. `07. Health & System` -> `System Health Check`
34. `07. Health & System` -> `Test Admin Access Endpoint`
35. `01. Authentication` -> `Logout`
