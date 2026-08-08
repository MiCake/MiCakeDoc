---
title: ValueConverter Type Conversion Utility
description: A unified type conversion interface that supports registering
  custom converters and built-in type conversion
slug: en/10.0.0/utilities/converter
---

`ValueConverter` provides a unified type conversion interface. It uses a registry pattern to manage converters and supports both built-in and custom converters.

## Namespace

```csharp
using MiCake.Util.Convert;
```

## Basic Usage

### The Convert Method

```csharp
// String to integer
int intValue = ValueConverter.Convert<string, int>("123");

// String to date
DateTime dateValue = ValueConverter.Convert<string, DateTime>("2024-01-01");

// Guid conversion
Guid guid = ValueConverter.Convert<string, Guid>("550e8400-e29b-41d4-a716-446655440000");

// Version conversion
Version? version = ValueConverter.Convert<string, Version>("1.2.3");
```

### Convert Method Behavior

* **null value handling**: throws an `ArgumentNullException` when the source value is null
* **Conversion failure**: returns the default value of the target type (such as `0`, `null`, `Guid.Empty`) without throwing an exception
* **Conversion order**:
  1. Queries the registry for custom converters (in registration order)
  2. Uses the built-in `SystemValueConverter` as a fallback

## Custom Converters

### Creating a Converter

```csharp
public class MoneyConverter : IValueConverter<string, Money>
{
    public bool CanConvert(string value)
    {
        return !string.IsNullOrEmpty(value) && value.Contains(' ');
    }

    public Money? Convert(string value)
    {
        var parts = value.Split(' ');
        if (parts.Length != 2)
            return null;
            
        if (!decimal.TryParse(parts[0], out var amount))
            return null;
            
        return new Money(amount, parts[1]);
    }
}
```

### Registering a Converter

```csharp
// Register using a factory method
ValueConverter.RegisterConverter(() => new MoneyConverter());

// Register using an instance
ValueConverter.RegisterConverter(new MoneyConverter());

// Generic registration
ValueConverter.RegisterConverter<string, Money>(() => new MoneyConverter());
```

### Using a Custom Converter

```csharp
// Use it directly after registration
var money = ValueConverter.Convert<string, Money>("99.99 USD");
Console.WriteLine($"{money.Amount} {money.Currency}"); // 99.99 USD
```

## Registry Management

### HasConverter - Check for a Converter

```csharp
if (ValueConverter.HasConverter<string, Money>())
{
    Console.WriteLine("Converter is registered");
}
```

### ClearConverters - Clear Specified Converters

```csharp
// Clear all converters from string to Money
ValueConverter.ClearConverters<string, Money>();
```

### ClearAll - Clear All Converters

```csharp
// Clear all custom converters (built-in converters are also cleared)
ValueConverter.ClearAll();
```

### SetRegistry - Set a Custom Registry

```csharp
// Create a custom registry
var customRegistry = new DefaultConverterRegistry();
customRegistry.Register<string, MyType>(() => new MyTypeConverter());

// Apply the custom registry
ValueConverter.SetRegistry(customRegistry);
```

### ResetRegistry - Reset to the Default Registry

```csharp
// Reset to the default registry and re-register the built-in converters
ValueConverter.ResetRegistry();
```

## Built-in Converters

MiCake pre-registers the following built-in converters:

### GuidValueConverter

```csharp
// String to Guid
Guid guid1 = ValueConverter.Convert<string, Guid>("550e8400-e29b-41d4-a716-446655440000");

// Guid to Guid (returns directly)
Guid guid2 = ValueConverter.Convert<Guid, Guid>(guid1);

// Returns Guid.Empty on failure
Guid empty = ValueConverter.Convert<string, Guid>("invalid"); // Guid.Empty
```

### VersionValueConverter

```csharp
// String to Version
Version? version1 = ValueConverter.Convert<string, Version>("1.2.3");
Console.WriteLine(version1); // 1.2.3

// Version to Version (returns directly)
Version? version2 = ValueConverter.Convert<Version, Version>(version1);

// Returns null on failure
Version? nullVersion = ValueConverter.Convert<string, Version>("invalid"); // null
```

### SystemValueConverter

Acts as a fallback converter, using `System.Convert.ChangeType`:

```csharp
// Supports most basic type conversions
int intVal = ValueConverter.Convert<string, int>("42");
double doubleVal = ValueConverter.Convert<string, double>("3.14");
bool boolVal = ValueConverter.Convert<string, bool>("true");
DateTime dateVal = ValueConverter.Convert<string, DateTime>("2024-01-01");
```

## Registry and Thread Safety

`DefaultConverterRegistry` uses locks to protect read/write operations, ensuring thread safety:

```csharp
// Safe registration in multi-threaded environments
Parallel.For(0, 100, i =>
{
    ValueConverter.RegisterConverter<string, int>(() => new MyIntConverter());
});
```

## Usage Examples

### Complex Type Conversion

```csharp
public class ProductDto
{
    public string Id { get; set; }
    public string Price { get; set; }
    public string Category { get; set; }
}

// Register converters
ValueConverter.RegisterConverter<string, int>(() => new StringToIntConverter());
ValueConverter.RegisterConverter<string, decimal>(() => new StringToDecimalConverter());

// Usage
var dto = new ProductDto
{
    Id = "123",
    Price = "99.99",
    Category = "1"
};

int id = ValueConverter.Convert<string, int>(dto.Id);
decimal price = ValueConverter.Convert<string, decimal>(dto.Price);
int categoryId = ValueConverter.Convert<string, int>(dto.Category);
```

### Using in a Service

```csharp
public class DataImportService : IScopedService
{
    public Product ParseProduct(Dictionary<string, string> data)
    {
        return new Product
        {
            Id = ValueConverter.Convert<string, int>(data["Id"]),
            Name = data["Name"],
            Price = ValueConverter.Convert<string, decimal>(data["Price"]),
            CreatedAt = ValueConverter.Convert<string, DateTime>(data["CreatedAt"])
        };
    }
}
```

### Chained Conversion

```csharp
// Register multiple converters to implement chained conversion
ValueConverter.RegisterConverter<string, Guid>(() => new StringToGuidConverter());
ValueConverter.RegisterConverter<Guid, int>(() => new GuidToIntConverter());

// Step-by-step conversion
string guidString = "550e8400-e29b-41d4-a716-446655440000";
Guid guid = ValueConverter.Convert<string, Guid>(guidString);
int hashCode = ValueConverter.Convert<Guid, int>(guid);
```

## Best Practices

### 1. Register Specific Converters

```csharp
// ✅ Correct: register a dedicated converter to override the default behavior
ValueConverter.RegisterConverter<string, Money>(() => new MoneyConverter());

// ❌ Not recommended: rely on SystemValueConverter for complex types
var money = ValueConverter.Convert<string, Money>("99.99 USD"); // may fail
```

### 2. Handle Conversion Failures

```csharp
// ✅ Correct: check the return value
int? value = ValueConverter.Convert<string, int?>("invalid");
if (value == null)
{
    Console.WriteLine("Conversion failed");
}

// ⚠️ Note: non-nullable types return the default value
int defaultValue = ValueConverter.Convert<string, int>("invalid"); // returns 0
```

### 3. Thread-Safe Registration

```csharp
// ✅ Correct: register at application startup
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        ValueConverter.RegisterConverter<string, Money>(() => new MoneyConverter());
        base.ConfigureServices(context);
    }
}

// ❌ Not recommended: frequently register/clear at runtime
ValueConverter.RegisterConverter<string, int>(() => new MyConverter());
ValueConverter.ClearConverters<string, int>();
```

### 4. Converter Order

```csharp
// ✅ Correct: register by priority
ValueConverter.RegisterConverter<string, int>(() => new SpecialIntConverter()); // priority
ValueConverter.RegisterConverter<string, int>(() => new GeneralIntConverter()); // fallback

// Convert tries them in registration order
int value = ValueConverter.Convert<string, int>("123"); // uses SpecialIntConverter
```

### 5. Implement Idempotent Converters

```csharp
// ✅ Correct: an idempotent converter
public class SafeIntConverter : IValueConverter<string, int>
{
    public bool CanConvert(string value)
    {
        return int.TryParse(value, out _);
    }

    public int? Convert(string value)
    {
        return int.TryParse(value, out var result) ? result : null;
    }
}

// ❌ Wrong: a non-idempotent converter
public class CountingConverter : IValueConverter<string, int>
{
    private int _count = 0;
    
    public int? Convert(string value)
    {
        return _count++; // returns a different result on each call
    }
}
```

## Management Method Summary

| Method | Description |
|--------|-------------|
| `Convert<TSource, TDest>(source)` | Converts a value, returns the default value on failure |
| `RegisterConverter<TSource, TDest>(factory)` | Registers a converter factory |
| `RegisterConverter(converter)` | Registers a converter instance |
| `HasConverter<TSource, TDest>()` | Checks whether a converter exists |
| `ClearConverters<TSource, TDest>()` | Clears converters for the specified types |
| `ClearAll()` | Clears all converters |
| `SetRegistry(registry)` | Sets a custom registry |
| `ResetRegistry()` | Resets to the default registry |

## Important Notes

1. **Conversion failure returns the default value**: the `Convert` method does not throw exceptions
2. **null value throws an exception**: throws an `ArgumentNullException` when the source value is null
3. **Converter order**: converters are tried in registration order
4. **Thread safety**: `DefaultConverterRegistry` supports thread-safe operations
5. **Built-in fallback**: `SystemValueConverter` acts as the last-resort fallback converter
