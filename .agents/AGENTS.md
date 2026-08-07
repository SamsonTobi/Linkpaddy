# AGENTS.md

- **Backward Compatibility**: Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- **Simplest Implementation**: Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- **Layered Growth**: Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- **Modular Components**: Keep components modular and concerns clearly separated.
- **Library Selection**: Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- **Dependency Minimization**: Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- **Long-Term Decisions**: Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
