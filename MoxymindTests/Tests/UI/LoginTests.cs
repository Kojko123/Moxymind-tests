using System.Text.RegularExpressions;
using MoxymindTests.Helpers;
using MoxymindTests.Pages;

namespace MoxymindTests.Tests.UI;

[TestClass]
public class LoginTests : UITestBase
{
    [TestMethod]
    public async Task StandardUserLogsInAndReachesInventory()
    {
        // Why essential: Login is the gateway to every other feature. If it breaks, no customer
        // can buy anything, so this is the first smoke check.
        var loginPage = new LoginPage(Page);
        var inventoryPage = new InventoryPage(Page);

        await loginPage.GoToAsync();
        await loginPage.LoginAsync(Credentials.StandardUser, Credentials.Password);

        Console.WriteLine("[LoginTests] Expect URL to contain /inventory.html");
        await Expect(Page).ToHaveURLAsync(new Regex("/inventory\\.html"));

        Console.WriteLine("[LoginTests] Expect Products title to be visible");
        await Expect(inventoryPage.Title).ToBeVisibleAsync();

        Console.WriteLine("[LoginTests] Expect inventory page to be loaded with products");
        Assert.IsTrue(await inventoryPage.IsLoadedAsync(), "Inventory page did not load.");

        Console.WriteLine("[LoginTests] Expect product count > 0");
        var count = await inventoryPage.GetProductCountAsync();
        Assert.IsTrue(count > 0, $"Expected at least one product but found {count}.");
    }

    [TestMethod]
    public async Task LockedOutUserSeesErrorAndStaysOnLogin()
    {
        // Why essential: This verifies access control. A regression here could let blocked
        // accounts in, or leave legitimate users with no feedback.
        var loginPage = new LoginPage(Page);

        await loginPage.GoToAsync();
        await loginPage.LoginAsync(Credentials.LockedOutUser, Credentials.Password);

        Console.WriteLine("[LoginTests] Expect error banner to be visible");
        await Expect(loginPage.ErrorBanner).ToBeVisibleAsync();

        Console.WriteLine("[LoginTests] Expect error banner to say the user is locked out");
        await Expect(loginPage.ErrorBanner).ToContainTextAsync("Sorry, this user has been locked out.");

        Console.WriteLine("[LoginTests] Expect login button still visible (user remains on login page)");
        await Expect(loginPage.LoginButton).ToBeVisibleAsync();

        Console.WriteLine("[LoginTests] Expect URL not to contain /inventory.html");
        await Expect(Page).Not.ToHaveURLAsync(new Regex("/inventory\\.html"));
    }
}
