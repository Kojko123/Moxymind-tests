using Microsoft.Playwright;
using System.Diagnostics;
using System.Text.Json;
using MoxymindTests.Helpers;

namespace MoxymindTests.Tests.API;

[TestClass]
public class ListUsersTests : APITestBase
{
    // Constants taken verbatim from the task brief - do not change.
    private const string Page2FirstLastName = "Lawson";
    private const string Page2SecondLastName = "Ferguson";
    private const int ExpectedPage = 2;
    private const int ExpectedPerPage = 6;
    private const int ExpectedTotal = 12;
    private const int ExpectedTotalPages = 2;

    // Why essential: main read endpoint; verifies pagination metadata and record content
    // so consumers never receive wrong or missing users.
    [TestMethod]
    public async Task GetUsersPage2ReturnsPaginationAndExpectedUsers()
    {
        TestLog.Request("GET", "/api/users?page=2");

        var sw = Stopwatch.StartNew();
        IAPIResponse response = await Request.GetAsync("/api/users?page=2");
        var bodyText = await response.TextAsync();
        sw.Stop();

        TestLog.Response(response.Status, sw.ElapsedMilliseconds, bodyText);

        TestLog.Expect("status", 200, response.Status);
        Assert.AreEqual(200, response.Status, $"status should be 200 but was {response.Status}");

        using var doc = JsonDocument.Parse(bodyText);
        var root = doc.RootElement;

        // Top-level types (BONUS)
        TestLog.Expect("top-level page/per_page/total/total_pages are numbers, data is array, support is object");
        AssertKind(root, "page", JsonValueKind.Number);
        AssertKind(root, "per_page", JsonValueKind.Number);
        AssertKind(root, "total", JsonValueKind.Number);
        AssertKind(root, "total_pages", JsonValueKind.Number);
        AssertKind(root, "data", JsonValueKind.Array);
        AssertKind(root, "support", JsonValueKind.Object);

        // Pagination
        TestLog.Expect("page", ExpectedPage, root.GetProperty("page").GetInt32());
        Assert.AreEqual(ExpectedPage, root.GetProperty("page").GetInt32(), "page");

        var perPage = root.GetProperty("per_page").GetInt32();
        TestLog.Expect("per_page", ExpectedPerPage, perPage);
        Assert.AreEqual(ExpectedPerPage, perPage, "per_page");

        var total = root.GetProperty("total").GetInt32();
        TestLog.Expect("total", ExpectedTotal, total);
        Assert.AreEqual(ExpectedTotal, total, "total");

        var totalPages = root.GetProperty("total_pages").GetInt32();
        TestLog.Expect("total_pages", ExpectedTotalPages, totalPages);
        Assert.AreEqual(ExpectedTotalPages, totalPages, "total_pages");

        // Data count vs pagination
        var data = root.GetProperty("data");
        var count = data.GetArrayLength();
        var expectedCount = Math.Min(perPage, total - (ExpectedPage - 1) * perPage);
        TestLog.Expect("data.Count == min(per_page, total - (page-1)*per_page)", expectedCount, count);
        Assert.AreEqual(expectedCount, count, "data count should be consistent with pagination");
        TestLog.Expect("data.Count == per_page", perPage, count);
        Assert.AreEqual(perPage, count, "data count should equal per_page");
        TestLog.Expect("data.Count <= total", total, count);
        Assert.IsTrue(count <= total, $"data count {count} should not exceed total {total}");

        // Known users
        TestLog.Expect("data[0].last_name", Page2FirstLastName, data[0].GetProperty("last_name").GetString());
        Assert.AreEqual(Page2FirstLastName, data[0].GetProperty("last_name").GetString(), "data[0].last_name");

        TestLog.Expect("data[1].last_name", Page2SecondLastName, data[1].GetProperty("last_name").GetString());
        Assert.AreEqual(Page2SecondLastName, data[1].GetProperty("last_name").GetString(), "data[1].last_name");

        // Per-user types (BONUS) - one log line per user
        for (var i = 0; i < count; i++)
        {
            var user = data[i];
            AssertKind(user, "id", JsonValueKind.Number, $"data[{i}]");
            AssertKind(user, "email", JsonValueKind.String, $"data[{i}]");
            AssertKind(user, "first_name", JsonValueKind.String, $"data[{i}]");
            AssertKind(user, "last_name", JsonValueKind.String, $"data[{i}]");
            AssertKind(user, "avatar", JsonValueKind.String, $"data[{i}]");
            TestLog.Expect($"user[{i}] shape OK");
        }
    }

    private static void AssertKind(JsonElement parent, string property, JsonValueKind expected, string path = "root")
    {
        Assert.IsTrue(parent.TryGetProperty(property, out var value), $"{path}.{property} should exist");
        Assert.AreEqual(expected, value.ValueKind, $"{path}.{property} should be {expected} but was {value.ValueKind}");
    }
}
