---
title: Value Object
description: An important concept in Domain-Driven Design - an immutable object identified by its property values
---

A Value Object is an important concept in Domain-Driven Design. Unlike entities, value objects are identified by their property values rather than by a unique identifier (Id).

## What is a Value Object

Value objects have the following characteristics:

1. **No unique identity**: no `Id` property; identified by property values
2. **Immutability**: once created, property values cannot change
3. **Value equality**: two value objects are equal if and only if all property values are the same
4. **Replaceability**: can be replaced by another object with the same value
5. **No side effects**: methods do not change object state; they return new objects

## Value Object Base Class

MiCake provides the `ValueObject` abstract class for defining value objects:

```csharp
using MiCake.DDD.Domain;
using System.Collections.Generic;

public class Money : ValueObject
{
    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency ?? throw new ArgumentNullException(nameof(currency));
    }

    // Define the components used for equality comparison
    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }

    // Business methods return new objects to preserve immutability
    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new DomainException("Cannot add money with different currencies");

        return new Money(Amount + other.Amount, Currency);
    }

    public Money Multiply(decimal multiplier)
    {
        return new Money(Amount * multiplier, Currency);
    }

    public override string ToString() => $"{Amount} {Currency}";
}
```

## Record Value Objects

For simple value objects, you can use C# 9.0+ record types:

```csharp
using MiCake.DDD.Domain;

// Use a record to simplify value object definition
public record Address : RecordValueObject
{
    public string Street { get; init; }
    public string City { get; init; }
    public string ZipCode { get; init; }
    public string Country { get; init; }

    public Address(string street, string city, string zipCode, string country)
    {
        Street = street ?? throw new ArgumentNullException(nameof(street));
        City = city ?? throw new ArgumentNullException(nameof(city));
        ZipCode = zipCode ?? throw new ArgumentNullException(nameof(zipCode));
        Country = country ?? throw new ArgumentNullException(nameof(country));
    }
}
```

Advantages of `RecordValueObject`:
- Automatically implements value equality
- Automatically implements GetHashCode
- Automatically implements deconstruction
- Supports `with` expressions
- More concise syntax

## Value Object Equality

### Equality Based on All Properties

```csharp
public class Address : ValueObject
{
    public string Street { get; }
    public string City { get; }
    public string ZipCode { get; }

    public Address(string street, string city, string zipCode)
    {
        Street = street;
        City = city;
        ZipCode = zipCode;
    }

    // Returns all properties used for comparison
    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Street;
        yield return City;
        yield return ZipCode;
    }
}

// Usage example
var address1 = new Address("123 Main St", "Beijing", "100000");
var address2 = new Address("123 Main St", "Beijing", "100000");
var address3 = new Address("456 Park Ave", "Shanghai", "200000");

Console.WriteLine(address1 == address2);  // True - all properties are the same
Console.WriteLine(address1 == address3);  // False - properties differ
```

### Equality with Complex Types

```csharp
public class DateRange : ValueObject
{
    public DateTime StartDate { get; }
    public DateTime EndDate { get; }

    public DateRange(DateTime startDate, DateTime endDate)
    {
        if (endDate < startDate)
            throw new DomainException("End date must be after start date");

        StartDate = startDate;
        EndDate = endDate;
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return StartDate;
        yield return EndDate;
    }

    public int GetDays() => (EndDate - StartDate).Days;

    public bool Contains(DateTime date)
    {
        return date >= StartDate && date <= EndDate;
    }

    public bool Overlaps(DateRange other)
    {
        return StartDate <= other.EndDate && EndDate >= other.StartDate;
    }
}
```

## Immutability of Value Objects

### Implementing Immutability Correctly

```csharp
public class PersonName : ValueObject
{
    // Read-only properties
    public string FirstName { get; }
    public string LastName { get; }
    public string FullName => $"{FirstName} {LastName}";

    public PersonName(string firstName, string lastName)
    {
        FirstName = firstName ?? throw new ArgumentNullException(nameof(firstName));
        LastName = lastName ?? throw new ArgumentNullException(nameof(lastName));
    }

    // Methods return new objects; they do not modify the current object
    public PersonName ChangeFirstName(string newFirstName)
    {
        return new PersonName(newFirstName, LastName);
    }

    public PersonName ChangeLastName(string newLastName)
    {
        return new PersonName(FirstName, newLastName);
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return FirstName;
        yield return LastName;
    }
}

// Usage example
var name = new PersonName("John", "Doe");
var newName = name.ChangeFirstName("Jane");  // Returns a new object
Console.WriteLine(name.FirstName);     // John - the original object is unchanged
Console.WriteLine(newName.FirstName);  // Jane - the new object
```

## Common Value Object Examples

### 1. Money

```csharp
public class Money : ValueObject
{
    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency)
    {
        if (amount < 0)
            throw new DomainException("Amount cannot be negative");

        Amount = amount;
        Currency = currency?.ToUpper() 
            ?? throw new ArgumentNullException(nameof(currency));
    }

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new DomainException($"Cannot add {other.Currency} to {Currency}");

        return new Money(Amount + other.Amount, Currency);
    }

    public Money Subtract(Money other)
    {
        if (Currency != other.Currency)
            throw new DomainException($"Cannot subtract {other.Currency} from {Currency}");

        return new Money(Amount - other.Amount, Currency);
    }

    public Money Multiply(decimal multiplier)
    {
        return new Money(Amount * multiplier, Currency);
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }

    public static Money Zero(string currency) => new Money(0, currency);
    public static Money CNY(decimal amount) => new Money(amount, "CNY");
    public static Money USD(decimal amount) => new Money(amount, "USD");

    public override string ToString() => $"{Amount:F2} {Currency}";
}
```

### 2. Address

```csharp
public class Address : ValueObject
{
    public string Country { get; }
    public string Province { get; }
    public string City { get; }
    public string Street { get; }
    public string ZipCode { get; }

    public Address(string country, string province, string city, string street, string zipCode)
    {
        Country = country ?? throw new ArgumentNullException(nameof(country));
        Province = province ?? throw new ArgumentNullException(nameof(province));
        City = city ?? throw new ArgumentNullException(nameof(city));
        Street = street ?? throw new ArgumentNullException(nameof(street));
        ZipCode = zipCode ?? throw new ArgumentNullException(nameof(zipCode));
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Country;
        yield return Province;
        yield return City;
        yield return Street;
        yield return ZipCode;
    }

    public override string ToString()
    {
        return $"{Country}, {Province}, {City}, {Street}, {ZipCode}";
    }
}
```

### 3. Email Address

```csharp
public class EmailAddress : ValueObject
{
    public string Value { get; }

    public EmailAddress(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainException("Email address cannot be empty");

        if (!value.Contains("@") || !value.Contains("."))
            throw new DomainException("Invalid email format");

        Value = value.ToLower().Trim();
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Value;
    }

    public string GetDomain()
    {
        return Value.Split('@')[1];
    }

    public override string ToString() => Value;

    // Implicit conversion
    public static implicit operator string(EmailAddress email) => email.Value;
}
```

## Using Value Objects in Entities

### As Entity Properties

```csharp
public class Customer : AggregateRoot<int>
{
    // Value object properties
    public PersonName Name { get; private set; }
    public EmailAddress Email { get; private set; }
    public PhoneNumber Phone { get; private set; }
    public Address ShippingAddress { get; private set; }

    private Customer() { }

    public static Customer Create(PersonName name, EmailAddress email)
    {
        return new Customer
        {
            Name = name,
            Email = email
        };
    }

    public void UpdateEmail(EmailAddress newEmail)
    {
        if (newEmail == null)
            throw new ArgumentNullException(nameof(newEmail));

        Email = newEmail;
        RaiseDomainEvent(new CustomerEmailChangedEvent(Id, newEmail.Value));
    }

    public void UpdateShippingAddress(Address newAddress)
    {
        ShippingAddress = newAddress;
    }
}
```

### As Method Parameters

```csharp
public class Order : AggregateRoot<int>
{
    private Money _totalAmount;
    private Address _shippingAddress;

    public void UpdateShippingAddress(Address newAddress)
    {
        if (newAddress == null)
            throw new ArgumentNullException(nameof(newAddress));

        _shippingAddress = newAddress;
    }

    public void ApplyDiscount(Percentage discountRate)
    {
        var discount = discountRate.ApplyTo(_totalAmount);
        _totalAmount = _totalAmount.Subtract(discount);

        RaiseDomainEvent(new DiscountAppliedEvent(Id, discount));
    }
}
```

## Persisting Value Objects

### EF Core Configuration

```csharp
public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        // Option 1: split into multiple columns
        builder.OwnsOne(c => c.Name, name =>
        {
            name.Property(n => n.FirstName)
                .HasColumnName("FirstName")
                .HasMaxLength(50);
            name.Property(n => n.LastName)
                .HasColumnName("LastName")
                .HasMaxLength(50);
        });

        // Option 2: store as JSON
        builder.OwnsOne(c => c.Address, address =>
        {
            address.ToJson();
        });

        // Option 3: use a value converter
        builder.Property(c => c.Email)
            .HasConversion(
                email => email.Value,
                value => new EmailAddress(value)
            );
    }
}
```

## Value Object vs Entity

| Feature | Value Object | Entity |
|---------|--------------|--------|
| Identity | No unique identity | Has a unique Id |
| Equality | Based on property values | Based on Id |
| Mutability | Immutable | Mutable |
| Lifecycle | No independent lifecycle | Has an independent lifecycle |
| Replaceability | Can be replaced by an object with the same value | Cannot be replaced |

### How to Choose

**Use a value object when**:
- Describing attributes or measurements of a thing
- No need to track change history
- Can be replaced by an object with the same value
- Examples: money, address, date range, email

**Use an entity when**:
- A unique identity is required
- Change history needs to be tracked
- It has an independent lifecycle
- Examples: user, order, product

## Best Practices

### 1. Keep Value Objects Simple

```csharp
// ✅ Good practice - simple and clear
public class Temperature : ValueObject
{
    public decimal Value { get; }
    public string Unit { get; }

    public Temperature(decimal value, string unit)
    {
        Value = value;
        Unit = unit;
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Value;
        yield return Unit;
    }
}

// ❌ Avoid - too complex
public class ComplexValue : ValueObject
{
    // Contains too many properties and complex logic
    // It may need to be split into multiple value objects or turned into an entity
}
```

### 2. Validate in the Constructor

```csharp
public class Age : ValueObject
{
    public int Value { get; }

    public Age(int value)
    {
        if (value < 0)
            throw new DomainException("Age cannot be negative");
        if (value > 150)
            throw new DomainException("Age seems unrealistic");

        Value = value;
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Value;
    }
}
```

### 3. Provide Factory Methods

```csharp
public class Money : ValueObject
{
    public decimal Amount { get; }
    public string Currency { get; }

    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    // Factory methods
    public static Money Create(decimal amount, string currency)
    {
        if (amount < 0)
            throw new DomainException("Amount cannot be negative");
        return new Money(amount, currency);
    }

    public static Money Zero(string currency) => new Money(0, currency);
    public static Money CNY(decimal amount) => Create(amount, "CNY");
    public static Money USD(decimal amount) => Create(amount, "USD");

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }
}
```

### 4. Implement Meaningful Methods

```csharp
public class DateRange : ValueObject
{
    public DateTime StartDate { get; }
    public DateTime EndDate { get; }

    public DateRange(DateTime startDate, DateTime endDate)
    {
        if (endDate < startDate)
            throw new DomainException("End date must be after start date");

        StartDate = startDate;
        EndDate = endDate;
    }

    // Methods with business meaning
    public int GetDurationInDays() => (EndDate - StartDate).Days;

    public bool Contains(DateTime date) => 
        date >= StartDate && date <= EndDate;

    public bool Overlaps(DateRange other) =>
        StartDate <= other.EndDate && EndDate >= other.StartDate;

    public DateRange ExtendBy(int days) =>
        new DateRange(StartDate, EndDate.AddDays(days));

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return StartDate;
        yield return EndDate;
    }
}
```

## Common Mistakes

### ❌ Value Object with Mutable State

```csharp
// Wrong: properties can be modified
public class Address : ValueObject
{
    public string Street { get; set; }  // Do not use set
    public string City { get; set; }
}
```

### ✅ Correct Immutable Implementation

```csharp
public class Address : ValueObject
{
    public string Street { get; }  // Read-only
    public string City { get; }

    public Address(string street, string city)
    {
        Street = street;
        City = city;
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Street;
        yield return City;
    }
}
```

## Summary

Value objects are an important concept in DDD. In MiCake:

- Inherit from the `ValueObject` base class or `RecordValueObject`
- Compare equality by property values
- Preserve immutability
- Used as properties in entities
- Encapsulate domain concepts and business rules
- Make code more expressive and type-safe

Next steps:
- Learn about [Aggregate Roots](/en/domain-driven/aggregate-root/) to understand aggregate design
- Read about [Repositories](/en/domain-driven/repository/) to understand persistence
- Check out [Entities](/en/domain-driven/entity/) to compare entities and value objects
