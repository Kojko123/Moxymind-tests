using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace MoxymindTests.Helpers;

public class APITestBase : PlaywrightTest
{
    protected IAPIRequestContext Request { get; private set; } = null!;

    [TestInitialize]
    public async Task InitRequest()
    {
        Request = await Playwright.APIRequest.NewContextAsync(new APIRequestNewContextOptions
        {
            BaseURL = "https://reqres.in",
            ExtraHTTPHeaders = new Dictionary<string, string>
            {
                ["x-api-key"] = "reqres-free-v1",
                ["Content-Type"] = "application/json",
            },
        });
    }

    [TestCleanup]
    public async Task DisposeRequest()
    {
        if (Request is not null)
        {
            await Request.DisposeAsync();
        }
    }
}
