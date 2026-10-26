using System.Globalization;
using Microsoft.Playwright;

namespace MoxymindTests.Pages;

public class InventoryPage
{
    private readonly IPage _page;

    public InventoryPage(IPage page)
    {
        _page = page;
    }

    // The "Products" title on saucedemo is a <span data-test="title">, not a heading role,
    // so a heading-role locator would never match. data-test is encapsulated here.
    public ILocator Title => _page.Locator("[data-test='title']");

    public ILocator Items => _page.Locator(".inventory_item");
    public ILocator CartBadge => _page.Locator(".shopping_cart_badge");

    private ILocator SortDropdown => _page.GetByRole(AriaRole.Combobox);
    private ILocator AddToCartButtons => _page.GetByRole(AriaRole.Button, new() { Name = "Add to cart" });
    private ILocator PriceLabels => _page.Locator(".inventory_item_price");
    private ILocator CartLink => _page.Locator(".shopping_cart_link");

    public async Task<bool> IsLoadedAsync()
    {
        Console.WriteLine("[InventoryPage] Check that the Products title is visible and items are listed");
        await Title.WaitForAsync(new() { State = WaitForSelectorState.Visible });
        var titleText = (await Title.InnerTextAsync()).Trim();
        var count = await Items.CountAsync();
        return titleText == "Products" && count > 0;
    }

    public async Task<int> GetProductCountAsync()
    {
        Console.WriteLine("[InventoryPage] Count the listed products");
        return await Items.CountAsync();
    }

    public async Task AddFirstProductToCartAsync()
    {
        Console.WriteLine("[InventoryPage] Add the first product to the cart");
        await AddToCartButtons.First.ClickAsync();
    }

    public async Task<string> GetCartBadgeTextAsync()
    {
        Console.WriteLine("[InventoryPage] Read the cart badge text");
        if (await CartBadge.CountAsync() == 0)
        {
            return "";
        }
        return (await CartBadge.InnerTextAsync()).Trim();
    }

    public async Task SortByAsync(string optionLabel)
    {
        Console.WriteLine($"[InventoryPage] Sort products by '{optionLabel}'");
        await SortDropdown.SelectOptionAsync(new SelectOptionValue { Label = optionLabel });
    }

    public async Task<IReadOnlyList<decimal>> GetDisplayedPricesAsync()
    {
        Console.WriteLine("[InventoryPage] Read all displayed product prices");
        var texts = await PriceLabels.AllInnerTextsAsync();
        return texts
            .Select(t => decimal.Parse(t.Trim().TrimStart('$'), CultureInfo.InvariantCulture))
            .ToList();
    }

    public async Task OpenCartAsync()
    {
        Console.WriteLine("[InventoryPage] Open the cart");
        await CartLink.ClickAsync();
    }
}
