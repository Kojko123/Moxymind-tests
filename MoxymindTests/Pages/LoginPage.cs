using Microsoft.Playwright;

namespace MoxymindTests.Pages;

public class LoginPage
{
    private readonly IPage _page;

    public LoginPage(IPage page)
    {
        _page = page;
    }

    private ILocator Username => _page.GetByPlaceholder("Username");
    private ILocator Password => _page.GetByPlaceholder("Password");

    /// <summary>Exposed so tests can use web-first Expect(...) assertions.</summary>
    public ILocator LoginButton => _page.GetByRole(AriaRole.Button, new() { Name = "Login" });

    // No semantic role exists for the error banner, so data-test is used here (encapsulated).
    public ILocator ErrorBanner => _page.Locator("[data-test='error']");

    public async Task GoToAsync()
    {
        Console.WriteLine("[LoginPage] Open the login page '/'");
        await _page.GotoAsync("/");
    }

    public async Task LoginAsync(string username, string password)
    {
        Console.WriteLine($"[LoginPage] Login as '{username}'");
        await Username.FillAsync(username);
        await Password.FillAsync(password);
        await LoginButton.ClickAsync();
    }

    public async Task<string> GetErrorMessageAsync()
    {
        Console.WriteLine("[LoginPage] Read the error banner text");
        var text = await ErrorBanner.InnerTextAsync();
        return text.Trim();
    }

    public async Task<bool> IsErrorVisibleAsync()
    {
        Console.WriteLine("[LoginPage] Check whether the error banner is visible");
        return await ErrorBanner.IsVisibleAsync();
    }

    public async Task<bool> IsOnLoginPageAsync()
    {
        Console.WriteLine("[LoginPage] Check whether the login button is visible");
        return await LoginButton.IsVisibleAsync();
    }
}
