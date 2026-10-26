using MoxymindTests.Helpers;
using MoxymindTests.Pages;

namespace MoxymindTests.Tests.UI;

[TestClass]
public class InventorySortingTests : UITestBase
{
    [TestMethod]
    public async Task StandardUserSortsByPriceLowToHigh()
    {
        // Why essential: Price sorting drives how customers compare and choose products. A wrong
        // order directly affects purchasing decisions and is easy to miss without a test.
        var loginPage = new LoginPage(Page);
        var inventoryPage = new InventoryPage(Page);

        await loginPage.GoToAsync();
        await loginPage.LoginAsync(Credentials.StandardUser, Credentials.Password);

        Console.WriteLine("[InventorySortingTests] Expect inventory to be visible before sorting");
        await Expect(inventoryPage.Title).ToBeVisibleAsync();

        await inventoryPage.SortByAsync("Price (low to high)");

        var prices = (await inventoryPage.GetDisplayedPricesAsync()).ToList();
        Console.WriteLine($"[InventorySortingTests] Displayed prices: {string.Join(", ", prices)}");

        Console.WriteLine("[InventorySortingTests] Expect prices list to be non-empty");
        Assert.IsTrue(prices.Count > 0, "No prices were displayed.");

        Console.WriteLine("[InventorySortingTests] Expect prices in ascending order");
        var expected = prices.OrderBy(p => p).ToList();
        CollectionAssert.AreEqual(expected, prices, "Prices are not sorted low to high.");
    }
}
