---
title: MiCake Introduction
description: Learn what MiCake is and what it can do for you
---

## What is `MiCake`?

**`MiCake`** is a lightweight `Domain-Driven Design (DDD) toolkit` built on .NET. It helps developers quickly convert existing projects to a DDD style while keeping code simple and flexible.

MiCake is not a "framework" in the traditional sense, but a convenient "toolbox". It provides the components and tools needed to practice DDD without forcing you to change your development habits.

## Core Features

### 🚀 Fast

Quickly convert your project to a DDD style so you can focus on writing domain code instead of framework configuration. With simple configuration and a small amount of code, you can upgrade an existing project to a DDD architecture.

### 📐 Standard

Implements almost all of the core tactical patterns of DDD:

- `Entity`: a domain object with a unique identity
- `Value Object`: an immutable object compared by property values
- `Aggregate Root`: the root entity of an aggregate, serving as the entry point for external access
- `Repository`: provides persistence operations for aggregate roots
- `Domain Event`: captures important events that occur in the domain
- `Domain Service`: encapsulates domain logic that does not belong to entities or value objects
- `Unit of Work`: manages business transactions and data consistency

### 🎯 Convenient

Provides common infrastructure features for project development:

- **Global exception handling**: unified exception catching and handling
- **Unified response format**: standardized API response structure
- **Automatic audit**: automatically records creation and modification times of entities
- **Soft delete support**: logically deletes entities instead of physically deleting them
- **Enhanced dependency injection**: simplifies service registration and lifecycle management
- **Rich utilities**: cache, converter, query, resilience, and other practical tools

### 🪶 Lightweight

"Lightweight" is the core design philosophy of MiCake:

- **Non-intrusive**: integrates seamlessly into existing projects without changing your coding habits
- **Low coupling**: framework code is clearly separated from business code
- **Optional usage**: DDD is not mandatory; you can introduce it gradually
- **Almost invisible**: when you don't use DDD features, you may not even notice it exists

## Design Philosophy

MiCake was positioned as **"a very thin layer"** from the very beginning:

<table>
  <tr>
    <th style="width: 120px;">Philosophy</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>Non-intrusive</td>
    <td>MiCake wraps your .NET project without interfering. You can still use your original coding habits, familiar libraries, and tools. It does not force you to adopt a specific coding style or architecture pattern.</td>
  </tr>
  <tr>
    <td>Freedom &amp; No Constraints</td>
    <td>MiCake does not constrain your development style. It simply provides tools and components that you can use selectively. You can use part of MiCake's features and freely combine them with other frameworks and libraries.</td>
  </tr>
  <tr>
    <td>Not DDD</td>
    <td>MiCake itself is not DDD; it simply helps you practice DDD better. DDD is a methodology, while MiCake is a tool for practicing that methodology. You need to understand DDD concepts to use MiCake effectively.</td>
  </tr>
  <tr>
    <td>Progressive Adoption</td>
    <td>You can start with the simplest features and gradually introduce more DDD features:<br>1. Start with the module system and dependency injection<br>2. Then introduce entities and repositories<br>3. Then gradually refine your domain model</td>
  </tr>
</table>

## When to Use MiCake

MiCake is particularly suitable for the following scenarios:

<table>
  <tr>
    <th style="width: 180px;">Scenario</th>
    <th>Characteristics</th>
  </tr>
  <tr>
    <td>New project development</td>
    <td>- Want to build a new .NET application using DDD<br>- Need to quickly scaffold a project with a clear architecture<br>- The team is familiar with DDD or wants to learn it</td>
  </tr>
  <tr>
    <td>Refactoring an existing project</td>
    <td>- Want to gradually refactor an existing project to a DDD style<br>- Need to improve code maintainability and testability<br>- Want to introduce a better way of organizing business logic</td>
  </tr>
  <tr>
    <td>Small and medium enterprise applications</td>
    <td>- Business systems with moderate complexity<br>- Need a good architecture but don't want a heavyweight framework<br>- Want to keep the technology stack flexible</td>
  </tr>
  <tr>
    <td>Learning and practicing DDD</td>
    <td>- Learning the concepts and practices of domain-driven design<br>- Need a lightweight DDD reference implementation<br>- Want to apply DDD in real projects</td>
  </tr>
</table>

## Requirements

### Development Environment

- **.NET Core 10.0** or later
- **Visual Studio Code** (recommended)
- or **Visual Studio 2026** or later

## Performance Considerations

As a lightweight toolkit, MiCake has a negligible impact on performance:

- **Minimal runtime overhead**: core abstractions are based on interfaces, which JIT optimizes well
- **On-demand loading**: modular design, only loads the features you use
- **No reflection abuse**: avoids reflection on critical paths
- **Memory friendly**: reasonable object lifecycle management

## Community & Support

### Official Resources

- **GitHub repository**: [https://github.com/MiCake/MiCake](https://github.com/MiCake/MiCake)
- **Official website**: [https://micake.github.io/](https://micake.github.io/)
- **NuGet packages**: [Search "MiCake" to see all available packages](https://www.nuget.org/packages?q=MiCake)

### Getting Help

- **Bug reports**: submit bugs or feature requests via GitHub Issues
- **Discussions**: discuss usage questions in GitHub Discussions
- **Tech blog**: follow the author's blog for the latest updates

### Contributing

We welcome community contributions! You can:

- Submit a Pull Request to improve the code
- Improve documentation and examples
- Share usage experience and best practices
- Help answer other users' questions

## Versioning

MiCake follows Semantic Versioning (SemVer):

- **Major version**: incompatible API changes
- **Minor version**: backward-compatible feature additions
- **Patch version**: backward-compatible bug fixes

The current version supports .NET 10.0+, and will continue to follow new .NET releases in the future.

## Next Steps

- Read [Quick Start](../quick-start/) to learn how to integrate MiCake into your project
- Learn [Core Concepts](../core-concepts/) to understand MiCake's key concepts
- Explore the [Domain-Driven Design](../../domain-driven/entity/) section to learn about DDD components
