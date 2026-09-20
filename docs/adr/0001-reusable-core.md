# Use one reusable numerical implementation

The C# library owns numerical computation and lives in its own repository, included by pinned submodule in the teaching app. A local C# API invokes it instead of maintaining a browser solver: this costs a backend runtime and submodule coordination but keeps teaching behavior and reusable-library behavior identical and independently testable.
