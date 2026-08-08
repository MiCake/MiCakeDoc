---
title: DynamicQuery 动态查询
description: 轻量级动态查询构建器，通过属性特性自动生成 LINQ 过滤和排序表达式
slug: 10.0.0/utilities/query
---

DynamicQuery 提供一套轻量、类型安全的构建块,用于在运行时根据 DTO/查询对象生成 LINQ 过滤和排序表达式。

## 命名空间

```csharp
using MiCake.Util.Query.Dynamic;
```

## 核心组件

### Filter - 单字段过滤器

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

### Sort - 排序

```csharp
var sort = new Sort
{
    PropertyName = "CreateTime",
    Ascending = false  // 降序
};
```

### FilterValue - 过滤值

```csharp
var filterValue = FilterValue.Create(
    value: "test",
    operatorType: ValueOperatorType.Contains
);
```

## 操作符类型 (ValueOperatorType)

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `Equal` | 等于 | `Name == "张三"` |
| `NotEqual` | 不等于 | `Status != 0` |
| `Contains` | 包含 | `Name.Contains("手机")` |
| `StartsWith` | 以...开始 | `Name.StartsWith("Apple")` |
| `EndsWith` | 以...结尾 | `Email.EndsWith("@example.com")` |
| `GreaterThan` | 大于 | `Price > 100` |
| `LessThan` | 小于 | `Stock < 10` |
| `GreaterThanOrEqual` | 大于等于 | `Age >= 18` |
| `LessThanOrEqual` | 小于等于 | `Price <= 1000` |

## 使用属性自动生成过滤

### 定义查询对象

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

### 生成过滤条件

```csharp
var queryDto = new ProductQueryDto
{
    Name = "手机",
    MinPrice = 1000,
    MaxPrice = 5000,
    CategoryId = 5
};

// 自动生成过滤条件
FilterGroup filterGroup = queryDto.GenerateFilterGroup();

// 生成的表达式等价于：
// p => p.Name.Contains("手机") 
//      && p.Price >= 1000 
//      && p.Price <= 5000 
//      && p.CategoryId == 5
```

### 应用到 IQueryable

```csharp
var query = _dbContext.Products.AsQueryable();

// 应用动态过滤
query = query.ApplyFilters(filterGroup);

// 应用排序
query = query.ApplySorting(new Sort 
{ 
    PropertyName = "Price", 
    Ascending = true 
});

// 执行查询
var products = await query.ToListAsync();
```

## FilterGroup 和 CompositeFilterGroup

### FilterGroup - 过滤组

组合多个过滤条件：

```csharp
var group = new FilterGroup
{
    Filters = new List<Filter>
    {
        Filter.Create("Name", new List<FilterValue> 
        { 
            FilterValue.Create("手机", ValueOperatorType.Contains) 
        }),
        Filter.Create("Price", new List<FilterValue> 
        { 
            FilterValue.Create(1000m, ValueOperatorType.GreaterThanOrEqual) 
        })
    },
    FiltersJoinType = FilterJoinType.And  // AND 连接
};

// 应用过滤组
var query = _dbContext.Products.Filter(group);
```

### CompositeFilterGroup - 复合过滤组

组合多个 FilterGroup：

```csharp
var composite = new CompositeFilterGroup
{
    FilterGroups = new List<FilterGroup>
    {
        new FilterGroup { /* 第一组条件 */ },
        new FilterGroup { /* 第二组条件 */ }
    },
    FilterGroupsJoinType = FilterJoinType.Or  // 组之间 OR 连接
};

// 应用复合过滤
var query = _dbContext.Products.Filter(composite);
```

## 嵌套属性

支持点号表示法访问嵌套属性：

```csharp
public class OrderQueryDto : IDynamicQueryObj
{
    [DynamicFilter(PropertyName = "Customer.Name", OperatorType = ValueOperatorType.Contains)]
    public string? CustomerName { get; set; }

    [DynamicFilter(PropertyName = "Address.City", OperatorType = ValueOperatorType.Equal)]
    public string? City { get; set; }
}

// 生成的表达式：
// o => o.Customer.Name.Contains("张三") && o.Address.City == "北京"
```

## 类级配置

使用 `[DynamicFilterJoin]` 配置类级别的连接类型：

```csharp
[DynamicFilterJoin(JoinType = FilterJoinType.And)]  // 默认 AND
public class ProductQuery : IDynamicQueryObj
{
    [DynamicFilter(OperatorType = ValueOperatorType.Contains)]
    public string? Name { get; set; }

    [DynamicFilter(OperatorType = ValueOperatorType.Equal)]
    public int? CategoryId { get; set; }
}

// 生成：Name.Contains("...") AND CategoryId == ...
```

## 使用示例

### Web API 中使用

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

### 复杂查询

```csharp
public class OrderQueryDto : IDynamicQueryObj
{
    // 订单号模糊查询
    [DynamicFilter(OperatorType = ValueOperatorType.Contains)]
    public string? OrderNumber { get; set; }

    // 订单状态（多选）
    [DynamicFilter(OperatorType = ValueOperatorType.In)]
    public List<OrderStatus>? Statuses { get; set; }

    // 金额范围
    [DynamicFilter(PropertyName = "TotalAmount", OperatorType = ValueOperatorType.GreaterThanOrEqual)]
    public decimal? MinAmount { get; set; }

    [DynamicFilter(PropertyName = "TotalAmount", OperatorType = ValueOperatorType.LessThanOrEqual)]
    public decimal? MaxAmount { get; set; }

    // 日期范围
    [DynamicFilter(PropertyName = "CreateTime", OperatorType = ValueOperatorType.GreaterThanOrEqual)]
    public DateTime? StartDate { get; set; }

    [DynamicFilter(PropertyName = "CreateTime", OperatorType = ValueOperatorType.LessThanOrEqual)]
    public DateTime? EndDate { get; set; }

    // 客户名称
    [DynamicFilter(PropertyName = "Customer.Name", OperatorType = ValueOperatorType.Contains)]
    public string? CustomerName { get; set; }
}
```

### 动态排序

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

### 多字段排序

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

## FilterExtensions 扩展方法

| 方法 | 说明 |
|------|------|
| `Filter(Filter)` | 应用单个过滤器 |
| `Filter(IEnumerable<Filter>)` | 应用多个过滤器 |
| `Filter(FilterGroup)` | 应用过滤组 |
| `Filter(CompositeFilterGroup)` | 应用复合过滤组 |
| `GetFilterExpression<T>()` | 获取过滤表达式 |

## SortingExtensions 扩展方法

| 方法 | 说明 |
|------|------|
| `Sort(Sort)` | 应用单个排序 |
| `Sort(IEnumerable<Sort>)` | 应用多个排序 |

## 最佳实践

### 1. 使用 IDynamicQueryObj

```csharp
// ✅ 正确：实现接口以使用扩展方法
public class ProductQuery : IDynamicQueryObj
{
    [DynamicFilter(OperatorType = ValueOperatorType.Contains)]
    public string? Name { get; set; }
}

// ❌ 错误：不实现接口
public class ProductQuery
{
    public string? Name { get; set; }
}
```

### 2. 空值自动跳过

```csharp
var query = new ProductQuery
{
    Name = "手机",  // 会生成过滤条件
    CategoryId = null,  // 自动跳过
    MinPrice = 0  // ⚠️ 注意：0 不会被跳过
};

// 只生成 Name 的过滤条件
var filterGroup = query.GenerateFilterGroup();
```

### 3. 使用 In 操作符

```csharp
public class OrderQuery : IDynamicQueryObj
{
    [DynamicFilter(OperatorType = ValueOperatorType.In)]
    public List<OrderStatus>? Statuses { get; set; }
}

// 使用
var query = new OrderQuery
{
    Statuses = new List<OrderStatus> 
    { 
        OrderStatus.Pending, 
        OrderStatus.Processing 
    }
};

// 生成：o => new[] { 0, 1 }.Contains(o.Status)
```

### 4. 处理可空类型

```csharp
// ✅ 正确：使用可空类型
public class ProductQuery : IDynamicQueryObj
{
    [DynamicFilter(OperatorType = ValueOperatorType.Equal)]
    public int? CategoryId { get; set; }  // 可空
}

// ❌ 错误：不可空类型会有默认值问题
public class ProductQuery : IDynamicQueryObj
{
    [DynamicFilter(OperatorType = ValueOperatorType.Equal)]
    public int CategoryId { get; set; }  // 默认值 0 会生成过滤条件
}
```

### 5. 组合 Filter 和 Sort

```csharp
// ✅ 正确：先过滤后排序
var result = await _repository.Query()
    .Filter(filterGroup)
    .Sort(sort)
    .Skip(skip)
    .Take(pageSize)
    .ToListAsync();

// ❌ 不推荐：先排序后过滤
var result = await _repository.Query()
    .Sort(sort)
    .Filter(filterGroup)  // 可能影响排序效果
    .ToListAsync();
```

## 实现细节与注意事项

1. **空值跳过**: null 值会被自动跳过,不生成过滤条件
2. **类型转换**: 使用 `TypeDescriptor.GetConverter` 或 `System.Convert.ChangeType`
3. **转换失败**: 抛出 `InvalidOperationException`
4. **In 操作符**: 自动转换为强类型 List
5. **属性访问限制**: 仅允许 public get 属性
6. **线程安全**: 生成的表达式是线程安全的

## 调试建议

### 查看生成的表达式

```csharp
var filterGroup = query.GenerateFilterGroup();
var expression = _repository.Query().GetFilterExpression();

// 打印表达式
Console.WriteLine(expression?.ToString());
// 输出: p => (p.Name.Contains("手机") AndAlso (p.Price >= 1000))
```

### 测试边界值

```csharp
// 测试空字符串
var query1 = new ProductQuery { Name = "" };  // 会被跳过

// 测试 0 值
var query2 = new ProductQuery { MinPrice = 0 };  // 不会被跳过

// 测试空集合
var query3 = new OrderQuery { Statuses = new List<OrderStatus>() };  // 会被跳过
```

## 注意事项

1. **空值处理**: null、空字符串、空集合会被自动跳过
2. **类型安全**: 编译时类型检查，避免运行时错误
3. **EF Core 兼容**: 生成的表达式可被 EF Core 翻译为 SQL
4. **嵌套属性**: 支持点号表示法访问嵌套属性
5. **线程安全**: 可在多线程环境中安全使用
