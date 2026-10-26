using Microsoft.Playwright;

namespace MoxymindTests.Pages;

/// <summary>Covers all three checkout steps: information, overview and complete.</summary>
public class CheckoutPage
{
    private readonly IPage _page;

    public CheckoutPage(IPage page)
    {
        _page = page;
    }

    public ILocator CompleteHeader =>
        _page.GetByRole(AriaRole.Heading, new() { Name = "Thank you for your order!" });

    private ILocator FirstName => _page.GetByPlaceholder("First Name");
    private ILocator LastName => _page.GetByPlaceholder("Last Name");
    private ILocator PostalCode => _page.GetByPlaceholder("Zip/Postal Code");
    private ILocator ContinueButton => _page.GetByRole(AriaRole.Button, new() { Name = "Continue" });
    private ILocator FinishButton => _page.GetByRole(AriaRole.Button, new() { Name = "Finish" });

    public async Task FillCustomerInformationAsync(string firstName, string lastName, string postalCode)
    {
        Console.WriteLine($"[CheckoutPage] Fill customer information: {firstName} {lastName}, {postalCode}");
        await FirstName.FillAsync(firstName);
        await LastName.FillAsync(lastName);
        await PostalCode.FillAsync(postalCode);
    }

    public async Task ContinueAsync()
    {
        Console.WriteLine("[CheckoutPage] Click Continue");
        await ContinueButton.ClickAsync();
    }

    public async Task FinishAsync()
    {
        Console.WriteLine("[CheckoutPage] Click Finish");
        await FinishButton.ClickAsync();
    }

    public async Task<string> GetCompleteHeaderAsync()
    {
        Console.WriteLine("[CheckoutPage] Read the order confirmation header");
        var text = await CompleteHeader.InnerTextAsync();
        return text.Trim();
    }
}
