---
title: DynamicQuery Dynamic Query
description: A lightweight dynamic query builder that automatically generates
  LINQ filtering and sorting expressions based on property attributes
slug: en/10.0.0/utilities/query
---

DynamicQuery provides a set of lightweight, type-safe building blocks for generating LINQ filtering and sorting expressions at runtime based on DTO/query objects.

## Namespace

```csharp
using MiCake.Util.Query.Dynamic;
```

## Core Components

### Filter - Single-Field Filter

```csharp
var filter = Filter.Create(
    propertyName: "Name",
    values: new List<FilterValue> 
    { 
        FilterValue.Create("张三", ValueOperatorType.Contains) 
    },
    valuesJoinType: FilterJoinType.Or
);
```

### Sort - Sorting

```csharp
var sort = new Sort
{
    PropertyName = "CreateTime",
    Ascending = false  // Descending
};
```

### FilterValue - Filter Value

```csharp
var filterValue = FilterValue.Create(
    value: "test",
    operatorType: ValueOperatorType.Contains
);
```

## Operator Types (ValueOperatorType)

| Operator | Description | Example |
|----------|-------------|---------|
| `Equal` | Equal to | `Name == "John"` |
| `NotEqual` | Not equal to | `Status != 0` |
| `Contains` | Contains | `Name.Contains("phone")` |
| `StartsWith` | Starts with | `Name.StartsWith("Apple")` |
| `EndsWith` | Ends with | `Email.EndsWith("@example.com")` |
| `GreaterThan` | Greater than | `Price > 100` |
| `LessThan` | Less than | `Stock < 10` |
| `GreaterThanOrEqual` | Greater than or equal to | `Age >= 18` |
| `LessThanOrEqual` | Less than or equal to | `Price <= 1000` |

## Automatically Generating Filters with Attributes

### Defining a Query Object

```csharp
public class ProductQueryDto : IDynamicQueryObj
{
    [DynamicFilter(OperatorType = ValueOperatorType.Contains)]
    public string? Name { get; set; }

    [DynamicFilter(PropertyName = "Price", OperatorType = ValueOperatorType.GreaterThanOrEqual)]
    public decimal? MinPrice { get; set; }

    [DynamicFilter(PropertyName = "Price", OperatorType = ValueOperatorType.LessThanOrEqual)]
    public decimal? MaxPrice { get; set; }

    [DynamicFilter(OperatorType = ValueOperatorType.Equal)]
    public int? CategoryId { get; set; }
}
```

### Generating Filter Conditions

```csharp
var queryDto = new ProductQueryDto
{
    Name = "phone",
    MinPrice = 1000,
    MaxPrice = 5000,
    CategoryId = 5
};

// Automatically generate filter conditions
FilterGroup filterGroup = queryDto.GenerateFilterGroup();

// The generated expression is equivalent to:
// p => p.Name.Contains("phone") 
//      && p.Price >= 1000 
//      && p.Price <= 5000 
//      && p.CategoryId == 5
```

### Applying to IQueryable

```csharp
var query = _dbContext.Products.AsQueryable();

// Apply dynamic filters
query = query.ApplyFilters(filterGroup);

// Apply sorting
query = query.ApplySorting(new Sort 
{ 
    PropertyName = "Price", 
    Ascending = true 
});

// Execute the query
var products = await query.ToListAsync();
```

## FilterGroup and CompositeFilterGroup

### FilterGroup - Filter Group

Combines multiple filter conditions:

```csharp
var group = new FilterGroup
{
    Filters = new List<Filter>
    {
        Filter.Create("Name", new List<FilterValue> 
        { 
            FilterValue.Create("phone", ValueOperatorType.Contains) 
        }),
        Filter.Create("Price", new List<FilterValue> 
        { 
            FilterValue.Create(1000m, ValueOperatorType.GreaterThanOrEqual) 
        })
    },
    FiltersJoinType = FilterJoinType.And  // AND join
};

// Apply the filter group
var query = _dbContext.Products.Filter(group);
```

### CompositeFilterGroup - Composite Filter Group

Combines multiple FilterGroups:

```csharp
var composite = new CompositeFilterGroup
{
    FilterGroups = new List<FilterGroup>
    {
        new FilterGroup { /* First group of conditions */ },
        new FilterGroup { /* Second group of conditions */ }
    },
    FilterGroupsJoinType = FilterJoinType.Or  // OR join between groups
};

// Apply the composite filter
var query = _dbContext.Products.Filter(composite);
```

## Nested Properties

Dot notation is supported for accessing nested properties:

```csharp
public class OrderQueryDto : IDynamicQueryObj
{
    [DynamicFilter(PropertyName = "Customer.Name", OperatorType = ValueOperatorType.Contains)]
    public string? CustomerName { get; set; }

    [DynamicFilter(PropertyName = "Address.City", OperatorType = ValueOperatorType.Equal)]
    public string? City { get; set; }
}

// Generated expression:
// o => o.Customer.Name.Contains("John") && o.Address.City == "Beijing"
```

## Class-Level Configuration

Use `[DynamicFilterJoin]` to configure the class-level join type:

```csharp
[DynamicFilterJoin(JoinType = FilterJoinType.And)]  // Default is AND
public class ProductQuery : IDynamicQueryObj
{
    [DynamicFilter(OperatorType = ValueOperatorType.Contains)]
    public string? Name { get; set; }

    [DynamicFilter(OperatorType = ValueOperatorType.Equal)]
    public int? CategoryId { get; set; }
}

// Generates: Name.Contains("...") AND CategoryId == ...
```

## Usage Examples

### Using in a Web API

```csharp
[ApiController]
[Route("api/[controller]")]
public class ProductController : ControllerBase
{
    private readonly IRepository<Product, int> _repository;

    [HttpGet]
    public async Task<List<Product>> Search([FromQuery] ProductQueryDto query)
    {
        var filterGroup = query.GenerateFilterGroup();
        
        var products = await _repository.Query()
            .Filter(filterGroup)
            .Sort(new Sort { PropertyName = "CreateTime", Ascending = false })
            .ToListAsync();
            
        return products;
    }
}
```

### Complex Queries

```csharp
public class OrderQueryDto : IDynamicQueryObj
{
    // Fuzzy query on the order number
    [DynamicFilter(OperatorType = ValueOperatorType.Contains)]
    public string? OrderNumber { get; set; }

    // Order status (multi-select)
    [DynamicFilter(OperatorType = ValueOperatorType.In)]
    public List<OrderStatus>? Statuses { get; set; }

    // Amount range
    [DynamicFilter(PropertyName = "TotalAmount", OperatorType = ValueOperatorType.GreaterThanOrEqual)]
    public decimal? MinAmount { get; set; }

    [DynamicFilter(PropertyName = "TotalAmount", OperatorType = ValueOperatorType.LessThanOrEqual)]
    public decimal? MaxAmount { get; set; }

    // Date range
    [DynamicFilter(PropertyName = "CreateTime", OperatorType = ValueOperatorType.GreaterThanOrEqual)]
    public DateTime? StartDate { get; set; }

    [DynamicFilter(PropertyName = "CreateTime", OperatorType = ValueOperatorType.LessThanOrEqual)]
    public DateTime? EndDate { get; set; }

    // Customer name
    [DynamicFilter(PropertyName = "Customer.Name", OperatorType = ValueOperatorType.Contains)]
    public string? CustomerName { get; set; }
}
```

### Dynamic Sorting

```csharp
[HttpGet]
public async Task<List<Product>> GetProducts(
    [FromQuery] ProductQueryDto query,
    [FromQuery] string? sortBy = "CreateTime",
    [FromQuery] bool ascending = false)
{
    var filterGroup = query.GenerateFilterGroup();
    
    var products = await _repository.Query()
        .Filter(filterGroup)
        .Sort(new Sort { PropertyName = sortBy, Ascending = ascending })
        .ToListAsync();
        
    return products;
}
```

### Multi-Field Sorting

```csharp
var sorts = new List<Sort>
{
    new Sort { PropertyName = "Priority", Ascending = false },
    new Sort { PropertyName = "CreateTime", Ascending = false }
};

var query = _repository.Query()
    .Filter(filterGroup)
    .Sort(sorts);
```

## FilterExtensions Extension Methods

| Method | Description |
|--------|-------------|
| `Filter(Filter)` | Applies a single filter |
| `Filter(IEnumerable<Filter>)` | Applies multiple filters |
| `Filter(FilterGroup)` | Applies a filter group |
| `Filter(CompositeFilterGroup)` | Applies a composite filter group |
| `GetFilterExpression<T>()` | Gets the filter expression |

## SortingExtensions Extension Methods

| Method | Description |
|--------|-------------|
| `Sort(Sort)` | Applies a single sort |
| `Sort(IEnumerable<Sort>)` | Applies multiple sorts |

## Best Practices

### 1. Use IDynamicQueryObj

```csharp
// ✅ Correct: implement the interface to use the extension methods
public class ProductQuery : IDynamicQueryObj
{
    [DynamicFilter(OperatorType = ValueOperatorType.Contains)]
    public string? Name { get; set; }
}

// ❌ Wrong: doesn't implement the interface
public class ProductQuery
{
    public string? Name { get; set; }
}
```

### 2. Null Values Are Skipped Automatically

```csharp
var query = new ProductQuery
{
    Name = "phone",  // generates a filter condition
    CategoryId = null,  // skipped automatically
    MinPrice = 0  // ⚠️ Note: 0 is not skipped
};

// Only the Name filter condition is generated
var filterGroup = query.GenerateFilterGroup();
```

### 3. Use the In Operator

```csharp
public class OrderQuery : IDynamicQueryObj
{
    [DynamicFilter(OperatorType = ValueOperatorType.In)]
    public List<OrderStatus>? Statuses { get; set; }
}

// Usage
var query = new OrderQuery
{
    Statuses = new List<OrderStatus> 
    { 
        OrderStatus.Pending, 
        OrderStatus.Processing 
    }
};

// Generates: o => new[] { 0, 1 }.Contains(o.Status)
```

### 4. Handle Nullable Types

```csharp
// ✅ Correct: use nullable types
public class ProductQuery : IDynamicQueryObj
{
    [DynamicFilter(OperatorType = ValueOperatorType.Equal)]
    public int? CategoryId { get; set; }  // Nullable
}

// ❌ Wrong: non-nullable types have default value issues
public class ProductQuery : IDynamicQueryObj
{
    [DynamicFilter(OperatorType = ValueOperatorType.Equal)]
    public int CategoryId { get; set; }  // The default value 0 generates a filter condition
}
```

### 5. Combine Filter and Sort

```csharp
// ✅ Correct: filter first, then sort
var result = await _repository.Query()
    .Filter(filterGroup)
    .Sort(sort)
    .Skip(skip)
    .Take(pageSize)
    .ToListAsync();

// ❌ Not recommended: sort first, then filter
var result = await _repository.Query()
    .Sort(sort)
    .Filter(filterGroup)  // may affect the sorting result
    .ToListAsync();
```

## Implementation Details and Notes

1. **Null value skipping**: null values are skipped automatically, no filter condition is generated
2. **Type conversion**: uses `TypeDescriptor.GetConverter` or `System.Convert.ChangeType`
3. **Conversion failure**: throws an `InvalidOperationException`
4. **In operator**: automatically converted to a strongly-typed List
5. **Property access restriction**: only public get properties are allowed
6. **Thread safety**: generated expressions are thread-safe

## Debugging Suggestions

### View the Generated Expression

```csharp
var filterGroup = query.GenerateFilterGroup();
var expression = _repository.Query().GetFilterExpression();

// Print the expression
Console.WriteLine(expression?.ToString());
// Output: p => (p.Name.Contains("phone") AndAlso (p.Price >= 1000))
```

### Test Boundary Values

```csharp
// Test an empty string
var query1 = new ProductQuery { Name = "" };  // will be skipped

// Test the value 0
var query2 = new ProductQuery { MinPrice = 0 };  // will not be skipped

// Test an empty collection
var query3 = new OrderQuery { Statuses = new List<OrderStatus>() };  // will be skipped
```

## Important Notes

1. **Null value handling**: null, empty strings, and empty collections are skipped automatically
2. **Type safety**: compile-time type checking avoids runtime errors
3. **EF Core compatibility**: the generated expressions can be translated to SQL by EF Core
4. **Nested properties**: dot notation is supported for accessing nested properties
5. **Thread safety**: can be used safely in multi-threaded environments
