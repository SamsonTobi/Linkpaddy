# AGENTS.md

### General Development Principles
- **Backward Compatibility**: Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- **Simplest Implementation**: Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- **Layered Growth**: Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- **Modular Components**: Keep components modular and concerns clearly separated.
- **Library Selection**: Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- **Dependency Minimization**: Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- **Long-Term Decisions**: Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

---

### Senior Engineer Code Review (Mandatory Trigger)
Every time you make a change involving the **domain layer**, a **refactoring of a feature**, or a **major bug fix**, you must execute the following review on the code you just wrote before finalizing:

Review the code you just wrote for this task as a senior engineer. Don’t change anything yet. Check for:

- **Correctness** — does it actually satisfy the original requirements and edge cases?
- **Bugs** — logic errors, race conditions, null/undefined issues, incorrect assumptions, etc.
- **Architecture** — is the implementation structured appropriately and consistent with the existing codebase?
- **Code quality** — readability, maintainability, duplication, unnecessary complexity, and naming.
- **Integration** — could it break existing functionality, APIs, state, database behavior, or other parts of the app?
- **Security** — auth, permissions, input validation, data exposure, secrets, and common vulnerabilities.
- **Performance** — unnecessary queries, renders, network calls, expensive operations, or memory issues.
- **Error handling** — failures, loading states, empty states, and unexpected inputs.
- **Consistency** — follow the project’s existing patterns, conventions, and abstractions rather than introducing unnecessary new ones.

Compare the implementation against the original task, not just whether the code compiles.
Give me a concise list of issues, ranked Critical / Important / Minor, and explain exactly what should be fixed. If everything looks good, say so explicitly.

