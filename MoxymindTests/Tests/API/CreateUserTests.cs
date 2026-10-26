using Microsoft.Playwright;
using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using CsvHelper;
using CsvHelper.Configuration;
using MoxymindTests.Helpers;
using NJsonSchema;

namespace MoxymindTests.Tests.API;

[TestClass]
public class CreateUserTests : APITestBase
{
    private const int DefaultResponseTimeLimitMs = 2000;

    private static readonly int ResponseTimeLimitMs =
        int.TryParse(Environment.GetEnvironmentVariable("API_RESPONSE_TIME_LIMIT_MS"), out var limit) && limit > 0
            ? limit
            : DefaultResponseTimeLimitMs;

    // Loaded once per process, not per data-driven iteration.
    private static readonly Lazy<List<UserRow>> Rows = new(() =>
    {
        var path = Path.Combine(AppContext.BaseDirectory, "TestData", "users.csv");
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            PrepareHeaderForMatch = args => args.Header.ToLowerInvariant(),
        };
        using var reader = new StreamReader(path);
        using var csv = new CsvReader(reader, config);
        return csv.GetRecords<UserRow>().ToList();
    });

    private static readonly Lazy<JsonSchema> Schema = new(() =>
        JsonSchema.FromFileAsync(Path.Combine(AppContext.BaseDirectory, "Schemas", "CreateUserResponse.schema.json"))
            .GetAwaiter().GetResult());

    public static IEnumerable<object[]> UserRows()
    {
        foreach (var row in Rows.Value)
        {
            yield return new object[] { row.Name, row.Job };
        }
    }

    // Why essential: main write endpoint; confirms records are created with the expected
    // status, identifier, timestamp and within the agreed response time.
    [TestMethod]
    [DynamicData(nameof(UserRows), DynamicDataSourceType.Method)]
    public async Task CreatesUser(string name, string job)
    {
        var payload = JsonSerializer.Serialize(new { name, job });
        TestLog.Request("POST", "/api/users", payload);

        var sw = Stopwatch.StartNew();
        IAPIResponse response = await Request.PostAsync("/api/users", new APIRequestContextOptions { Data = payload });
        var bodyText = await response.TextAsync();
        sw.Stop();

        TestLog.Response(response.Status, sw.ElapsedMilliseconds, bodyText);

        TestLog.Expect("status", 201, response.Status);
        Assert.AreEqual(201, response.Status, $"status should be 201 but was {response.Status}");

        using var doc = JsonDocument.Parse(bodyText);
        var root = doc.RootElement;

        TestLog.Expect("id present and non-empty");
        Assert.IsTrue(root.TryGetProperty("id", out var idElement), "id should be present");
        var id = idElement.ValueKind == JsonValueKind.String ? idElement.GetString() : idElement.ToString();
        Assert.IsFalse(string.IsNullOrWhiteSpace(id), "id should be non-empty");

        TestLog.Expect("createdAt is a valid timestamp");
        Assert.IsTrue(root.TryGetProperty("createdAt", out var createdAtElement), "createdAt should be present");
        var createdAt = createdAtElement.GetString();
        Assert.IsTrue(
            DateTimeOffset.TryParse(createdAt, CultureInfo.InvariantCulture, DateTimeStyles.None, out _),
            $"createdAt '{createdAt}' should parse as a timestamp");

        TestLog.Expect("name", name, root.GetProperty("name").GetString());
        Assert.AreEqual(name, root.GetProperty("name").GetString(), "echoed name");

        TestLog.Expect("job", job, root.GetProperty("job").GetString());
        Assert.AreEqual(job, root.GetProperty("job").GetString(), "echoed job");

        TestLog.Expect($"elapsed < {ResponseTimeLimitMs}ms", ResponseTimeLimitMs, sw.ElapsedMilliseconds);
        Assert.IsTrue(
            sw.ElapsedMilliseconds < ResponseTimeLimitMs,
            $"POST /api/users took {sw.ElapsedMilliseconds}ms, limit is {ResponseTimeLimitMs}ms");

        TestLog.Expect("body matches CreateUserResponse.schema.json");
        var errors = Schema.Value.Validate(bodyText);
        Assert.AreEqual(0, errors.Count, string.Join(", ", errors));
    }

    internal sealed class UserRow
    {
        public string Name { get; set; } = "";
        public string Job { get; set; } = "";
    }
}
