namespace MoxymindTests.Helpers;

/// <summary>
/// Single source of truth for API test narration. Output goes to the console so it shows up
/// under Test Detail Summary -> Standard Output.
/// </summary>
public static class TestLog
{
    public static void Request(string method, string path, string? body = null)
    {
        Console.WriteLine($"[API] -> {method} {path}");
        if (body is not null)
        {
            Console.WriteLine($"[API]    body: {Truncate(body)}");
        }
    }

    public static void Response(int status, long elapsedMs, string body)
    {
        Console.WriteLine($"[API] <- {status} in {elapsedMs}ms");
        Console.WriteLine($"[API]    body: {Truncate(body)}");
    }

    public static void Expect(string name, object? expected, object? actual) =>
        Console.WriteLine($"[API] expect {name}: expected={expected}, actual={actual}");

    public static void Expect(string description) =>
        Console.WriteLine($"[API] expect {description}");

    public static string Truncate(string text, int maxLength = 500) =>
        text.Length <= maxLength
            ? text
            : text[..maxLength] + $"... (truncated, {text.Length} chars total)";
}
