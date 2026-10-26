# Architecture

Source: `docs/01-test-plan.md` (4 UI tests, 2 API tests).
Stack: C# / .NET 8, MSTest 3.6 (TestFramework + TestAdapter), Microsoft.Playwright.MSTest 1.63, CsvHelper, NJsonSchema.
Run commands: `dotnet test --filter "FullyQualifiedName~UI"` and `dotnet test --filter "FullyQualifiedName~API"`.

Namespaces follow the folder layout: `MoxymindTests`, `MoxymindTests.Pages`, `MoxymindTests.Tests.UI`, `MoxymindTests.Tests.API`, `MoxymindTests.Helpers`.

---

## Base Classes (MoxymindTests/Helpers/)

### UITestBase.cs
- Namespace: `MoxymindTests.Helpers`
- `public abstract class UITestBase : PageTest`
- Overrides `ContextOptions()` to return the base options with `BaseURL = "https://www.saucedemo.com"`.
- No other shared UI state. Page Objects are created per test method from `Page`.

### APITestBase.cs
- Namespace: `MoxymindTests.Helpers`
- `public abstract class APITestBase : PlaywrightTest`
- Constants:
  - `BaseUrl = "https://reqres.in"`
  - `ApiKeyHeader = "x-api-key"`, `ApiKeyValue = "reqres-free-v1"`
  - `DefaultResponseTimeLimitMs = 2000`
- Static factory: `public static async Task<IAPIRequestContext> CreateContextAsync(IPlaywright playwright)`
  - Calls `playwright.APIRequest.NewContextAsync(new APIRequestNewContextOptions { BaseURL = BaseUrl, ExtraHTTPHeaders = new Dictionary<string, string> { { "x-api-key", "reqres-free-v1" } } })`.
- Response time limit: `protected static int ResponseTimeLimitMs` reads environment variable `MOXYMIND_API_MAX_MS` if set and valid, otherwise `2000`. This is the "configurable limit".
- Each test creates its context in a `[TestInitialize]` (or inside the test) and disposes it in `[TestCleanup]`. The factory is the only place the header is set.

---

## Page Objects (MoxymindTests/Pages/)

All Page Objects take `IPage` in the constructor and store it. All methods are `async Task`. No assertions inside Page Objects; they only act and expose read-only query methods. Assertions live in tests.

Selector note: saucedemo uses `data-test` attributes. Where semantic locators don't fit (error banner, cart badge, price labels, product list), `Page.Locator("[data-test='...']")` or a class selector is used. The `data-test` usage is limited to those elements and is wrapped in a private property so it is not repeated in tests.

### LoginPage
- File: `MoxymindTests/Pages/LoginPage.cs`
- Class: `LoginPage`
- Methods:
  - `Task GoToAsync()` - `Page.GotoAsync("/")`
  - `Task LoginAsync(string username, string password)` - fills username, fills password, clicks login
  - `Task<string> GetErrorMessageAsync()` - returns trimmed inner text of error banner
  - `Task<bool> IsErrorVisibleAsync()`
  - `Task<bool> IsOnLoginPageAsync()` - login button visible
- Key selectors:
  - Username: `Page.GetByPlaceholder("Username")`
  - Password: `Page.GetByPlaceholder("Password")`
  - Login button: `Page.GetByRole(AriaRole.Button, new() { Name = "Login" })`
  - Error banner: `Page.Locator("[data-test='error']")` (no semantic role exists for this element)

### InventoryPage
- File: `MoxymindTests/Pages/InventoryPage.cs`
- Class: `InventoryPage`
- Methods:
  - `Task<bool> IsLoadedAsync()` - title "Products" heading visible and at least one item present
  - `Task<int> GetProductCountAsync()`
  - `Task AddFirstProductToCartAsync()` - clicks first "Add to cart" button
  - `Task<string> GetCartBadgeTextAsync()` - returns "" when badge absent
  - `Task SortByAsync(string optionLabel)` - selects option in sort dropdown (e.g. `"Price (low to high)"`)
  - `Task<IReadOnlyList<decimal>> GetDisplayedPricesAsync()` - parses `$` values from price labels
  - `Task OpenCartAsync()` - clicks cart link
- Key selectors:
  - Title: `Page.GetByRole(AriaRole.Heading, new() { Name = "Products" })`
  - Sort dropdown: `Page.GetByRole(AriaRole.Combobox)` (single combobox on page)
  - Add to cart: `Page.GetByRole(AriaRole.Button, new() { Name = "Add to cart" })`
  - Item container: `Page.Locator(".inventory_item")`
  - Price label: `Page.Locator(".inventory_item_price")`
  - Cart link: `Page.Locator(".shopping_cart_link")` (no semantic name; accessible name varies)
  - Cart badge: `Page.Locator(".shopping_cart_badge")`

### CartPage
- File: `MoxymindTests/Pages/CartPage.cs`
- Class: `CartPage`
- Methods:
  - `Task<int> GetItemCountAsync()`
  - `Task StartCheckoutAsync()` - clicks "Checkout"
- Key selectors:
  - Checkout button: `Page.GetByRole(AriaRole.Button, new() { Name = "Checkout" })`
  - Cart items: `Page.Locator(".cart_item")`

### CheckoutPage
Covers all three checkout steps (information, overview, complete) because they share one flow and the test plan only needs their outcome. Keeps the step count low without losing assertions.
- File: `MoxymindTests/Pages/CheckoutPage.cs`
- Class: `CheckoutPage`
- Methods:
  - `Task FillCustomerInformationAsync(string firstName, string lastName, string postalCode)`
  - `Task ContinueAsync()` - clicks "Continue"
  - `Task FinishAsync()` - clicks "Finish"
  - `Task<string> GetCompleteHeaderAsync()` - returns trimmed text of complete heading (`"Thank you for your order!"`)
- Key selectors:
  - First name: `Page.GetByPlaceholder("First Name")`
  - Last name: `Page.GetByPlaceholder("Last Name")`
  - Postal code: `Page.GetByPlaceholder("Zip/Postal Code")`
  - Continue: `Page.GetByRole(AriaRole.Button, new() { Name = "Continue" })`
  - Finish: `Page.GetByRole(AriaRole.Button, new() { Name = "Finish" })`
  - Complete header: `Page.GetByRole(AriaRole.Heading, new() { Name = "Thank you for your order!" })` for the assertion target; text read via `Page.Locator(".complete-header")` fallback if role lookup is unstable.

---

## UI Test Classes (MoxymindTests/Tests/UI/)

### LoginTests
- File: `MoxymindTests/Tests/UI/LoginTests.cs`
- `[TestClass] public class LoginTests : UITestBase`
- Page Objects: `LoginPage`, `InventoryPage`
- `[TestMethod] public async Task StandardUserLogsInAndReachesInventory()` - plan case 1
  - Credentials from `Credentials.StandardUser` / `Credentials.Password`
  - Asserts: `InventoryPage.IsLoadedAsync()` true and product count > 0; URL contains `/inventory.html`
- `[TestMethod] public async Task LockedOutUserSeesErrorAndStaysOnLogin()` - plan case 2
  - Credentials from `Credentials.LockedOutUser` / `Credentials.Password`
  - Asserts: error text contains `"Sorry, this user has been locked out."`; error visible; `LoginPage.IsOnLoginPageAsync()` true; URL does not contain `/inventory.html`

### CheckoutTests
- File: `MoxymindTests/Tests/UI/CheckoutTests.cs`
- `[TestClass] public class CheckoutTests : UITestBase`
- Page Objects: `LoginPage`, `InventoryPage`, `CartPage`, `CheckoutPage`
- `[TestMethod] public async Task StandardUserCompletesPurchaseOfOneItem()` - plan case 3
  - Sign in via `LoginPage` as standard user
  - Asserts: cart badge text == `"1"` after add; `CartPage.GetItemCountAsync()` == 1; `CheckoutPage.GetCompleteHeaderAsync()` == `"Thank you for your order!"`
  - Customer details from `CustomerDetails` (see Helpers)

### InventorySortingTests
- File: `MoxymindTests/Tests/UI/InventorySortingTests.cs`
- `[TestClass] public class InventorySortingTests : UITestBase`
- Page Objects: `LoginPage`, `InventoryPage`
- `[TestMethod] public async Task StandardUserSortsByPriceLowToHigh()` - plan case 4
  - Sign in, `SortByAsync("Price (low to high)")`
  - Asserts: `GetDisplayedPricesAsync()` is non-empty and equals the same list sorted ascending (`Assert.AreEqual` on sequence, or `CollectionAssert.AreEqual`)

Each UI test method has a comment above it with the "why essential" line from the plan (required by Task 1).

---

## API Test Classes (MoxymindTests/Tests/API/)

### ListUsersTests
- File: `MoxymindTests/Tests/API/ListUsersTests.cs`
- `[TestClass] public class ListUsersTests : APITestBase`
- `[TestMethod] public async Task GetUsersPage2ReturnsPaginationAndExpectedUsers()`
  - `GET /api/users?page=2` through the shared context from `APITestBase.CreateContextAsync`
  - Asserts:
    - status 200 and `x-api-key` was sent (verified by 200; header set on context)
    - `page` == 2, `per_page` == 6, `total` == 12, `total_pages` == 2
    - `data.Count` == `per_page` (6), and `data.Count` consistent with `total` for page 2 (`total - (page-1)*per_page` == 6)
    - `data[0].last_name` == `"Lawson"`, `data[1].last_name` == `"Ferguson"` (exact constants from `Helpers/ExpectedUsers.cs` or local constants; not guessed)
    - BONUS type check: `id` is number, `email`/`first_name`/`last_name`/`avatar` are strings for every element; top-level `page`/`per_page`/`total`/`total_pages` are numbers; `data` is array; `support` is object
  - Uses `System.Text.Json` `JsonDocument` for typed assertions.

### CreateUserTests
- File: `MoxymindTests/Tests/API/CreateUserTests.cs`
- `[TestClass] public class CreateUserTests : APITestBase`
- Data source: `MoxymindTests/TestData/users.csv` (columns `name,job`), loaded by a static method using CsvHelper.
- `public static IEnumerable<object[]> UserRows()` - reads file from `Path.Combine(AppContext.BaseDirectory, "TestData", "users.csv")`, yields `new object[] { name, job }`.
- `[TestMethod]` with `[DynamicData(nameof(UserRows), DynamicDataSourceType.Method)]`
- `public async Task CreateUserReturns201WithIdAndIsoTimestamp(string name, string job)`
  - `POST /api/users` with `{ name, job }`
  - Asserts:
    - status 201
    - `id` present and non-empty (reqres returns it as a string)
    - `createdAt` parses as ISO 8601 with `DateTimeOffset.TryParse` / `DateTime.TryParseExact` using `"o"` style
    - response elapsed time < `ResponseTimeLimitMs` (2000 ms default)
    - echoed `name` == input `name`, `job` == input `job`
    - BONUS: response body validates against `Schemas/CreateUserResponse.schema.json` via NJsonSchema (`JsonSchema.FromFileAsync`, `Validate`) and returns zero errors
- Schema path: `Path.Combine(AppContext.BaseDirectory, "Schemas", "CreateUserResponse.schema.json")`
- Elapsed time: measured with `Stopwatch` around the request call; reported through `TestLog.Response`.
- Each data row becomes its own test instance in Test Explorer (DynamicData).

---

## Helpers (MoxymindTests/Helpers/)

### Credentials.cs
- `public static class Credentials`
- Constants:
  - `Password = "secret_sauce"`
  - `StandardUser = "standard_user"`
  - `LockedOutUser = "locked_out_user"`
  - `ProblemUser = "problem_user"`
  - `PerformanceGlitchUser = "performance_glitch_user"`
  - `ErrorUser = "error_user"`
  - `VisualUser = "visual_user"`
- No other tests inline these strings.

### CustomerDetails.cs
- `public static class CustomerDetails`
- Constants: `FirstName = "Jane"`, `LastName = "Tester"`, `PostalCode = "12345"`
- Used by checkout test. Kept separate from `Credentials` because it is checkout data, not auth.

### ExpectedUsers.cs
- `public static class ExpectedUsers`
- Constants used by `ListUsersTests`: `Page2FirstLastName = "Lawson"`, `Page2SecondLastName = "Ferguson"`, `Page2Total = 12`, `Page2PerPage = 6`, `Page2TotalPages = 2`.
- Values are taken from the task brief and must not be changed by Dev agents.

### TestLog.cs
- `public static class TestLog`
- Single source of truth for API narration. API tests must use this and must not define their own truncate or log helpers.
- Methods:
  - `Request(string method, string path, string? body = null)` - writes `-> METHOD path` and truncated body
  - `Response(int status, long elapsedMs, string body)` - writes `<- status (elapsed ms)` and truncated body
  - `Expect(string name, object? expected, object? actual)` - writes `expect name: expected=..., actual=...`
  - `Truncate(string text, int maxLength = 500)` - returns text capped with `...` suffix when longer
- Output via `TestContext.WriteLine` so it appears in the MSTest result.

---

## Fixtures / Data (MoxymindTests/TestData/ and MoxymindTests/Schemas/)

### MoxymindTests/TestData/users.csv
- Header: `name,job`
- Rows (4):
  - `morpheus,leader`
  - `neo,the one`
  - `trinity,hacker`
  - `oracle,guide`
- Copied to output on build (as already configured in csproj).

### MoxymindTests/Schemas/CreateUserResponse.schema.json
- JSON Schema draft-07.
- `type: object`
- `required`: `["id", "name", "job", "createdAt"]`
- Properties:
  - `id`: `type: string` (reqres returns a string id for POST)
  - `name`: `type: string`
  - `job`: `type: string`
  - `createdAt`: `type: string`, `format: date-time`
- Do NOT set `"additionalProperties": false`. reqres may add fields (for example `support`, `_meta`), and strict schemas would break the suite on API growth.
- Copied to output on build (as already configured in csproj).

---

## Cross-cutting decisions

- Assertions: MSTest `Assert` / `StringAssert` / `CollectionAssert` only. No FluentAssertions (not in csproj).
- Page Objects return data; tests decide pass/fail.
- Test isolation: each UI test gets a fresh browser context from `PageTest`. Each API test gets a fresh `IAPIRequestContext`.
- No shared mutable state between tests. The CSV is read once per discovery.
- Credentials and URLs live only in `Helpers/`.
- Dev agents must not create or edit `.csproj` files.
