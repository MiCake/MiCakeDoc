---
title: DataDepositPool Data Storage Pool
description: A temporary data storage pool with capacity limits, suitable for scenarios that need to temporarily store and retrieve data
---

`DataDepositPool` is a temporary data storage pool with capacity limits, suitable for scenarios that need to temporarily store and retrieve data.

## Namespace

```csharp
using MiCake.Util.Store;
```

## Constructor

```csharp
// Default capacity is 1000
var pool = new DataDepositPool();

// Custom capacity
var pool = new DataDepositPool(maxCapacity: 5000);
```

## Core Methods

### Deposit - Store Data

```csharp
// Store data
pool.Deposit("user-1", userData);

// Replace existing data
pool.Deposit("user-1", newUserData, isReplace: true);
```

**Parameter description:**
- `key`: the unique identifier of the data
- `value`: the data object to store
- `isReplace`: whether to replace existing data (default false)

### TakeOut - Get Data

```csharp
// Get data (returns object)
object? data = pool.TakeOut("user-1");

// Get data of a specified type
User? user = pool.TakeOut<User>("user-1");

// Returns null when the data doesn't exist
var notFound = pool.TakeOut<User>("not-exists"); // null
```

### TakeOutByType - Get by Type

```csharp
// Get all data of a specified type
List<object> users = pool.TakeOutByType(typeof(User));

// Convert to a strongly-typed list
List<User> typedUsers = users.Cast<User>().ToList();
```

### ReleaseAll - Release All Data

```csharp
pool.ReleaseAll();
```

## Properties

| Property | Description |
|----------|-------------|
| `Count` | The current number of stored data items |
| `MaxCapacity` | The maximum capacity |

## Usage Examples

### Temporary Data Caching

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
        _pool.TakeOut(sessionId); // get and remove
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

### Intermediate Result Storage

```csharp
public class BatchProcessor
{
    private readonly DataDepositPool _resultPool = new();
    
    public async Task ProcessBatchAsync(List<Item> items)
    {
        // Process in parallel
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

### Workflow State Management

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
            // Not enough capacity, clean up old states
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
            
        // Keep only the most recent 800
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

### Request Context Storage

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
    
    // Clean up at the end of the request
    public void CleanupRequest(string requestId)
    {
        _pool.TakeOut(requestId);
    }
}

// Using in middleware
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

## Exception Handling

| Scenario | Exception | Description |
|----------|-----------|-------------|
| key is null | `ArgumentNullException` | The key cannot be null |
| key already exists and isReplace = false | `InvalidOperationException` | The key already exists |
| Capacity limit exceeded | `InvalidOperationException` | Exceeds the maximum capacity |
| Operation after disposal | `ObjectDisposedException` | The object has been disposed |

### Exception Handling Example

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

## Best Practices

### 1. Set a Reasonable Capacity

```csharp
// ✅ Correct: set the capacity based on the expected data volume
var pool = new DataDepositPool(maxCapacity: EstimateMaxDataItems());

// ❌ Wrong: capacity too small
var pool = new DataDepositPool(maxCapacity: 10); // easily exceeds the limit

// ❌ Wrong: capacity too large
var pool = new DataDepositPool(maxCapacity: 1000000); // consumes too much memory
```

### 2. Release Promptly

```csharp
// ✅ Correct: release after use
using (var pool = new DataDepositPool())
{
    // Use the pool
}

// Or release manually
var pool = new DataDepositPool();
try
{
    // Use the pool
}
finally
{
    pool.Dispose();
}
```

### 3. Use Generic Methods

```csharp
// ✅ Correct: use generic methods to get strongly-typed data
var user = pool.TakeOut<User>("user-1");

// ❌ Not recommended: requires manual conversion
object? obj = pool.TakeOut("user-1");
var user = obj as User; // requires extra conversion
```

### 4. Handle Capacity Exceptions

```csharp
// ✅ Correct: handle capacity overflows
public void AddData(string key, object value)
{
    try
    {
        _pool.Deposit(key, value);
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("capacity"))
    {
        // Cleanup strategy 1: release all data
        _pool.ReleaseAll();
        _pool.Deposit(key, value);
        
        // Or strategy 2: remove the oldest data
        // RemoveOldestData();
        // _pool.Deposit(key, value);
    }
}
```

### 5. Register as a Singleton

```csharp
// ✅ Correct: register as a singleton
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        context.Services.AddSingleton<DataDepositPool>(sp =>
            new DataDepositPool(maxCapacity: 1000));
        
        base.ConfigureServices(context);
    }
}

// ❌ Wrong: register as transient or scoped
services.AddScoped<DataDepositPool>(); // a new instance per request, losing the caching purpose
```

## Performance Considerations

| Operation | Time complexity | Description |
|-----------|-----------------|-------------|
| `Deposit` | O(1) | Dictionary insertion |
| `TakeOut` | O(1) | Dictionary lookup and removal |
| `TakeOutByType` | O(n) | Requires iterating over all data |
| `ReleaseAll` | O(1) | Clears the dictionary |

### Performance Optimization Suggestions

```csharp
// ✅ Recommended: use TakeOut (O(1))
var data = pool.TakeOut<User>("user-1");

// ⚠️ Note: TakeOutByType has worse performance (O(n))
var allUsers = pool.TakeOutByType(typeof(User)); // avoid frequent calls
```

## Important Notes

1. **Capacity limit**: exceeding the capacity throws an exception, handle it in advance
2. **Data removal**: `TakeOut` removes the data; retrieving it again returns null
3. **Thread safety**: internally uses a dictionary, thread safety is not guaranteed, external synchronization is needed
4. **Memory usage**: stored data occupies memory, release unneeded data promptly
5. **Type checking**: `TakeOutByType` uses `is` for type checking

## Suitable Scenarios

### ✅ Suitable for

- Session storage
- Intermediate result caching
- Workflow state management
- Request context storage
- Temporary data exchange

### ❌ Not suitable for

- Long-term data storage (use a database)
- Large object storage (consumes too much memory)
- Data that needs to be persisted
- Distributed scenarios (single-machine memory)
- High-concurrency writes (requires extra synchronization)
