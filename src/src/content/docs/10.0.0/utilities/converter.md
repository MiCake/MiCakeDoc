---
title: ValueConverter 类型转换工具
description: 统一的类型转换接口，支持注册自定义转换器和内置类型转换
slug: 10.0.0/utilities/converter
---

`ValueConverter` 提供统一的类型转换接口，使用注册表模式管理转换器，支持内置和自定义转换器。

## 命名空间

```csharp
using MiCake.Util.Convert;
```

## 基本用法

### Convert 方法

```csharp
// 字符串转整数
int intValue = ValueConverter.Convert<string, int>("123");

// 字符串转日期
DateTime dateValue = ValueConverter.Convert<string, DateTime>("2024-01-01");

// Guid 转换
Guid guid = ValueConverter.Convert<string, Guid>("550e8400-e29b-41d4-a716-446655440000");

// Version 转换
Version? version = ValueConverter.Convert<string, Version>("1.2.3");
```

### Convert 方法行为

* **null 值处理**: 源值为 null 时会抛出 `ArgumentNullException`
* **转换失败**: 失败时返回目标类型的默认值（如 `0`、`null`、`Guid.Empty`）而不抛出异常
* **转换顺序**:
  1. 查询注册表中的自定义转换器（按注册顺序）
  2. 使用内置的 `SystemValueConverter` 作为后备

## 自定义转换器

### 创建转换器

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

### 注册转换器

```csharp
// 使用工厂方法注册
ValueConverter.RegisterConverter(() => new MoneyConverter());

// 使用实例注册
ValueConverter.RegisterConverter(new MoneyConverter());

// 泛型注册
ValueConverter.RegisterConverter<string, Money>(() => new MoneyConverter());
```

### 使用自定义转换器

```csharp
// 注册后直接使用
var money = ValueConverter.Convert<string, Money>("99.99 USD");
Console.WriteLine($"{money.Amount} {money.Currency}"); // 99.99 USD
```

## 注册表管理

### HasConverter - 检查转换器

```csharp
if (ValueConverter.HasConverter<string, Money>())
{
    Console.WriteLine("转换器已注册");
}
```

### ClearConverters - 清除指定转换器

```csharp
// 清除 string 到 Money 的所有转换器
ValueConverter.ClearConverters<string, Money>();
```

### ClearAll - 清空所有转换器

```csharp
// 清空所有自定义转换器（内置转换器也会被清除）
ValueConverter.ClearAll();
```

### SetRegistry - 设置自定义注册表

```csharp
// 创建自定义注册表
var customRegistry = new DefaultConverterRegistry();
customRegistry.Register<string, MyType>(() => new MyTypeConverter());

// 应用自定义注册表
ValueConverter.SetRegistry(customRegistry);
```

### ResetRegistry - 重置为默认注册表

```csharp
// 重置为默认注册表并重新注册内置转换器
ValueConverter.ResetRegistry();
```

## 内置转换器

MiCake 预注册了以下内置转换器：

### GuidValueConverter

```csharp
// 字符串转 Guid
Guid guid1 = ValueConverter.Convert<string, Guid>("550e8400-e29b-41d4-a716-446655440000");

// Guid 转 Guid（直接返回）
Guid guid2 = ValueConverter.Convert<Guid, Guid>(guid1);

// 失败时返回 Guid.Empty
Guid empty = ValueConverter.Convert<string, Guid>("invalid"); // Guid.Empty
```

### VersionValueConverter

```csharp
// 字符串转 Version
Version? version1 = ValueConverter.Convert<string, Version>("1.2.3");
Console.WriteLine(version1); // 1.2.3

// Version 转 Version（直接返回）
Version? version2 = ValueConverter.Convert<Version, Version>(version1);

// 失败时返回 null
Version? nullVersion = ValueConverter.Convert<string, Version>("invalid"); // null
```

### SystemValueConverter

作为后备转换器，使用 `System.Convert.ChangeType`：

```csharp
// 支持大多数基本类型转换
int intVal = ValueConverter.Convert<string, int>("42");
double doubleVal = ValueConverter.Convert<string, double>("3.14");
bool boolVal = ValueConverter.Convert<string, bool>("true");
DateTime dateVal = ValueConverter.Convert<string, DateTime>("2024-01-01");
```

## 注册表与线程安全

`DefaultConverterRegistry` 使用锁保护读写操作，确保线程安全：

```csharp
// 多线程环境下安全注册
Parallel.For(0, 100, i =>
{
    ValueConverter.RegisterConverter<string, int>(() => new MyIntConverter());
});
```

## 使用示例

### 复杂类型转换

```csharp
public class ProductDto
{
    public string Id { get; set; }
    public string Price { get; set; }
    public string Category { get; set; }
}

// 注册转换器
ValueConverter.RegisterConverter<string, int>(() => new StringToIntConverter());
ValueConverter.RegisterConverter<string, decimal>(() => new StringToDecimalConverter());

// 使用
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

### 在服务中使用

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

### 链式转换

```csharp
// 注册多个转换器实现链式转换
ValueConverter.RegisterConverter<string, Guid>(() => new StringToGuidConverter());
ValueConverter.RegisterConverter<Guid, int>(() => new GuidToIntConverter());

// 分步转换
string guidString = "550e8400-e29b-41d4-a716-446655440000";
Guid guid = ValueConverter.Convert<string, Guid>(guidString);
int hashCode = ValueConverter.Convert<Guid, int>(guid);
```

## 最佳实践

### 1. 注册特定转换器

```csharp
// ✅ 正确：注册专用转换器覆盖默认行为
ValueConverter.RegisterConverter<string, Money>(() => new MoneyConverter());

// ❌ 不推荐：依赖 SystemValueConverter 处理复杂类型
var money = ValueConverter.Convert<string, Money>("99.99 USD"); // 可能失败
```

### 2. 处理转换失败

```csharp
// ✅ 正确：检查返回值
int? value = ValueConverter.Convert<string, int?>("invalid");
if (value == null)
{
    Console.WriteLine("转换失败");
}

// ⚠️ 注意：非可空类型返回默认值
int defaultValue = ValueConverter.Convert<string, int>("invalid"); // 返回 0
```

### 3. 线程安全注册

```csharp
// ✅ 正确：在应用启动时注册
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        ValueConverter.RegisterConverter<string, Money>(() => new MoneyConverter());
        base.ConfigureServices(context);
    }
}

// ❌ 不推荐：在运行时频繁注册/清除
ValueConverter.RegisterConverter<string, int>(() => new MyConverter());
ValueConverter.ClearConverters<string, int>();
```

### 4. 转换器顺序

```csharp
// ✅ 正确：按优先级注册
ValueConverter.RegisterConverter<string, int>(() => new SpecialIntConverter()); // 优先
ValueConverter.RegisterConverter<string, int>(() => new GeneralIntConverter()); // 后备

// Convert 会按注册顺序尝试
int value = ValueConverter.Convert<string, int>("123"); // 使用 SpecialIntConverter
```

### 5. 实现幂等转换器

```csharp
// ✅ 正确：幂等转换器
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

// ❌ 错误：非幂等转换器
public class CountingConverter : IValueConverter<string, int>
{
    private int _count = 0;
    
    public int? Convert(string value)
    {
        return _count++; // 每次调用返回不同结果
    }
}
```

## 管理方法总结

| 方法 | 说明 |
|------|------|
| `Convert<TSource, TDest>(source)` | 转换值，失败返回默认值 |
| `RegisterConverter<TSource, TDest>(factory)` | 注册转换器工厂 |
| `RegisterConverter(converter)` | 注册转换器实例 |
| `HasConverter<TSource, TDest>()` | 检查是否存在转换器 |
| `ClearConverters<TSource, TDest>()` | 清除指定类型的转换器 |
| `ClearAll()` | 清除所有转换器 |
| `SetRegistry(registry)` | 设置自定义注册表 |
| `ResetRegistry()` | 重置为默认注册表 |

## 注意事项

1. **转换失败返回默认值**：`Convert` 方法不会抛出异常
2. **null 值抛出异常**：源值为 null 时抛出 `ArgumentNullException`
3. **转换器顺序**：按注册顺序尝试转换器
4. **线程安全**：`DefaultConverterRegistry` 支持线程安全操作
5. **内置后备**：`SystemValueConverter` 作为最后的后备转换器
