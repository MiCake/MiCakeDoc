---
title: DataDepositPool 数据存储池
description: 带容量限制的临时数据存储池，适用于需要临时存储和检索数据的场景
slug: 10.0.0/utilities/storage
---

`DataDepositPool` 是一个带容量限制的临时数据存储池，适用于需要临时存储和检索数据的场景。

## 命名空间

```csharp
using MiCake.Util.Store;
```

## 构造函数

```csharp
// 默认容量 1000
var pool = new DataDepositPool();

// 自定义容量
var pool = new DataDepositPool(maxCapacity: 5000);
```

## 核心方法

### Deposit - 存储数据

```csharp
// 存储数据
pool.Deposit("user-1", userData);

// 替换已存在的数据
pool.Deposit("user-1", newUserData, isReplace: true);
```

**参数说明：**

* `key`: 数据的唯一标识符
* `value`: 要存储的数据对象
* `isReplace`: 是否替换已存在的数据（默认 false）

### TakeOut - 获取数据

```csharp
// 获取数据（返回 object）
object? data = pool.TakeOut("user-1");

// 获取指定类型的数据
User? user = pool.TakeOut<User>("user-1");

// 数据不存在时返回 null
var notFound = pool.TakeOut<User>("not-exists"); // null
```

### TakeOutByType - 按类型获取

```csharp
// 获取指定类型的所有数据
List<object> users = pool.TakeOutByType(typeof(User));

// 转换为强类型
List<User> typedUsers = users.Cast<User>().ToList();
```

### ReleaseAll - 释放所有数据

```csharp
pool.ReleaseAll();
```

## 属性

| 属性 | 说明 |
|------|------|
| `Count` | 当前存储的数据数量 |
| `MaxCapacity` | 最大容量 |

## 使用示例

### 临时数据缓存

```csharp
public class SessionStore : ISingletonService
{
    private readonly DataDepositPool _pool = new(maxCapacity: 10000);
    
    public void StoreSession(string sessionId, SessionData data)
    {
        _pool.Deposit(sessionId, data, isReplace: true);
    }
    
    public SessionData? GetSession(string sessionId)
    {
        return _pool.TakeOut<SessionData>(sessionId);
    }
    
    public void RemoveSession(string sessionId)
    {
        _pool.TakeOut(sessionId); // 获取并移除
    }
    
    public void ClearAllSessions()
    {
        _pool.ReleaseAll();
    }
    
    public int GetActiveSessionCount()
    {
        return _pool.Count;
    }
}
```

### 中间结果存储

```csharp
public class BatchProcessor
{
    private readonly DataDepositPool _resultPool = new();
    
    public async Task ProcessBatchAsync(List<Item> items)
    {
        // 并行处理
        await Parallel.ForEachAsync(items, async (item, ct) =>
        {
            var result = await ProcessItemAsync(item);
            _resultPool.Deposit($"result-{item.Id}", result);
        });
    }
    
    public List<ProcessResult> GetAllResults()
    {
        return _resultPool.TakeOutByType(typeof(ProcessResult))
            .Cast<ProcessResult>()
            .ToList();
    }
    
    public ProcessResult? GetResult(string itemId)
    {
        return _resultPool.TakeOut<ProcessResult>($"result-{itemId}");
    }
    
    public void Complete()
    {
        _resultPool.ReleaseAll();
        _resultPool.Dispose();
    }
}
```

### 工作流状态管理

```csharp
public class WorkflowEngine
{
    private readonly DataDepositPool _statePool = new(maxCapacity: 1000);
    
    public void SaveWorkflowState(string workflowId, WorkflowState state)
    {
        try
        {
            _statePool.Deposit(workflowId, state, isReplace: true);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("capacity"))
        {
            // 容量不足，清理旧状态
            CleanupOldStates();
            _statePool.Deposit(workflowId, state, isReplace: true);
        }
    }
    
    public WorkflowState? LoadWorkflowState(string workflowId)
    {
        return _statePool.TakeOut<WorkflowState>(workflowId);
    }
    
    public List<WorkflowState> GetAllActiveWorkflows()
    {
        return _statePool.TakeOutByType(typeof(WorkflowState))
            .Cast<WorkflowState>()
            .Where(s => s.IsActive)
            .ToList();
    }
    
    private void CleanupOldStates()
    {
        var allStates = _statePool.TakeOutByType(typeof(WorkflowState))
            .Cast<WorkflowState>()
            .ToList();
            
        // 只保留最近的 800 个
        var toKeep = allStates
            .OrderByDescending(s => s.LastModified)
            .Take(800)
            .ToList();
            
        _statePool.ReleaseAll();
        
        foreach (var state in toKeep)
        {
            _statePool.Deposit(state.WorkflowId, state);
        }
    }
}
```

### 请求上下文存储

```csharp
public class RequestContextStore
{
    private readonly DataDepositPool _pool = new();
    
    public void StoreContext(string requestId, RequestContext context)
    {
        _pool.Deposit(requestId, context);
    }
    
    public RequestContext? GetContext(string requestId)
    {
        return _pool.TakeOut<RequestContext>(requestId);
    }
    
    // 在请求结束时清理
    public void CleanupRequest(string requestId)
    {
        _pool.TakeOut(requestId);
    }
}

// 在中间件中使用
public class RequestContextMiddleware
{
    private readonly RequestContextStore _store;
    
    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var requestId = Guid.NewGuid().ToString();
        
        _store.StoreContext(requestId, new RequestContext
        {
            RequestId = requestId,
            StartTime = DateTime.UtcNow,
            UserId = context.User.FindFirst("sub")?.Value
        });
        
        try
        {
            await next(context);
        }
        finally
        {
            _store.CleanupRequest(requestId);
        }
    }
}
```

## 异常处理

| 场景 | 异常 | 说明 |
|------|------|------|
| key 为 null | `ArgumentNullException` | 键不能为 null |
| key 已存在且 isReplace = false | `InvalidOperationException` | 键已存在 |
| 超出容量限制 | `InvalidOperationException` | 超过最大容量 |
| 已释放后操作 | `ObjectDisposedException` | 对象已释放 |

### 异常处理示例

```csharp
public class SafeDataPool
{
    private readonly DataDepositPool _pool = new(maxCapacity: 1000);
    
    public bool TryDeposit(string key, object value)
    {
        try
        {
            _pool.Deposit(key, value);
            return true;
        }
        catch (ArgumentNullException)
        {
            _logger.LogError("Key cannot be null");
            return false;
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("capacity"))
        {
            _logger.LogWarning("Pool capacity exceeded");
            return false;
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("already exists"))
        {
            _logger.LogInformation("Key already exists, use isReplace=true to update");
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error");
            return false;
        }
    }
}
```

## 最佳实践

### 1. 设置合理容量

```csharp
// ✅ 正确：根据预期数据量设置容量
var pool = new DataDepositPool(maxCapacity: EstimateMaxDataItems());

// ❌ 错误：容量过小
var pool = new DataDepositPool(maxCapacity: 10); // 容易超限

// ❌ 错误：容量过大
var pool = new DataDepositPool(maxCapacity: 1000000); // 占用过多内存
```

### 2. 及时释放

```csharp
// ✅ 正确：使用完毕后释放
using (var pool = new DataDepositPool())
{
    // 使用 pool
}

// 或手动释放
var pool = new DataDepositPool();
try
{
    // 使用 pool
}
finally
{
    pool.Dispose();
}
```

### 3. 使用泛型方法

```csharp
// ✅ 正确：使用泛型方法获取强类型数据
var user = pool.TakeOut<User>("user-1");

// ❌ 不推荐：需要手动转换
object? obj = pool.TakeOut("user-1");
var user = obj as User; // 需要额外转换
```

### 4. 处理容量异常

```csharp
// ✅ 正确：处理容量超限
public void AddData(string key, object value)
{
    try
    {
        _pool.Deposit(key, value);
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("capacity"))
    {
        // 清理策略 1: 释放所有数据
        _pool.ReleaseAll();
        _pool.Deposit(key, value);
        
        // 或策略 2: 移除最旧的数据
        // RemoveOldestData();
        // _pool.Deposit(key, value);
    }
}
```

### 5. 注册为单例

```csharp
// ✅ 正确：注册为单例
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        context.Services.AddSingleton<DataDepositPool>(sp =>
            new DataDepositPool(maxCapacity: 1000));
        
        base.ConfigureServices(context);
    }
}

// ❌ 错误：注册为瞬时或作用域
services.AddScoped<DataDepositPool>(); // 每个请求新实例，失去缓存意义
```

## 性能考虑

| 操作 | 时间复杂度 | 说明 |
|------|-----------|------|
| `Deposit` | O(1) | 字典插入 |
| `TakeOut` | O(1) | 字典查找并移除 |
| `TakeOutByType` | O(n) | 需要遍历所有数据 |
| `ReleaseAll` | O(1) | 清空字典 |

### 性能优化建议

```csharp
// ✅ 推荐：使用 TakeOut（O(1)）
var data = pool.TakeOut<User>("user-1");

// ⚠️ 注意：TakeOutByType 性能较差（O(n)）
var allUsers = pool.TakeOutByType(typeof(User)); // 避免频繁调用
```

## 注意事项

1. **容量限制**：超出容量会抛出异常，需提前处理
2. **数据移除**：`TakeOut` 会移除数据，再次获取返回 null
3. **线程安全**：内部使用字典，不保证线程安全，需外部同步
4. **内存占用**：存储的数据会占用内存，及时释放不需要的数据
5. **类型检查**：`TakeOutByType` 使用 `is` 进行类型检查

## 适用场景

### ✅ 适合使用

* 会话存储
* 中间结果缓存
* 工作流状态管理
* 请求上下文存储
* 临时数据交换

### ❌ 不适合使用

* 长期数据存储（使用数据库）
* 大对象存储（占用过多内存）
* 需要持久化的数据
* 分布式场景（单机内存）
* 高并发写入（需额外同步）
