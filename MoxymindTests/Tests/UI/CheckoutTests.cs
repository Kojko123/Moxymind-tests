using MoxymindTests.Helpers;
using MoxymindTests.Pages;

namespace MoxymindTests.Tests.UI;

[TestClass]
public class CheckoutTests : UITestBase
{
    [TestMethod]
    public async Task StandardUserCompletesPurchaseOfOneItem()
    {
        // Why essential: This is the revenue path. It covers the cart badge, checkout form, and
        // order confirmation together, so it catches the most business-critical failures in one run.
        var loginPage = new LoginPage(Page);
        var inventoryPage = new InventoryPage(Page);
        var cartPage = new CartPage(Page);
        var checkoutPage = new CheckoutPage(Page);

        await loginPage.GoToAsync();
        await loginPage.LoginAsync(Credentials.StandardUser, Credentials.Password);
        await inventoryPage.AddFirstProductToCartAsync();

        Console.WriteLine("[CheckoutTests] Expect cart badge = 1");
        await Expect(inventoryPage.CartBadge).ToHaveTextAsync("1");

        await inventoryPage.OpenCartAsync();

        Console.WriteLine("[CheckoutTests] Expect exactly 1 item in the cart");
        await Expect(cartPage.CartItems).ToHaveCountAsync(1);

        await cartPage.StartCheckoutAsync();
        await checkoutPage.FillCustomerInformationAsync(
            CustomerDetails.FirstName, CustomerDetails.LastName, CustomerDetails.PostalCode);
        await checkoutPage.ContinueAsync();
        await checkoutPage.FinishAsync();

        Console.WriteLine("[CheckoutTests] Expect order confirmation header");
        await Expect(checkoutPage.CompleteHeader).ToHaveTextAsync("Thank you for your order!");
    }
}
