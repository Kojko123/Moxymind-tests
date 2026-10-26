/**
 * Shared System-Under-Test context, injected into every agent's instructions.
 *
 * Centralising this means a single source of truth for the brief —
 * change the SUT details here, every agent sees it.
 */

export const SUT_BRIEF = `
# Moxymind Technical Task — System Under Test brief

## Task 1 — Frontend automation (UI)
- SUT: https://www.saucedemo.com/
- Deliverable: 3-4 Playwright test cases covering main functionality
- Each test MUST include a short "why essential" justification as a comment
- Test users (password = secret_sauce for all):
    standard_user, locked_out_user, problem_user,
    performance_glitch_user, error_user, visual_user
- Must be runnable via: dotnet test --filter "FullyQualifiedName~UI"

## Task 2 — API automation (API)
- SUT: https://reqres.in/
- Deliverable: 2 Playwright test cases
- Must be runnable via: dotnet test --filter "FullyQualifiedName~API"
- NOTE: reqres.in requires header "x-api-key: reqres-free-v1"

### Test Case 1 — GET /api/users?page=2
- Assert "total" value — expected: 12
- Assert "last_name" for first and second user in "data" array —
  expected: data[0].last_name = "Lawson", data[1].last_name = "Ferguson"
  (Do NOT guess these values. Use exactly these constants in the test.)
- Expected pagination: page=2, per_page=6, total_pages=2
- Count users in "data" and compare to "total" (relative to per_page/pagination)
- BONUS: assert data types for all response fields

### Test Case 2 — POST /api/users
- Payload example: { "name": "morpheus", "job": "leader" }
- Assert HTTP code (201)
- Assert "id" exists and "createdAt" is a valid ISO timestamp
- Data-driven: input MUST come from an external file (CSV at MoxymindTests/TestData/users.csv)
- Assert response time < configurable limit (use 2000ms as default — reqres.in is a public demo API)
- BONUS: validate response schema using NJsonSchema

## Project layout (all paths relative to repo root)
- MoxymindTests/MoxymindTests.csproj   → .NET 8 MSTest project (already scaffolded, do not recreate)
- MoxymindTests/Pages/                 → Page Object classes (one .cs file per page)
- MoxymindTests/Tests/UI/              → UI test classes (one .cs file per feature)
- MoxymindTests/Tests/API/             → API test classes
- MoxymindTests/TestData/              → CSV fixtures copied to output on build
- MoxymindTests/Schemas/               → JSON schemas copied to output on build
- MoxymindTests/Helpers/               → shared constants (credentials etc.)
- docs/                                → agent-produced markdown artifacts

## Tech constraints
- Language: C# with .NET 8 (nullable enabled, implicit usings on)
- Test framework: MSTest.TestFramework 3.6 + MSTest.TestAdapter 3.6 (VSTest-compatible so Visual Studio Test Explorer discovers tests) with Microsoft.Playwright.MSTest base classes. The .csproj is already configured — do NOT change it.
- Playwright C# API: Playwright 1.63 — use PageTest / PlaywrightTest base classes,
  async Task methods, GetByRoleAsync / FillAsync / ClickAsync / etc.
- Data-driven: use [DynamicData] fed by a static method that reads
  MoxymindTests/TestData/users.csv via CsvHelper (already in NuGet)
- Schema validation: NJsonSchema (already in NuGet) — load schema from
  Path.Combine(AppContext.BaseDirectory, "Schemas", "<file>.json")
- Base URLs: configure per project via overridden ContextOptions in each test base class
  (UITestBase sets saucedemo.com, APITestBase sets reqres.in + x-api-key header)
- File naming: PascalCase for classes and files (e.g. LoginPage.cs, LoginTests.cs)
- Namespaces: MoxymindTests, MoxymindTests.Pages, MoxymindTests.Tests.UI, MoxymindTests.Tests.API, MoxymindTests.Helpers
`.trim();
