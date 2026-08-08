---
title: Domain Service
description: Encapsulate cross-aggregate business logic using domain services
slug: en/10.0.0/domain-driven/domain-service
---

A Domain Service is used to encapsulate domain logic that does not naturally belong to an entity or value object. It is stateless and handles business rules that span multiple aggregates or entities.

## What is a Domain Service

Domain services have the following characteristics:

1. **Stateless**: do not hold business state, only contain business logic
2. **Operate on multiple objects**: usually involve multiple entities or aggregates
3. **Business logic**: contain important domain concepts and rules
4. **Interface marker**: implement the `IDomainService` interface

## Defining a Domain Service

```csharp
using MiCake.DDD.Domain;

// Pricing service
public class PricingService : IDomainService
{
    public Money CalculateTotalPrice(Order order, Customer customer)
    {
        var subtotal = order.GetSubtotal();
        
        // Apply the customer discount
        var discount = customer.GetDiscount();
        var discountAmount = subtotal.Multiply(discount.AsDecimal());
        
        // Calculate tax
        var taxRate = GetTaxRate(order.ShippingAddress);
        var taxAmount = subtotal.Subtract(discountAmount).Multiply(taxRate);
        
        // Calculate shipping
        var shippingCost = CalculateShipping(order, customer);
        
        return subtotal
            .Subtract(discountAmount)
            .Add(taxAmount)
            .Add(shippingCost);
    }
    
    private decimal GetTaxRate(Address address)
    {
        // Calculate the tax rate based on the address
        return address.Country == "CN" ? 0.13m : 0.20m;
    }
    
    private Money CalculateShipping(Order order, Customer customer)
    {
        if (customer.IsPremium)
            return Money.Zero("CNY");
            
        return new Money(10.00m, "CNY");
    }
}

// Transfer service
public class TransferService : IDomainService
{
    public void Transfer(BankAccount from, BankAccount to, Money amount)
    {
        if (from.Currency != amount.Currency || to.Currency != amount.Currency)
            throw new DomainException("Currency mismatch");
            
        if (from.Balance < amount)
            throw new DomainException("Insufficient balance");
            
        from.Withdraw(amount);
        to.Deposit(amount);
    }
}
```

## Domain Service vs Application Service

### Domain Service

```csharp
// A domain service: contains business rules
public class OrderPricingService : IDomainService
{
    // The business rule for calculating the order price
    public Money CalculateOrderTotal(Order order, List<Promotion> promotions)
    {
        var total = order.GetSubtotal();
        
        foreach (var promotion in promotions.Where(p => p.AppliesTo(order)))
        {
            total = promotion.Apply(total);
        }
        
        return total;
    }
}
```

### Application Service

```csharp
// An application service: coordinates domain objects and infrastructure
public class OrderApplicationService
{
    private readonly IRepository<Order, int> _orderRepository;
    private readonly IRepository<Customer, int> _customerRepository;
    private readonly OrderPricingService _pricingService;  // Uses the domain service
    
    public async Task<OrderDto> CreateOrder(CreateOrderCommand command)
    {
        // 1. Load the aggregate
        var customer = await _customerRepository.FindAsync(command.CustomerId);
        
        // 2. Create the order
        var order = Order.Create(customer.Id);
        foreach (var item in command.Items)
        {
            order.AddItem(item.ProductId, item.Quantity, item.Price);
        }
        
        // 3. Use the domain service to calculate the price
        var total = _pricingService.CalculateOrderTotal(order, customer.GetActivePromotions());
        order.SetTotalAmount(total);
        
        // 4. Persist
        await _orderRepository.AddAsync(order);
        await _orderRepository.SaveChangesAsync();
        
        // 5. Return a DTO
        return MapToDto(order);
    }
}
```

## When to Use a Domain Service

### ✅ Should Use a Domain Service

1. **The operation involves multiple aggregates**:

```csharp
public class OrderFulfillmentService : IDomainService
{
    public bool CanFulfillOrder(Order order, List<Product> products)
    {
        // Check the inventory of multiple products
        foreach (var item in order.Items)
        {
            var product = products.First(p => p.Id == item.ProductId);
            if (product.Stock < item.Quantity)
                return false;
        }
        return true;
    }
}
```

2. **Complex business calculations**:

```csharp
public class ShippingCostCalculator : IDomainService
{
    public Money Calculate(Order order, Address from, Address to)
    {
        var distance = CalculateDistance(from, to);
        var weight = order.GetTotalWeight();
        var dimensions = order.GetTotalDimensions();
        
        // Complex shipping cost calculation logic
        return CalculateShippingCost(distance, weight, dimensions);
    }
}
```

3. **Business rule validation**:

```csharp
public class CreditCheckService : IDomainService
{
    public bool CheckCredit(Customer customer, Money amount)
    {
        var creditLimit = customer.GetCreditLimit();
        var outstandingBalance = customer.GetOutstandingBalance();
        
        return outstandingBalance.Add(amount).Amount <= creditLimit.Amount;
    }
}
```

### ❌ Should Not Use a Domain Service

1. **Logic that belongs to a single entity**:

```csharp
// ❌ Don't: this should be a method of Order
public class OrderService : IDomainService
{
    public void AddItemToOrder(Order order, int productId, int quantity)
    {
        order.AddItem(productId, quantity);
    }
}

// ✅ Correct: implement it directly in Order
public class Order : AggregateRoot<int>
{
    public void AddItem(int productId, int quantity)
    {
        // Implementation logic
    }
}
```

2. **Pure technical operations**:

```csharp
// ❌ Don't: this is an infrastructure service, not a domain service
public class EmailSenderService : IDomainService
{
    public void SendEmail(string to, string subject, string body)
    {
        // Send the email
    }
}

// ✅ Correct: put it in the infrastructure layer
public interface IEmailService
{
    Task SendEmailAsync(string to, string subject, string body);
}
```

## Dependency Injection

Domain services are used through dependency injection:

```csharp
// Marked as a scoped service and registered automatically
public class PricingService : IDomainService, IScopedService
{
    private readonly ITaxRateProvider _taxRateProvider;
    
    public PricingService(ITaxRateProvider taxRateProvider)
    {
        _taxRateProvider = taxRateProvider;
    }
    
    public Money CalculateTotal(Order order)
    {
        var subtotal = order.GetSubtotal();
        var taxRate = _taxRateProvider.GetRate(order.ShippingAddress);
        return subtotal.Multiply(1 + taxRate);
    }
}

// Used in an application service
public class OrderApplicationService
{
    private readonly PricingService _pricingService;
    
    public OrderApplicationService(PricingService pricingService)
    {
        _pricingService = pricingService;
    }
    
    public async Task ProcessOrder(int orderId)
    {
        var order = await _orderRepository.FindAsync(orderId);
        var total = _pricingService.CalculateTotal(order);
        order.SetTotal(total);
        await _orderRepository.SaveChangesAsync();
    }
}
```

## Best Practices

### 1. Keep It Stateless

```csharp
// ✅ Correct - stateless
public class DiscountCalculator : IDomainService
{
    public Money Calculate(Order order, Customer customer)
    {
        // Does not save any state
        return order.GetSubtotal().Multiply(customer.DiscountRate);
    }
}

// ❌ Wrong - stateful
public class DiscountCalculator : IDomainService
{
    private Order _currentOrder;  // Do not save state
    
    public void SetOrder(Order order)
    {
        _currentOrder = order;
    }
}
```

### 2. Use Clear Method Names

```csharp
public class OrderService : IDomainService
{
    // ✅ Clear business meaning
    public bool CanBeCancelled(Order order) { }
    public Money CalculateTotalWithTax(Order order, Address address) { }
    public bool MeetsMinimumOrderValue(Order order) { }
}
```

### 3. Depend on Interfaces Rather Than Implementations

```csharp
public class PricingService : IDomainService
{
    private readonly ITaxRateProvider _taxRateProvider;  // Interface
    private readonly IShippingCalculator _shippingCalculator;  // Interface
    
    public PricingService(
        ITaxRateProvider taxRateProvider,
        IShippingCalculator shippingCalculator)
    {
        _taxRateProvider = taxRateProvider;
        _shippingCalculator = shippingCalculator;
    }
}
```

## Real-World Example

### An Order Pricing Service

```csharp
public class OrderPricingService : IDomainService, IScopedService
{
    private readonly ITaxRateProvider _taxRateProvider;
    private readonly IShippingCalculator _shippingCalculator;
    
    public OrderPricingService(
        ITaxRateProvider taxRateProvider,
        IShippingCalculator shippingCalculator)
    {
        _taxRateProvider = taxRateProvider;
        _shippingCalculator = shippingCalculator;
    }
    
    public OrderPricing CalculatePricing(Order order, Customer customer)
    {
        // 1. Item subtotal
        var subtotal = CalculateSubtotal(order);
        
        // 2. Apply the discount
        var discount = CalculateDiscount(subtotal, customer);
        
        // 3. Calculate tax
        var taxAmount = CalculateTax(subtotal - discount, order.ShippingAddress);
        
        // 4. Calculate shipping
        var shippingCost = _shippingCalculator.Calculate(
            order, 
            customer.ShippingAddress
        );
        
        return new OrderPricing
        {
            Subtotal = subtotal,
            Discount = discount,
            Tax = taxAmount,
            Shipping = shippingCost,
            Total = subtotal - discount + taxAmount + shippingCost
        };
    }
    
    private Money CalculateSubtotal(Order order)
    {
        return order.Items
            .Select(i => i.Price.Multiply(i.Quantity))
            .Aggregate((a, b) => a.Add(b));
    }
    
    private Money CalculateDiscount(Money subtotal, Customer customer)
    {
        var discountRate = customer.GetDiscountRate();
        return subtotal.Multiply(discountRate.AsDecimal());
    }
    
    private Money CalculateTax(Money amount, Address address)
    {
        var taxRate = _taxRateProvider.GetRate(address);
        return amount.Multiply(taxRate);
    }
}
```

## Summary

Domain services are used to encapsulate business logic that does not belong to entities or value objects:

* Implement the `IDomainService` interface
* Keep them stateless
* Handle operations that span multiple aggregates
* Contain complex business rules
* Used through dependency injection

Next steps:

* Learn about [Unit of Work](../domain-driven/unit-of-work/) to understand transaction management
* Read about [Aggregate Roots](../domain-driven/aggregate-root/) to understand aggregate design
* Check out [Repositories](../domain-driven/repository/) to learn about data access
