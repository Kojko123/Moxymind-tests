using System.IO;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace MoxymindTests.Helpers;

public class UITestBase : PlaywrightTest
{
    // Do NOT declare TestContext — inherited from WorkerAwareTest.

    protected IBrowser Browser { get; private set; } = null!;
    protected IBrowserContext Context { get; private set; } = null!;
    protected IPage Page { get; private set; } = null!;

    [TestInitialize]
    public async Task SetupAsync()
    {
        var slowMo = int.TryParse(Environment.GetEnvironmentVariable("SLOWMO"), out var sm) ? sm : 0;
        var headless = Environment.GetEnvironmentVariable("HEADED") != "1";

        Browser = await Playwright.Chromium.LaunchAsync(new()
        {
            Headless = headless,
            SlowMo = slowMo,
        });

        Context = await Browser.NewContextAsync(new()
        {
            BaseURL = "https://www.saucedemo.com",
            RecordVideoDir = Path.Combine(AppContext.BaseDirectory, "videos"),
            RecordVideoSize = new RecordVideoSize { Width = 1280, Height = 720 },
        });

        await Context.Tracing.StartAsync(new()
        {
            Screenshots = true,
            Snapshots = true,
            Sources = true,
        });

        Page = await Context.NewPageAsync();
    }

    [TestCleanup]
    public async Task TeardownAsync()
    {
        var traceDir = Path.Combine(AppContext.BaseDirectory, "traces");
        Directory.CreateDirectory(traceDir);
        await Context.Tracing.StopAsync(new()
        {
            Path = Path.Combine(traceDir, $"{TestContext.TestName}.zip"),
        });

        // Rename the video from Playwright's hashed name to the test name BEFORE Context closes
        // (video filename is only valid after close, so we capture it then rename).
        var videoPath = await Page.Video!.PathAsync();
        await Context.CloseAsync();
        await Browser.CloseAsync();

        var videoDir = Path.Combine(AppContext.BaseDirectory, "videos");
        var renamed = Path.Combine(videoDir, $"{TestContext.TestName}.webm");
        if (File.Exists(videoPath))
        {
            if (File.Exists(renamed)) File.Delete(renamed);
            File.Move(videoPath, renamed);
        }
    }
}
