using Microsoft.Playwright;

namespace MoxymindTests.Pages;

public class CartPage
{
    private readonly IPage _page;

    public CartPage(IPage page)
    {
        _page = page;
    }

    public ILocator CartItems => _page.Locator(".cart_item");

    private ILocator CheckoutButton => _page.GetByRole(AriaRole.Button, new() { Name = "Checkout" });

    public async Task<int> GetItemCountAsync()
    {
        Console.WriteLine("[CartPage] Count the items in the cart");
        return await CartItems.CountAsync();
    }

    public async Task StartCheckoutAsync()
    {
        Console.WriteLine("[CartPage] Click Checkout");
        await CheckoutButton.ClickAsync();
    }
}
