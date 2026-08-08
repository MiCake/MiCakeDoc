---
title: Utilities Overview
description: Practical utility classes and helper features provided by MiCake to
  help you develop applications more efficiently
slug: en/10.0.0/utilities/overview
---

MiCake provides a series of practical utility classes to help you develop applications more efficiently. This page is the navigation page for the utilities, click each tool link to view the detailed documentation.

## Utility Categories

| Category | Tool | Description |
|----------|------|-------------|
| Cache | [BoundedLruCache](./cache/bounded-lru-cache) | Thread-safe LRU cache with capacity limits and segment strategies |
| Type conversion | [ValueConverter](./converter) | Unified type conversion interface, supports custom converter registration |
| Query | [DynamicQuery](./query) | Dynamic query builder, supports automatically generating filter conditions based on property attributes |
| Resilience | [CircuitBreaker](./resilience) | Circuit breaker pattern implementation, protects the system from external service failures |
| Storage | [DataDepositPool](./storage) | Temporary data storage pool with capacity limits |

## Quick Start

### Namespaces

```csharp
// Cache
using MiCake.Util.Cache;

// Type conversion
using MiCake.Util.Convert;

// Dynamic query and paging
using MiCake.Util.Query.Dynamic;
using MiCake.Util.Query.Paging;

// Resilience
using MiCake.Util.Resilience;

// Storage
using MiCake.Util.Store;

// Validation and random
using MiCake.Util;

// Extension methods
using MiCake.Util.Extensions;
```

### Common Examples

```csharp
// Parameter validation
CheckValue.NotNullOrEmpty(name, nameof(name));

// Type conversion
int value = ValueConverter.Convert<string, int>("123");

// String extensions
bool isEmpty = str.IsNullOrWhiteSpace();
string camel = "HelloWorld".ToCamelCase();

// Collection extensions
list.AddIfNotContains(item);

// Random selection
var item = RandomHelper.GetRandomOfList(items);
```

## Best Practices

1. **Use caching wisely**: cache data that doesn't change frequently
2. **Use circuit breakers to protect external calls**: and provide fallback strategies
3. **Use utility classes as singletons**: register them as singletons in the DI container
4. **Validate parameters up front**: perform parameter validation at the beginning of methods
5. **Use extension methods**: to simplify common operations

## Utility Usage Suggestions

### Cache Use Cases

```csharp
// ✅ Suitable for caching
- Configuration data
- Dictionary data
- Business data that doesn't change frequently

// ❌ Not suitable for caching
- Sensitive user data
- Frequently changing data
- Large object data
```

### Circuit Breaker Use Cases

```csharp
// ✅ Suitable for circuit breakers
- External API calls
- Database queries (non-core business)
- Third-party service integration

// ⚠️ Fallback strategies should be provided
- Return cached data
- Return default values
- Return friendly error messages
```

### Type Conversion Notes

```csharp
// ✅ Correct: handle conversion failures
int? value = ValueConverter.Convert<string, int?>("invalid");
if (value == null)
{
    // Handle the conversion failure
}

// ⚠️ Note: Convert returns a default value on failure instead of throwing an exception
var result = ValueConverter.Convert<string, int>("abc"); // returns 0
```

## Next Steps

* View the detailed documentation for each tool
* Learn about best practices and usage examples
* Explore custom extensions and integration options
