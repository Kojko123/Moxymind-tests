# Test Plan

## UI Tests (saucedemo.com)
### 1. Standard user logs in and reaches the inventory
**Why essential:** Login is the gateway to every other feature. If it breaks, no customer can buy anything, so this is the first smoke check.
**Steps:**
- Open the login page.
- Sign in as `standard_user` with password `secret_sauce`.
- Confirm the inventory page loads with products listed.

### 2. Locked-out user is blocked with an error message
**Why essential:** This verifies access control. A regression here could let blocked accounts in, or leave legitimate users with no feedback.
**Steps:**
- Open the login page.
- Sign in as `locked_out_user` with password `secret_sauce`.
- Confirm the error banner says the account is locked out.
- Confirm the user remains on the login page.

### 3. Add item to cart and complete checkout
**Why essential:** This is the revenue path. It covers the cart badge, checkout form, and order confirmation together, so it catches the most business-critical failures in one run.
**Steps:**
- Sign in as `standard_user`.
- Add one product to the cart.
- Confirm the cart badge shows 1.
- Open the cart and start checkout.
- Enter sample customer details and continue.
- Finish the order and confirm the "Thank you for your order" message.

### 4. Sort products by price (low to high)
**Why essential:** Price sorting drives how customers compare and choose products. A wrong order directly affects purchasing decisions and is easy to miss without a test.
**Steps:**
- Sign in as `standard_user`.
- Select "Price (low to high)" from the sort dropdown.
- Confirm the displayed prices are in ascending order.

## API Tests (reqres.in)
### 1. GET /api/users?page=2
**Why essential:** This is the main read endpoint for paginated user data. It checks that pagination metadata and record content are correct, so consumers don't get wrong or missing users.
**Assertions:**
- Request sends header `x-api-key: reqres-free-v1` and the response is 200.
- `page` = 2, `per_page` = 6, `total` = 12, `total_pages` = 2.
- `data` contains 6 users, consistent with `per_page` and `total`.
- `data[0].last_name` = "Lawson" and `data[1].last_name` = "Ferguson" (exact constants).
- Bonus: data types are validated for all response fields.

### 2. POST /api/users (data-driven from `MoxymindTests/TestData/users.csv`)
**Why essential:** This is the main write endpoint. It confirms that records are created with the expected status, identifier, and timestamp, and that response time stays within the agreed limit.
**Assertions:**
- Response is 201 for each CSV row (for example `morpheus` / `leader`).
- `id` exists and `createdAt` is a valid ISO 8601 timestamp.
- Response time is under 2000 ms (configurable).
- Bonus: response body matches a NJsonSchema schema loaded from `Schemas/`.
