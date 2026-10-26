# Review

## Verdict: NEEDS CHANGES

Reviewed against `docs/01-test-plan.md` and `docs/02-architecture.md`, plus the brief's hard requirements. All 6 planned test cases exist and their assertions are substantive. The main blockers are a build-risk around `Expect(...)` in `UITestBase`, which does not derive from `PageTest` as the architecture requires, and the brief's explicit requirement for base URLs via an overridden `ContextOptions`, which is not met. Neither is a difficult fix. Smaller deviations from the architecture doc are listed below.

## Strengths
- All four UI cases and both API cases are implemented, with the correct class and method groupings. Each test has a "Why essential" comment.
- The API page-2 test uses the exact constants from the brief (`Lawson`, `Ferguson`, 2, 6, 12, 2) and checks the data count against `per_page` and `total`.
- The page-2 test does per-field JSON type checks with `JsonValueKind` for the top-level fields, the `data` array, the `support` object and each user (bonus met).
- `CreateUserTests` is data-driven through `[DynamicData]` over a static method. It parses `users.csv` with CsvHelper and `CultureInfo.InvariantCulture`, and caches the parsed rows in a `Lazy`.
- The response-time limit is configurable through an environment variable and defaults to 2000 ms. Timing is measured with `Stopwatch` around the request.
- The NJsonSchema schema does not set `additionalProperties: false` (it is explicitly `true`), so it will tolerate extra fields from reqres.
- Page Objects contain no assertions. Tests decide pass/fail. No raw `Page.Locator` calls appear in test classes.
- Credentials, customer data and URLs are centralised in `Helpers/`.
- The CSS/`data-test` selectors that don't have a semantic role are isolated in Page Objects, and the reason is documented in comments.

## Issues (if any)

- [HIGH] `MoxymindTests/Helpers/UITestBase.cs` (class declaration) — `UITestBase` derives from `PlaywrightTest`, not `PageTest`, as the architecture specifies. Every UI test calls `Expect(Page)` and `Expect(locator)`, and no `using static Microsoft.Playwright.Assertions;` is present. Depending on what `PlaywrightTest` exposes in Microsoft.Playwright.MSTest 1.63, this may fail to compile. Build and confirm. The safe fix is to derive from `PageTest` (which provides `Page`, `Expect` and `ContextOptions`) and remove the manual browser/context/page setup. If you keep `PlaywrightTest`, add `using static Microsoft.Playwright.Assertions;`.

- [HIGH] `MoxymindTests/Helpers/UITestBase.cs` (`SetupAsync`) — The brief requires "Base URLs: configure per project via overridden ContextOptions in each test base class (UITestBase sets saucedemo.com ...)". The base URL is hard-coded inside `Browser.NewContextAsync` instead. Fix: `protected override BrowserNewContextOptions ContextOptions() => new() { BaseURL = "https://www.saucedemo.com", ... }` (on `PageTest`), so the default Playwright context setup picks it up.

- [MEDIUM] `MoxymindTests/Helpers/UITestBase.cs` (`TeardownAsync`) — If `SetupAsync` fails before `Page` is assigned, `TeardownAsync` throws a `NullReferenceException` on `Context.Tracing` / `Page.Video`. Also, `Page.Video!.PathAsync()` is read before the context closes, which is the correct order, but the comment claims the file name is only valid after close, which contradicts the code. Fix: guard for null, and correct the comment or move the rename after close.

- [MEDIUM] `MoxymindTests/Helpers/APITestBase.cs` (whole class) — Architecture requires `public abstract class APITestBase`, public constants (`BaseUrl`, `ApiKeyHeader`, `ApiKeyValue`, `DefaultResponseTimeLimitMs`), a static factory `CreateContextAsync(IPlaywright)`, and a `ResponseTimeLimitMs` property. None of these exist; the class is non-abstract, and the header and base URL are inline literals. Fix: add the constants, the factory, and move the response-limit property here so `CreateUserTests` does not redefine it.

- [MEDIUM] `MoxymindTests/Tests/API/CreateUserTests.cs` (`ResponseTimeLimitMs` field, `DefaultResponseTimeLimitMs` constant) — The environment variable is `API_RESPONSE_TIME_LIMIT_MS`, but the architecture specifies `MOXYMIND_API_MAX_MS`, and the default constant is duplicated in the test class rather than in the base. Fix: use the agreed variable name and define the limit once in `APITestBase`.

- [MEDIUM] `MoxymindTests/Tests/API/CreateUserTests.cs` (`CreatesUser`, `createdAt` assertion) — `DateTimeOffset.TryParse(..., InvariantCulture, ...)` is lenient and accepts many non-ISO strings (for example `"12 Jan 2025"`). The brief asks for a valid ISO timestamp. Fix: use `DateTimeOffset.TryParseExact(createdAt, "O", ...)` or assert against the ISO regex already in the schema.

- [MEDIUM] `MoxymindTests/Pages/InventoryPage.cs` (`GetDisplayedPricesAsync`) — `AllInnerTextsAsync()` does not auto-wait. Right after `SortByAsync`, the list might not be re-rendered yet, so the sort test could read stale prices. Fix: wait for the first price label to be visible, or assert the selected option first (see next item), before reading.

- [MEDIUM] `MoxymindTests/Tests/UI/InventorySortingTests.cs` (`StandardUserSortsByPriceLowToHigh`) — The test never verifies that the sort option was actually applied. If the sort silently fails, the default A–Z order may still coincidentally look sorted for some data. Fix: add an assertion that the combobox value is the "Price (low to high)" option (`lohi`) before reading prices.

- [LOW] `MoxymindTests/Helpers/ExpectedUsers.cs` — File is missing. Architecture lists it as the constants source for `ListUsersTests`. The test uses local constants instead, which the architecture permits ("or local constants"). Either add the file or update the architecture doc. Preference: add it, so the constants are reusable and match the doc.

- [LOW] `MoxymindTests/Helpers/TestLog.cs` (all methods) — Architecture says output goes through `TestContext.WriteLine`. Implementation uses `Console.WriteLine`. Both appear in MSTest output, but the architecture is explicit. Fix: switch to `TestContext.WriteLine` (requires passing context or using the inherited property) or update the architecture doc.

- [LOW] `MoxymindTests/Pages/LoginPage.cs` (`IsErrorVisibleAsync`, `GetErrorMessageAsync`, `IsOnLoginPageAsync`) and `Pages/CartPage.cs`, `Pages/CheckoutPage.cs` (`GetCompleteHeaderAsync`) — These methods are never used by any test. The locked-out test uses web-first `Expect` assertions instead of the planned `IsOnLoginPageAsync` check. Either use them or remove them to avoid dead code.

- [LOW] `MoxymindTests/Pages/LoginPage.cs`, `Pages/InventoryPage.cs`, `Pages/CheckoutPage.cs` — Public `ILocator` properties (`LoginButton`, `ErrorBanner`, `Title`, `CartBadge`, `CartItems`, `CompleteHeader`) expose selectors to tests. Tests then assert directly on those locators. This is not a raw `Page.Locator` call, but it weakens POM encapsulation; the architecture says selectors should not be repeated in tests. Consider exposing intent-based methods (`IsLockedOutErrorShownAsync`, etc.) and keeping locators private.

- [LOW] `MoxymindTests/Tests/API/CreateUserTests.cs` (`UserRow`) — Nested `internal sealed` class used by CsvHelper. CsvHelper's reflection-based mapping is safer with `public` types. Make it `public` (and keep the properties public).

- [LOW] `MoxymindTests/Schemas/CreateUserResponse.schema.json` — Architecture specifies `id` as `type: string`. Implementation allows `["string","integer"]`. This is more lenient than needed. Also `createdAt` uses a regex `pattern` instead of `format: date-time`. Both are defensible, but document the deviation or tighten to match the architecture.

- [LOW] `MoxymindTests/Tests/API/CreateUserTests.cs` (method name) — The test is named `CreatesUser`; the architecture names it `CreateUserReturns201WithIdAndIsoTimestamp`. Rename so the test name in Test Explorer describes its assertions.

- [LOW] `MoxymindTests/Helpers/Credentials.cs` (`Standard`) — Redundant alias for `StandardUser`, which is not in the architecture. Remove, or use one name consistently.

- [LOW] `MoxymindTests/Tests/UI/LoginTests.cs` (`LockedOutUserSeesErrorAndStaysOnLogin`) — Uses `Expect(...).Not.ToHaveURLAsync` for the "stays on login" check. This is correct, but the architecture asked for `IsOnLoginPageAsync()` (see unused-method item above). Consistency only.

- [INFO] `MoxymindTests/MoxymindTests.csproj` was not read as part of this review (it is not in the architecture's file list). Copy-to-output of `TestData/**` and `Schemas/**` is therefore unverified. Confirm that `TestData/users.csv` and `Schemas/CreateUserResponse.schema.json` land in `bin/.../TestData` and `bin/.../Schemas`, since the tests load them via `AppContext.BaseDirectory`.

## Coverage Matrix

| Plan Item | Implemented | File |
|-----------|-------------|------|
| UI 1 — Standard user logs in and reaches inventory | Yes | `MoxymindTests/Tests/UI/LoginTests.cs` (`StandardUserLogsInAndReachesInventory`) |
| UI 1 — "Why essential" comment | Yes | `MoxymindTests/Tests/UI/LoginTests.cs` |
| UI 2 — Locked-out user blocked with error | Yes | `MoxymindTests/Tests/UI/LoginTests.cs` (`LockedOutUserSeesErrorAndStaysOnLogin`) |
| UI 2 — Stays on login page assertion | Yes (via `Expect`, not `IsOnLoginPageAsync`) | `MoxymindTests/Tests/UI/LoginTests.cs` |
| UI 2 — "Why essential" comment | Yes | `MoxymindTests/Tests/UI/LoginTests.cs` |
| UI 3 — Add item, checkout, "Thank you" message | Yes | `MoxymindTests/Tests/UI/CheckoutTests.cs` (`StandardUserCompletesPurchaseOfOneItem`) |
| UI 3 — Customer details from helper | Yes | `MoxymindTests/Helpers/CustomerDetails.cs` |
| UI 3 — "Why essential" comment | Yes | `MoxymindTests/Tests/UI/CheckoutTests.cs` |
| UI 4 — Sort by price low to high | Yes (sort-applied check missing) | `MoxymindTests/Tests/UI/InventorySortingTests.cs` (`StandardUserSortsByPriceLowToHigh`) |
| UI 4 — "Why essential" comment | Yes | `MoxymindTests/Tests/UI/InventorySortingTests.cs` |
| UI — Credentials helper, all six users + password | Yes | `MoxymindTests/Helpers/Credentials.cs` |
| UI — `ContextOptions` base URL override (brief) | No (hard-coded in `SetupAsync`) | `MoxymindTests/Helpers/UITestBase.cs` |
| UI — Derives from `PageTest` (architecture) | No (`PlaywrightTest`) | `MoxymindTests/Helpers/UITestBase.cs` |
| API 1 — GET /api/users?page=2 returns 200 | Yes | `MoxymindTests/Tests/API/ListUsersTests.cs` |
| API 1 — `x-api-key` header on context | Yes | `MoxymindTests/Helpers/APITestBase.cs` (`InitRequest`) |
| API 1 — page / per_page / total / total_pages | Yes | `MoxymindTests/Tests/API/ListUsersTests.cs` |
| API 1 — data count consistent with per_page / total | Yes | `MoxymindTests/Tests/API/ListUsersTests.cs` |
| API 1 — `data[0].last_name` = "Lawson", `data[1].last_name` = "Ferguson" | Yes | `MoxymindTests/Tests/API/ListUsersTests.cs` |
| API 1 — Bonus: type assertions via `JsonValueKind` | Yes | `MoxymindTests/Tests/API/ListUsersTests.cs` (`AssertKind`) |
| API 1 — "Why essential" comment | Yes | `MoxymindTests/Tests/API/ListUsersTests.cs` |
| API 2 — POST /api/users data-driven from CSV | Yes | `MoxymindTests/Tests/API/CreateUserTests.cs` (`CreatesUser`, `UserRows`) |
| API 2 — `users.csv` fixture (4 rows) | Yes | `MoxymindTests/TestData/users.csv` |
| API 2 — CsvHelper with InvariantCulture | Yes | `MoxymindTests/Tests/API/CreateUserTests.cs` |
| API 2 — Status 201 | Yes | `MoxymindTests/Tests/API/CreateUserTests.cs` |
| API 2 — `id` present and non-empty | Yes | `MoxymindTests/Tests/API/CreateUserTests.cs` |
| API 2 — `createdAt` valid ISO timestamp | Partial (lenient `TryParse`) | `MoxymindTests/Tests/API/CreateUserTests.cs` |
| API 2 — Echoed name / job match input | Yes | `MoxymindTests/Tests/API/CreateUserTests.cs` |
| API 2 — Response time < configurable limit (2000 ms default) | Yes (env var name differs from architecture) | `MoxymindTests/Tests/API/CreateUserTests.cs` |
| API 2 — Bonus: NJsonSchema validation | Yes | `MoxymindTests/Tests/API/CreateUserTests.cs`, `MoxymindTests/Schemas/CreateUserResponse.schema.json` |
| API 2 — Schema without `additionalProperties: false` | Yes | `MoxymindTests/Schemas/CreateUserResponse.schema.json` |
| API 2 — "Why essential" comment | Yes | `MoxymindTests/Tests/API/CreateUserTests.cs` |
| Helpers — `APITestBase` abstract with constants and factory (architecture) | Partial | `MoxymindTests/Helpers/APITestBase.cs` |
| Helpers — `ExpectedUsers.cs` constants (architecture) | No (local constants used) | — |
| Helpers — `TestLog` shared narration helper | Yes (uses `Console.WriteLine`, not `TestContext.WriteLine`) | `MoxymindTests/Helpers/TestLog.cs` |
| Helpers — `CustomerDetails` | Yes | `MoxymindTests/Helpers/CustomerDetails.cs` |
| Page Objects — LoginPage, InventoryPage, CartPage, CheckoutPage | Yes | `MoxymindTests/Pages/*.cs` |
