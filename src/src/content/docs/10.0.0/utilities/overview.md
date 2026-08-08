---
title: 工具集概览
description: MiCake 提供的实用工具类和辅助功能，帮助您更高效地开发应用程序
slug: 10.0.0/utilities/overview
---

MiCake 提供了一系列实用工具类，帮助您更高效地开发应用程序。本页面是工具集的导航页，点击各工具链接查看详细文档。

## 工具分类

| 分类 | 工具 | 说明 |
|------|------|------|
| 缓存工具 | [BoundedLruCache](./cache/bounded-lru-cache) | 线程安全的 LRU 缓存，支持容量限制和分段策略 |
| 类型转换 | [ValueConverter](./converter) | 统一的类型转换接口，支持自定义转换器注册 |
| 查询工具 | [DynamicQuery](./query) | 动态查询构建器，支持基于属性特性自动生成过滤条件 |
| 弹性工具 | [CircuitBreaker](./resilience) | 熔断器模式实现，保护系统免受外部服务故障影响 |
| 存储工具 | [DataDepositPool](./storage) | 带容量限制的临时数据存储池 |

## 快速开始

### 命名空间

```csharp
// 缓存
using MiCake.Util.Cache;

// 类型转换
using MiCake.Util.Convert;

// 动态查询和分页
using MiCake.Util.Query.Dynamic;
using MiCake.Util.Query.Paging;

// 弹性工具
using MiCake.Util.Resilience;

// 存储
using MiCake.Util.Store;

// 验证和随机
using MiCake.Util;

// 扩展方法
using MiCake.Util.Extensions;
```

### 常用示例

```csharp
// 参数验证
CheckValue.NotNullOrEmpty(name, nameof(name));

// 类型转换
int value = ValueConverter.Convert<string, int>("123");

// 字符串扩展
bool isEmpty = str.IsNullOrWhiteSpace();
string camel = "HelloWorld".ToCamelCase();

// 集合扩展
list.AddIfNotContains(item);

// 随机选择
var item = RandomHelper.GetRandomOfList(items);
```

## 最佳实践

1. **合理使用缓存**：缓存不经常变化的数据
2. **使用熔断器保护外部调用**：并提供降级方案
3. **工具类使用单例**：在 DI 容器中注册为单例
4. **参数验证前置**：在方法开头进行参数验证
5. **使用扩展方法**：简化常见操作

## 工具使用建议

### 缓存使用场景

```csharp
// ✅ 适合缓存
- 配置数据
- 字典数据
- 不经常变化的业务数据

// ❌ 不适合缓存
- 用户敏感数据
- 频繁变化的数据
- 大对象数据
```

### 熔断器使用场景

```csharp
// ✅ 适合使用熔断器
- 外部 API 调用
- 数据库查询（非核心业务）
- 第三方服务集成

// ⚠️ 需要提供降级方案
- 返回缓存数据
- 返回默认值
- 返回友好错误信息
```

### 类型转换注意事项

```csharp
// ✅ 正确：处理转换失败
int? value = ValueConverter.Convert<string, int?>("invalid");
if (value == null)
{
    // 处理转换失败
}

// ⚠️ 注意：Convert 失败返回默认值而不是抛出异常
var result = ValueConverter.Convert<string, int>("abc"); // 返回 0
```

## 下一步

* 查看各个工具的详细文档
* 了解最佳实践和使用示例
* 探索自定义扩展和集成方案
