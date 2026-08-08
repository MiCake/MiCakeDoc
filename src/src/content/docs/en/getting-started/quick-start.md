---
title: Quick Start
---

This guide will help you create an `ASP.NET Core` application based on MiCake using the template project:

## Prerequisites

Before you begin, make sure your development environment meets the following requirements:

- **.NET Core 10.0** or later
- **Visual Studio Code** or **Visual Studio 2022 (or later)**
- Basic knowledge of **C#** and **ASP.NET Core**
- Basic understanding of **Entity Framework Core** (optional)

## Start from a Template

The following steps will guide you through creating a new project quickly using the `dotnet new` templates provided by MiCake. Make sure you have the latest .NET SDK installed first.

If you want to build on top of your own project, see [Integrating with an Existing Project](./from-custom).

### 1. Install the Template Pack

First, install the MiCake.Templates template pack:

```bash
dotnet new install MiCake.Templates
```

### 2. Create a New Project

MiCake.Templates provides two templates:

- **Standard WebAPI template** (`micake-webapi`): a standard ASP.NET Core Web API template based on MiCake, including a basic DDD architecture.
- **WebAPI template with RBAC** (`micake-webapi-rbac`): adds role-based access control (RBAC) on top of the standard template.

Choose the appropriate template to create your project:

```bash
# Create a standard WebAPI project
dotnet new micake-webapi -n MyProjectName

# Or create a WebAPI project with RBAC
dotnet new micake-webapi-rbac -n MyProjectName
```

### 3. Configure and Run the Project

Enter the project directory:

```bash
cd MyProjectName
```

Build the project:

```bash
dotnet build
```

Run the project:

```bash
dotnet run
```

Once the project starts, you can visit `http://localhost:port/scalar/v1` in your browser to view the API documentation (the Scalar OpenAPI interface is enabled by default in the development environment).

### 4. Database Configuration (Optional)

The template uses PostgreSQL by default. To run the full functionality, make sure the database is configured:

- Update the connection string in `appsettings.Development.json`.
- Use EF Core migration tooling to initialize the database (see the README file in the project).

## Next Steps

Congratulations! You have successfully built a DDD application based on MiCake. Next, you can:
