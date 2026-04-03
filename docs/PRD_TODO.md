# PRD Delivery TODO

## Source Of Truth
- [x] Added PRD working copy: `docs/PRD_WORKING_COPY.md`

## Backend API Contract Alignment
- [x] Add `POST /api/auth/logout`
- [x] Add `POST /api/auth/refresh`
- [x] Add PRD-compatible citizen aliases:
  - [x] `POST /api/complaints`
  - [x] `GET /api/complaints/my`
  - [x] `GET /api/complaints/:id`
  - [x] `GET /api/complaints/:id/status`
- [x] Add PRD-compatible project assign route:
  - [x] `PATCH /api/projects/:id/assign`
- [x] Add PRD-compatible region monitor route:
  - [x] `POST /api/region/projects/:id/monitor`

## Frontend PRD Coverage
- [ ] Add role pages for full PRD operations (citizen/admin/ministry/approval/contractor/region) - in progress
- [ ] Expose all operational pages in app routing and sidebar
- [ ] Connect all page actions to live backend APIs
- [ ] Add loading/error/empty states for each role workflow

## Data & Validation
- [ ] Validate all required request payloads against PRD fields
- [ ] Standardize response shapes where frontend expects stable structures
- [ ] Add missing DB constraints/indexes if required by flow correctness

## Verification
- [ ] Backend smoke test for each role flow
- [ ] Frontend build + manual journey tests by role
- [ ] Update docs to reflect final MySQL-first contract and routes
