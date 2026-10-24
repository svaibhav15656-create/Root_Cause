const crypto = require('node:crypto');

/* ─────────────────────────────────────────────────────────────────────────────
   RootCause — Explainer Engine v2
   ~130 regex-based patterns across:
     • Node.js / JavaScript / TypeScript
     • Python
     • Java / Spring / JVM
     • Go
     • Ruby / Rails
     • PHP / Laravel
     • Rust
     • Docker / Kubernetes / Infrastructure
     • Database (Postgres, MySQL, MongoDB, Redis)
     • Networking / TLS / DNS
     • Authentication / Authorization
     • Memory / Performance
     • Generic error classes
   Falls back to the configured AI provider when no local pattern matches.
   ──────────────────────────────────────────────────────────────────────────── */

const PATTERNS = [
  // ═══════════════════════════ JAVASCRIPT / NODE.JS ═══════════════════════════
  {
    test: /cannot find module ['"]([^'"]+)['"]/i,
    title: m => `Module "${m[1]}" could not be found`,
    cause: 'Node.js tried to require or import a module that does not exist at the resolved path. This is usually a missing dependency or a typo in the import path.',
    steps: ['Run `npm install` (or `yarn install`) to install missing dependencies.', 'Check that the module name is spelled correctly in your import/require statement.', 'If it is a local file, verify the relative path matches the actual file location.'],
    confidence: 'High',
  },
  {
    test: /syntaxerror:.*unexpected token/i,
    title: () => 'JavaScript syntax error — unexpected token',
    cause: 'The JavaScript engine encountered a character or token it was not expecting. This often happens with malformed JSON, missing brackets, or incompatible ES module syntax.',
    steps: ['Check the exact line and column mentioned in the stack trace.', 'If parsing JSON, validate the JSON string with a linter or `JSON.parse()` in a try/catch.', 'Ensure your Node.js version supports the syntax you are using (e.g., optional chaining, top-level await).'],
    confidence: 'High',
  },
  {
    test: /referenceerror:.*is not defined/i,
    title: () => 'A variable or function is not defined',
    cause: 'The code references a name that has not been declared in the current scope. This can happen if a dependency was not imported, a variable was misspelled, or a function was called before its definition.',
    steps: ['Check that the variable or function is correctly imported or declared above the point of use.', 'Look for typos in the variable name.', 'If using ES modules, verify the export exists in the source module.'],
    confidence: 'High',
  },
  {
    test: /typeerror:.*is not a function/i,
    title: () => 'Something is being called as a function but is not',
    cause: 'The code attempted to call a value as a function, but that value is undefined, null, an object, or another non-function type. This often occurs when an import returns undefined or a method name is misspelled.',
    steps: ['Check whether the module or object exports the function you are calling.', 'Log the value right before the call to see what it actually is.', 'Ensure the library version you are using still exports this function (it may have been removed or renamed).'],
    confidence: 'High',
  },
  {
    test: /typeerror:.*cannot read propert(?:y|ies) (?:of |['"].*['"] of )(?:null|undefined)/i,
    title: () => 'Attempted to read a property of null or undefined',
    cause: 'A variable that was expected to hold an object is actually null or undefined. Accessing any property on it will throw this error.',
    steps: ['Add a null check or optional chaining (`?.`) before the property access.', 'Trace where the variable was assigned and find out why it did not receive the expected value.', 'If from a database or API call, check whether the query returned no results.'],
    confidence: 'High',
  },
  {
    test: /rangeerror:.*maximum call stack/i,
    title: () => 'Infinite recursion detected — maximum call stack exceeded',
    cause: 'A function is calling itself (or entering a mutual recursion loop) without a proper base case, exhausting the call stack.',
    steps: ['Find the recursive function in the stack trace and verify its termination condition.', 'Add logging at the top of the function to see what arguments cause the infinite loop.', 'Consider converting deep recursion to an iterative approach.'],
    confidence: 'High',
  },
  {
    test: /unhandledpromiserejection|unhandled promise rejection/i,
    title: () => 'A Promise rejection was not handled',
    cause: 'An async operation threw an error, but there was no `.catch()` or `try/catch` around the `await` to handle it. In newer Node.js versions this can crash the process.',
    steps: ['Add a `.catch()` handler to the promise, or wrap the `await` in a try/catch block.', 'Use `process.on("unhandledRejection", handler)` as a safety net for logging.', 'Check the underlying cause of the rejected promise in the error message.'],
    confidence: 'High',
  },
  {
    test: /eaddrinuse|address already in use/i,
    title: () => 'The port is already in use',
    cause: 'Another process is already listening on the same port, so the server cannot bind to it.',
    steps: ['Find the process using the port: `lsof -i :<port>` (macOS/Linux) or `netstat -ano | findstr :<port>` (Windows).', 'Kill the conflicting process or change your app to use a different port.', 'If this happens after a crash, the old process may still be running — restart your terminal or wait a moment.'],
    confidence: 'High',
  },
  {
    test: /enoent|no such file or directory/i,
    title: () => 'File or directory not found (ENOENT)',
    cause: 'The operating system could not find the file or directory at the specified path.',
    steps: ['Check that the file path is correct and the file exists at that location.', 'If inside a container, verify the file is copied or mounted correctly.', 'Use `path.resolve()` or `path.join()` to construct paths reliably across platforms.'],
    confidence: 'High',
  },
  {
    test: /eperm|eacces|permission denied/i,
    title: () => 'Permission denied when accessing a file or resource',
    cause: 'The process does not have the necessary file system permissions to read, write, or execute the target.',
    steps: ['Check the file permissions with `ls -la` and adjust with `chmod` if needed.', 'If running inside Docker, verify the user inside the container has the correct UID/GID.', 'Avoid running as root in production — use a dedicated service user instead.'],
    confidence: 'High',
  },
  {
    test: /emfile|too many open files/i,
    title: () => 'Too many open files (EMFILE)',
    cause: 'The process has exceeded the operating system limit on the number of open file descriptors.',
    steps: ['Increase the file descriptor limit with `ulimit -n` (Linux/macOS).', 'Check for file descriptor leaks — ensure streams and sockets are properly closed.', 'Use libraries like `graceful-fs` that queue file operations to avoid exhausting the limit.'],
    confidence: 'High',
  },
  {
    test: /heap out of memory|javascript heap|allocation failed/i,
    title: () => 'Node.js ran out of heap memory',
    cause: 'The V8 engine exceeded its memory limit. This can happen when processing very large datasets in memory, memory leaks, or unbounded caching.',
    steps: ['Increase the heap limit with `--max-old-space-size=4096` (in MB).', 'Profile memory usage with `--inspect` and Chrome DevTools to find leaks.', 'Stream large files instead of loading them entirely into memory.'],
    confidence: 'High',
  },
  {
    test: /err_require_esm|require\(\) of es module/i,
    title: () => 'Tried to require() an ES Module',
    cause: 'A CommonJS file used `require()` to load a package that only exports ES Modules. This is a common issue with newer versions of packages like `node-fetch`, `chalk`, etc.',
    steps: ['Switch to `import()` (dynamic import) instead of `require()`.', 'Or downgrade the package to the last version that supported CommonJS.', 'Convert your project to ES Modules by adding `"type": "module"` to package.json.'],
    confidence: 'High',
  },
  {
    test: /err_module_not_found|cannot find package/i,
    title: () => 'ES Module or package could not be resolved',
    cause: 'The import specifier could not be resolved to a file. This can happen with missing file extensions in ESM, incorrect package.json exports, or missing dependencies.',
    steps: ['Add the `.js` extension to relative imports when using ES modules.', 'Verify the package exists in node_modules with `npm ls <package>`.', 'Check the package.json "exports" field of the dependency for the correct import path.'],
    confidence: 'High',
  },

  // ═══════════════════════════ PYTHON ═══════════════════════════
  {
    test: /modulenotfounderror:.*no module named ['"]?([^'".\s]+)/i,
    title: m => `Python module "${m[1]}" is not installed`,
    cause: 'Python could not find the specified module. It is either not installed in the current environment or the virtual environment is not activated.',
    steps: ['Install the module: `pip install <module_name>`.', 'Verify you are using the correct Python environment or virtual env.', 'Check that the module name matches the PyPI package name (they can differ).'],
    confidence: 'High',
  },
  {
    test: /importerror:.*cannot import name ['"]?([^'"]+)/i,
    title: m => `Cannot import "${m[1]}" from the module`,
    cause: 'The specified name does not exist in the module. This can happen after an update changed the API, or due to circular imports.',
    steps: ['Check the module documentation for the correct import name.', 'Verify the installed version matches what your code expects.', 'Look for circular import issues if this is a local module.'],
    confidence: 'High',
  },
  {
    test: /indentationerror|tablerror/i,
    title: () => 'Python indentation error',
    cause: 'Python uses indentation to define code blocks. Mixing tabs and spaces, or inconsistent indentation levels, will cause this error.',
    steps: ['Configure your editor to use 4 spaces per indent and convert tabs to spaces.', 'Check the exact line mentioned in the traceback.', 'Run `python -tt script.py` to detect mixed tabs and spaces.'],
    confidence: 'High',
  },
  {
    test: /keyerror:\s*['"]?([^'"}\s]+)/i,
    title: m => `KeyError: "${m[1]}" — dictionary key not found`,
    cause: 'The code tried to access a dictionary key that does not exist. This happens when data has unexpected structure or a key was misspelled.',
    steps: ['Use `.get("key", default)` instead of `dict["key"]` for optional keys.', 'Print the dictionary keys before access to see what is actually available.', 'If the data comes from an API, check that the response format has not changed.'],
    confidence: 'High',
  },
  {
    test: /attributeerror:.*has no attribute ['"]?([^'"]+)/i,
    title: m => `AttributeError: object has no attribute "${m[1]}"`,
    cause: 'The code tried to access an attribute or method that does not exist on the object. The object may be a different type than expected.',
    steps: ['Check the type of the object with `type(obj)` or `print(dir(obj))`.', 'Verify you are calling the correct method name for the library version you are using.', 'Look for typos in the attribute name.'],
    confidence: 'High',
  },
  {
    test: /typeerror:.*takes \d+ positional arguments? but \d+ (?:was|were) given/i,
    title: () => 'Wrong number of arguments passed to a function',
    cause: 'A function was called with more or fewer arguments than its definition accepts.',
    steps: ['Check the function signature and count the parameters.', 'Remember that class methods have `self` as the first parameter.', 'If the function was recently updated, check if the signature changed.'],
    confidence: 'High',
  },
  {
    test: /valueerror:.*invalid literal for int\(\)/i,
    title: () => 'Cannot convert string to integer',
    cause: 'Python tried to convert a string to an integer, but the string does not represent a valid number (it may contain letters, spaces, or special characters).',
    steps: ['Validate or sanitize the input before converting.', 'Use a try/except block around the conversion.', 'Check if the input data has unexpected formatting (e.g., currency symbols, commas).'],
    confidence: 'High',
  },
  {
    test: /filenotfounderror|ioerror.*no such file/i,
    title: () => 'Python: file not found',
    cause: 'Python could not open a file at the specified path because it does not exist.',
    steps: ['Check the file path — use `os.path.exists()` before opening.', 'If the path is relative, verify the current working directory with `os.getcwd()`.', 'In containers or deployments, ensure the file is included in the build.'],
    confidence: 'High',
  },
  {
    test: /recursionerror:.*maximum recursion depth/i,
    title: () => 'Python maximum recursion depth exceeded',
    cause: 'A function is calling itself too many times without reaching a base case. Python limits recursion depth to prevent stack overflow.',
    steps: ['Check the recursive function for a proper base case.', 'Consider rewriting the recursion as an iterative loop.', 'If needed, increase the limit with `sys.setrecursionlimit()`, but fix the root cause first.'],
    confidence: 'High',
  },
  {
    test: /zerodivisionerror/i,
    title: () => 'Division by zero',
    cause: 'The code attempted to divide a number by zero.',
    steps: ['Add a check for zero before dividing.', 'Trace where the divisor comes from and why it is zero.', 'Consider using a default value when the divisor might be zero.'],
    confidence: 'High',
  },

  // ═══════════════════════════ JAVA / JVM ═══════════════════════════
  {
    test: /java\.lang\.NullPointerException/i,
    title: () => 'Java NullPointerException',
    cause: 'A method was called on a null reference, or a null value was used where an object was required.',
    steps: ['Check the stack trace for the exact line and variable that is null.', 'Add null checks or use `Optional<T>` to handle missing values safely.', 'If from a database query, verify the query returned results before accessing them.'],
    confidence: 'High',
  },
  {
    test: /java\.lang\.ClassNotFoundException|java\.lang\.NoClassDefFoundError/i,
    title: () => 'Java class not found on the classpath',
    cause: 'The JVM could not locate a required class. This usually means a dependency is missing from the classpath or an incompatible version was loaded.',
    steps: ['Check that the required JAR or dependency is included in your build (pom.xml, build.gradle).', 'Verify there are no version conflicts with `mvn dependency:tree` or `gradle dependencies`.', 'If using a fat JAR, ensure the class is packaged correctly.'],
    confidence: 'High',
  },
  {
    test: /java\.lang\.OutOfMemoryError/i,
    title: () => 'Java OutOfMemoryError — JVM heap exhausted',
    cause: 'The JVM ran out of heap memory. This can be caused by large data processing, memory leaks, or insufficient heap allocation.',
    steps: ['Increase heap size with `-Xmx` flag (e.g., `-Xmx2g`).', 'Use a heap profiler (VisualVM, YourKit, JFR) to find memory leaks.', 'Check for large collections, caches, or static references that are not released.'],
    confidence: 'High',
  },
  {
    test: /java\.lang\.StackOverflowError/i,
    title: () => 'Java StackOverflowError — infinite recursion',
    cause: 'A method is recursively calling itself without a proper base case, exhausting the thread stack.',
    steps: ['Find the recursive method in the stack trace and fix the base case.', 'Consider converting deep recursion to an iterative approach.', 'Increase stack size with `-Xss` if the recursion is intentional and very deep.'],
    confidence: 'High',
  },
  {
    test: /java\.lang\.ClassCastException/i,
    title: () => 'Java ClassCastException — invalid type cast',
    cause: 'An object was cast to a type that it does not actually belong to.',
    steps: ['Use `instanceof` to check the type before casting.', 'Review the stack trace to find which cast failed.', 'Prefer generics over raw types to catch these errors at compile time.'],
    confidence: 'High',
  },
  {
    test: /java\.lang\.NumberFormatException/i,
    title: () => 'Java NumberFormatException — invalid number string',
    cause: 'The code tried to parse a string into a number, but the string contains non-numeric characters.',
    steps: ['Validate the input string before parsing.', 'Use try/catch around `Integer.parseInt()` or `Double.parseDouble()`.', 'Check for leading/trailing whitespace with `.trim()`.'],
    confidence: 'High',
  },
  {
    test: /java\.lang\.IllegalArgumentException/i,
    title: () => 'Java IllegalArgumentException — bad method argument',
    cause: 'A method received an argument that it cannot accept (e.g., negative where positive is required, null where non-null is expected).',
    steps: ['Check the error message for details about which argument was invalid.', 'Validate inputs before passing them to the method.', 'Review the method documentation for parameter constraints.'],
    confidence: 'High',
  },
  {
    test: /java\.io\.FileNotFoundException/i,
    title: () => 'Java FileNotFoundException',
    cause: 'The application tried to open a file that does not exist at the specified path.',
    steps: ['Verify the file path is correct and the file exists.', 'Check file permissions — the JVM process may not have read access.', 'In containers, ensure the file is mounted or copied into the image.'],
    confidence: 'High',
  },
  {
    test: /java\.sql\.SQLException|jdbc/i,
    title: () => 'Java SQL / JDBC exception',
    cause: 'A database operation failed. This could be a connection failure, SQL syntax error, constraint violation, or timeout.',
    steps: ['Check the full exception message for the specific SQL error code.', 'Verify the database connection URL, credentials, and network connectivity.', 'If a constraint violation, check the data being inserted/updated.'],
    confidence: 'Medium',
  },
  {
    test: /spring.*bean.*creation|nosuchbeandefinitionexception|beancreationexception/i,
    title: () => 'Spring bean creation failure',
    cause: 'Spring could not create or inject a required bean. This is often caused by missing dependencies, circular references, or misconfigured component scanning.',
    steps: ['Check the full stack trace for the root cause (often at the bottom).', 'Verify all required beans are annotated correctly (@Component, @Service, @Bean, etc.).', 'Look for circular dependency warnings and break the cycle with @Lazy or setter injection.'],
    confidence: 'Medium',
  },

  // ═══════════════════════════ GO ═══════════════════════════
  {
    test: /panic:.*runtime error|goroutine.*\[running\]/i,
    title: () => 'Go runtime panic',
    cause: 'The Go runtime encountered an unrecoverable error such as a nil pointer dereference, index out of range, or explicit panic call.',
    steps: ['Check the goroutine stack trace to find the exact line and function.', 'Add nil checks before dereferencing pointers.', 'Use `recover()` in deferred functions to handle panics gracefully in production.'],
    confidence: 'High',
  },
  {
    test: /nil pointer dereference/i,
    title: () => 'Go nil pointer dereference',
    cause: 'A nil pointer was used where a valid pointer was expected. This is one of the most common Go panics.',
    steps: ['Check the stack trace for the exact variable that is nil.', 'Add explicit nil checks after error-prone operations (database queries, HTTP requests, type assertions).', 'Use the `errors` package and proper error handling to avoid nil returns.'],
    confidence: 'High',
  },
  {
    test: /fatal error:.*concurrent map/i,
    title: () => 'Go concurrent map access (fatal)',
    cause: 'Multiple goroutines accessed a map simultaneously without synchronization. Go maps are not safe for concurrent use.',
    steps: ['Use `sync.RWMutex` to protect map access.', 'Or switch to `sync.Map` for simple concurrent key-value access.', 'Run the program with `-race` flag during testing to detect data races early.'],
    confidence: 'High',
  },

  // ═══════════════════════════ RUBY / RAILS ═══════════════════════════
  {
    test: /loaderror:.*cannot load such file/i,
    title: () => 'Ruby LoadError — file or gem not found',
    cause: 'Ruby tried to load a file or gem that does not exist. This usually means a gem is not installed or the require path is wrong.',
    steps: ['Run `bundle install` to install missing gems.', 'Check the Gemfile for the gem and verify the name is correct.', 'If it is a local file, check the require path.'],
    confidence: 'High',
  },
  {
    test: /nomethoderror:.*undefined method/i,
    title: () => 'Ruby NoMethodError — undefined method',
    cause: 'A method was called on an object that does not support it. The object may be nil or a different type than expected.',
    steps: ['Check if the receiver is nil — use `.try()` or `&.` (safe navigation) to handle it.', 'Verify the method name exists on the object class.', 'Check for typos in the method name.'],
    confidence: 'High',
  },
  {
    test: /activerecord::recordnotfound/i,
    title: () => 'Rails ActiveRecord — record not found',
    cause: 'A database query using `.find()` or `.find_by!` did not match any records.',
    steps: ['Use `.find_by` (without bang) if the record might not exist, and handle the nil case.', 'Check if the ID or query parameters are correct.', 'Verify the database has been seeded or migrated correctly.'],
    confidence: 'High',
  },
  {
    test: /pendingmigrationerror|migrations are pending/i,
    title: () => 'Rails database migrations are pending',
    cause: 'There are database migrations that have not been run. The app cannot start until the schema is up to date.',
    steps: ['Run `rails db:migrate` to apply pending migrations.', 'In production, run migrations as part of your deployment process.', 'Check `rails db:migrate:status` to see which migrations are pending.'],
    confidence: 'High',
  },

  // ═══════════════════════════ PHP / LARAVEL ═══════════════════════════
  {
    test: /fatal error:.*class ['"]?([^'"]+)['"]? not found/i,
    title: m => `PHP class "${m[1]}" not found`,
    cause: 'PHP could not find the specified class. This can happen if autoloading is not configured, a namespace is wrong, or a dependency is missing.',
    steps: ['Run `composer dump-autoload` to regenerate the autoloader.', 'Check the namespace and use statements in your file.', 'Verify the dependency is installed with `composer install`.'],
    confidence: 'High',
  },
  {
    test: /allowed memory size of \d+ bytes exhausted/i,
    title: () => 'PHP memory limit exhausted',
    cause: 'The PHP script used more memory than the configured limit (memory_limit in php.ini).',
    steps: ['Increase `memory_limit` in php.ini or `.htaccess`.', 'Optimize the code to use less memory (stream large files, paginate queries).', 'Profile memory usage to find the allocation hotspot.'],
    confidence: 'High',
  },

  // ═══════════════════════════ RUST ═══════════════════════════
  {
    test: /thread '.*' panicked at/i,
    title: () => 'Rust thread panicked',
    cause: 'A Rust thread encountered an unrecoverable error and panicked. This can be caused by `unwrap()` on a None/Err, array index out of bounds, or explicit `panic!()` calls.',
    steps: ['Check the panic message and backtrace for the exact location.', 'Replace `.unwrap()` calls with proper error handling using `match`, `if let`, or `?`.', 'Set `RUST_BACKTRACE=1` environment variable for full backtraces.'],
    confidence: 'High',
  },

  // ═══════════════════════════ DATABASE ═══════════════════════════
  {
    test: /connection refused.*(?:5432|3306|27017|6379)|econnrefused.*(?:5432|3306|27017|6379)/i,
    title: () => 'Database connection refused',
    cause: 'The application could not connect to the database server. The database may be stopped, the host/port may be wrong, or a firewall is blocking the connection.',
    steps: ['Check that the database server is running and listening on the expected port.', 'Verify the host, port, username, and password in your connection string.', 'If using Docker, ensure the database container is on the same network and use the service name instead of localhost.'],
    confidence: 'High',
  },
  {
    test: /connection\s+pool\s+(?:usage|utili[sz]ation)\s*(?:is\s+|at\s+|[:=]\s*)?(\d{1,3}(?:\.\d+)?)\s*%/i,
    title: m => `Database connection pool is heavily used (${m[1]}%)`,
    cause: m => `The log reports that ${m[1]}% of the database connection pool is in use. The pool is not necessarily exhausted yet, but if this level persists or rises, requests may wait for a connection and eventually time out. This line alone does not show whether users are already affected.`,
    steps: [
      'Check whether utilization stays high or was only a brief spike; compare it with your normal traffic and alert threshold.',
      'Inspect the pool maximum, active and idle connection counts, wait queue, and connection-acquire timeout around this timestamp.',
      'Look for slow queries or long transactions holding connections; check that every acquired connection is released on success and error paths.',
      'Before increasing the pool, calculate the total possible connections across all app instances and compare it with the database limit and other clients.',
    ],
    confidence: 'Medium',
  },
  {
    test: /too many connections|max_connections|connection pool exhausted|cannot acquire connection/i,
    title: () => 'Database connection pool exhausted',
    cause: 'All available database connections are in use. New requests cannot acquire a connection and time out.',
    steps: ['Increase the connection pool size or the database max_connections setting.', 'Check for connection leaks — ensure connections are properly released after use.', 'Add connection timeouts and use bounded connection pools.'],
    confidence: 'High',
  },
  {
    test: /deadlock detected|deadlock found/i,
    title: () => 'Database deadlock detected',
    cause: 'Two or more transactions are waiting for each other to release locks, creating a circular dependency.',
    steps: ['Retry the transaction — the database typically rolls back one of the deadlocked transactions.', 'Ensure transactions acquire locks in a consistent order.', 'Reduce transaction scope and duration to minimize lock contention.'],
    confidence: 'High',
  },
  {
    test: /duplicate key.*violates unique constraint|unique constraint.*violated|duplicate entry/i,
    title: () => 'Duplicate key — unique constraint violation',
    cause: 'An INSERT or UPDATE tried to create a duplicate value in a column that has a unique constraint.',
    steps: ['Use INSERT ... ON CONFLICT (Postgres) or INSERT IGNORE / ON DUPLICATE KEY UPDATE (MySQL).', 'Check if a race condition is causing concurrent inserts with the same key.', 'Validate uniqueness in the application layer before inserting.'],
    confidence: 'High',
  },
  {
    test: /foreign key constraint.*violat|violates foreign key/i,
    title: () => 'Foreign key constraint violation',
    cause: 'An INSERT, UPDATE, or DELETE violated a foreign key relationship — the referenced row does not exist or cannot be deleted because other rows depend on it.',
    steps: ['Ensure the referenced record exists before inserting the referencing row.', 'Use CASCADE or SET NULL on DELETE if automatic cleanup is desired.', 'Check the order of operations in your data pipeline.'],
    confidence: 'High',
  },
  {
    test: /relation "([^"]+)" does not exist|table.*doesn.t exist|unknown table/i,
    title: m => `Database table "${m[1] || 'unknown'}" does not exist`,
    cause: 'The query references a table that has not been created. This is usually a missing migration or wrong database.',
    steps: ['Run database migrations to create the missing table.', 'Verify you are connected to the correct database (check DATABASE_URL).', 'Check for typos in the table name.'],
    confidence: 'High',
  },
  {
    test: /column "([^"]+)" (?:does not exist|of relation)|unknown column/i,
    title: m => `Database column "${m[1] || 'unknown'}" does not exist`,
    cause: 'The query references a column that does not exist in the table. This often happens after a schema change or migration was not applied.',
    steps: ['Run pending database migrations.', 'Check the table schema to see which columns exist.', 'Verify column names in your query match the database schema.'],
    confidence: 'High',
  },
  {
    test: /syntax error at or near|you have an error in your sql syntax/i,
    title: () => 'SQL syntax error',
    cause: 'The SQL query has a syntax error — a missing keyword, misplaced comma, unmatched quotes, or invalid clause.',
    steps: ['Check the SQL query at the position mentioned in the error message.', 'Test the query directly in a SQL client to isolate the issue.', 'If using an ORM, check the generated SQL for correctness.'],
    confidence: 'High',
  },
  {
    test: /authentication failed.*(?:postgres|mysql|mongo)|password authentication failed/i,
    title: () => 'Database authentication failed',
    cause: 'The database rejected the connection because the username or password is incorrect.',
    steps: ['Verify the database credentials in your environment variables or config file.', 'Check that the database user exists and has the correct password.', 'If using a managed database, regenerate credentials in the provider dashboard.'],
    confidence: 'High',
  },
  {
    test: /redis.*connection|erednodeiderr|redis.*ECONNREFUSED/i,
    title: () => 'Redis connection failure',
    cause: 'The application could not connect to the Redis server. Redis may be stopped, unreachable, or the connection parameters are wrong.',
    steps: ['Check that Redis is running: `redis-cli ping` should return PONG.', 'Verify the Redis host, port, and password in your configuration.', 'If using Docker, ensure Redis is on the same network as your application.'],
    confidence: 'High',
  },

  // ═══════════════════════════ DOCKER / KUBERNETES ═══════════════════════════
  {
    test: /oomkilled|out of memory.*killed|memory limit|cgroup.*oom/i,
    title: () => 'Container killed by OOM (Out of Memory)',
    cause: 'The container exceeded its memory limit and was killed by the OOM killer. This can happen with memory leaks, large payloads, or insufficient memory allocation.',
    steps: ['Increase the container memory limit in your Dockerfile, docker-compose.yml, or Kubernetes resource spec.', 'Profile the application memory usage to find the leak or hotspot.', 'Use memory-efficient data structures and streaming for large payloads.'],
    confidence: 'High',
  },
  {
    test: /crashloopbackoff|crash loop|restarting.*container/i,
    title: () => 'Kubernetes CrashLoopBackOff — container keeps crashing',
    cause: 'The container starts, crashes immediately, and Kubernetes keeps restarting it. This creates a back-off loop with increasing delays.',
    steps: ['Check container logs: `kubectl logs <pod> --previous` to see the crash reason.', 'Verify the container command and entrypoint are correct.', 'Check for missing environment variables, config files, or failed health checks.'],
    confidence: 'High',
  },
  {
    test: /imagepullbackoff|errimagepull|image.*not found|manifest unknown/i,
    title: () => 'Kubernetes cannot pull container image',
    cause: 'The container image could not be downloaded. The image name may be wrong, the registry requires authentication, or the tag does not exist.',
    steps: ['Verify the image name and tag exist in the container registry.', 'Check that the Kubernetes cluster has pull credentials configured (imagePullSecrets).', 'Test pulling the image manually: `docker pull <image:tag>`.'],
    confidence: 'High',
  },
  {
    test: /readiness probe failed|liveness probe failed|health check failed/i,
    title: () => 'Container health check / probe failed',
    cause: 'The application did not respond to a health check within the configured timeout. Kubernetes may restart the container as a result.',
    steps: ['Check the application logs around the time of the probe failure.', 'Increase the probe timeout or initialDelaySeconds if the app takes long to start.', 'Verify the health check endpoint path and port are correct.'],
    confidence: 'High',
  },
  {
    test: /0\/\d+ nodes are available|insufficient cpu|insufficient memory|unschedulable/i,
    title: () => 'Kubernetes cannot schedule pod — insufficient resources',
    cause: 'No node in the cluster has enough CPU, memory, or available capacity to run the pod.',
    steps: ['Check node resource usage with `kubectl top nodes`.', 'Reduce the pod resource requests or add more nodes to the cluster.', 'Check for pod affinity, taints, or node selectors that might restrict scheduling.'],
    confidence: 'High',
  },

  // ═══════════════════════════ NETWORKING / TLS / DNS ═══════════════════════════
  {
    test: /econnrefused|connection refused/i,
    title: () => 'Connection refused (ECONNREFUSED)',
    cause: 'A TCP connection was actively refused by the target host. Nothing is listening on that port, or a firewall is blocking it.',
    steps: ['Verify the target service is running and listening on the expected port.', 'Check for firewall rules or security groups blocking the connection.', 'If inside a container, use the service name instead of localhost/127.0.0.1.'],
    confidence: 'High',
  },
  {
    test: /econnreset|connection reset/i,
    title: () => 'Connection reset by peer (ECONNRESET)',
    cause: 'The remote server unexpectedly closed the connection. This can happen due to server crashes, timeouts, or load balancer issues.',
    steps: ['Check if the remote server is healthy and not restarting.', 'Look for request size limits or timeout settings on load balancers/proxies.', 'Implement retry logic with exponential backoff for transient failures.'],
    confidence: 'Medium',
  },
  {
    test: /etimedout|econnaborted|socket hang up|request timeout/i,
    title: () => 'Connection timed out',
    cause: 'The connection to the remote server timed out. The server may be slow, overloaded, or unreachable.',
    steps: ['Check the network connectivity between your service and the target.', 'Increase the timeout value if the operation legitimately takes longer.', 'Check the target service for high latency or resource constraints.'],
    confidence: 'Medium',
  },
  {
    test: /enotfound|dns.*resolution|getaddrinfo.*enotfound/i,
    title: () => 'DNS resolution failed (ENOTFOUND)',
    cause: 'The hostname could not be resolved to an IP address. The DNS name may be wrong, DNS servers may be unavailable, or the network is misconfigured.',
    steps: ['Verify the hostname is spelled correctly.', 'Check DNS resolution: `nslookup <hostname>` or `dig <hostname>`.', 'If in a container, ensure DNS is configured correctly (check /etc/resolv.conf).'],
    confidence: 'High',
  },
  {
    test: /certificate.*(?:expired|invalid|self.signed|not yet valid)|ssl.*error|tls.*handshake|cert_has_expired|unable_to_verify_leaf_signature/i,
    title: () => 'TLS/SSL certificate error',
    cause: 'The TLS handshake failed because the server certificate is expired, self-signed, or issued by an untrusted authority.',
    steps: ['Check the certificate expiration date and renew it if expired.', 'If self-signed, add the CA certificate to your trust store, or use `NODE_TLS_REJECT_UNAUTHORIZED=0` for development only.', 'Verify the certificate chain is complete — intermediate certificates must be included.'],
    confidence: 'High',
  },
  {
    test: /cors.*blocked|access-control-allow-origin|cross-origin/i,
    title: () => 'CORS error — cross-origin request blocked',
    cause: 'The browser blocked a cross-origin request because the server did not include the correct CORS headers.',
    steps: ['Add `Access-Control-Allow-Origin` header to the server response for the requesting origin.', 'Handle OPTIONS preflight requests properly.', 'If using a framework, configure its CORS middleware with the allowed origins.'],
    confidence: 'High',
  },

  // ═══════════════════════════ AUTH / SECURITY ═══════════════════════════
  {
    test: /401|unauthorized|invalid.*token|token.*expired|jwt.*expired/i,
    title: () => 'Authentication failed — 401 Unauthorized',
    cause: 'The request was rejected because the authentication token is missing, invalid, or expired.',
    steps: ['Check that the Authorization header is included and correctly formatted.', 'Verify the token has not expired — inspect it at jwt.io (for JWTs).', 'Refresh the access token if using OAuth / refresh token flow.'],
    confidence: 'Medium',
  },
  {
    test: /403|forbidden|access denied|not permitted|insufficient.*(permission|privilege|scope)/i,
    title: () => 'Authorization failed — 403 Forbidden',
    cause: 'The authenticated user does not have permission to access this resource or perform this action.',
    steps: ['Check the user role and permissions for this resource.', 'Verify the API key or token has the required scopes.', 'If using RBAC, check the role bindings and policies.'],
    confidence: 'Medium',
  },

  // ═══════════════════════════ HTTP STATUS CODES ═══════════════════════════
  {
    test: /http[s]?\s*(?:error\s*)?(?:status\s*)?(?:code\s*)?404|not found.*(?:route|endpoint|page|resource)/i,
    title: () => 'HTTP 404 — resource not found',
    cause: 'The requested URL or endpoint does not exist on the server.',
    steps: ['Check the URL path for typos.', 'Verify the route is defined in your router/controller.', 'If a recently added endpoint, ensure the server was restarted after the change.'],
    confidence: 'Medium',
  },
  {
    test: /http[s]?\s*(?:error\s*)?(?:status\s*)?(?:code\s*)?429|too many requests|rate.?limit/i,
    title: () => 'HTTP 429 — rate limited',
    cause: 'The client is sending requests too fast and has been rate limited by the server or API.',
    steps: ['Add a delay between requests — implement exponential backoff.', 'Check the `Retry-After` header for the recommended wait time.', 'If calling an external API, check their rate limit documentation and adjust your code accordingly.'],
    confidence: 'High',
  },
  {
    test: /http[s]?\s*(?:error\s*)?(?:status\s*)?(?:code\s*)?500|internal server error/i,
    title: () => 'HTTP 500 — internal server error',
    cause: 'The server encountered an unexpected condition that prevented it from fulfilling the request.',
    steps: ['Check the server-side logs for the full error stack trace.', 'This is a server-side issue — look at recent code changes or deployments.', 'If calling a third-party API, check their status page.'],
    confidence: 'Low',
  },
  {
    test: /http[s]?\s*(?:error\s*)?(?:status\s*)?(?:code\s*)?502|bad gateway/i,
    title: () => 'HTTP 502 — bad gateway',
    cause: 'A reverse proxy or load balancer received an invalid response from the upstream server.',
    steps: ['Check that the upstream server is running and responding correctly.', 'Look for timeouts or crashes in the upstream application logs.', 'Check the proxy configuration (nginx, ALB, etc.) for correct upstream settings.'],
    confidence: 'Medium',
  },
  {
    test: /http[s]?\s*(?:error\s*)?(?:status\s*)?(?:code\s*)?503|service unavailable/i,
    title: () => 'HTTP 503 — service unavailable',
    cause: 'The server is temporarily unable to handle the request, usually due to overload or maintenance.',
    steps: ['Check the server health and resource usage (CPU, memory, connections).', 'If behind a load balancer, check if healthy backends are available.', 'Wait and retry — this is usually temporary.'],
    confidence: 'Medium',
  },

  // ═══════════════════════════ TIMEOUT / PERFORMANCE ═══════════════════════════
  {
    test: /timeout|timed out|latency|slow query|query.*exceeded/i,
    title: () => 'Request or query timeout',
    cause: 'An operation took longer than the configured timeout. A downstream service or database may be slow or under pressure.',
    steps: ['Check database and dependency latency around this time.', 'Look for missing indexes on frequently queried columns.', 'Set appropriate timeouts and retry limits to protect your service.'],
    confidence: 'Medium',
  },
  {
    test: /out of memory|heap|memory|garbage collection|\bgc pause\b/i,
    title: () => 'Memory pressure detected',
    cause: 'The process may be retaining data faster than it can release it, leading to memory pressure or an eventual crash.',
    steps: ['Compare current memory usage with normal traffic levels.', 'Inspect caches, large payload handling, and data structures for leaks.', 'Capture a heap profile if the issue repeats.'],
    confidence: 'Medium',
  },

  // ═══════════════════════════ GENERIC FALLBACKS ═══════════════════════════
  {
    test: /segmentation fault|sigsegv|sigabrt/i,
    title: () => 'Segmentation fault (SIGSEGV) or abort signal',
    cause: 'The process attempted to access invalid memory. This is usually a bug in native code, a C extension, or a corrupt binary.',
    steps: ['Check for recent updates to native dependencies or C extensions.', 'Run the program with a debugger (gdb, lldb) to find the crash location.', 'If using a pre-built binary, try reinstalling it.'],
    confidence: 'Medium',
  },
  {
    test: /disk.*full|no space left|enospc/i,
    title: () => 'Disk space exhausted (ENOSPC)',
    cause: 'The file system has no free space. Writes, logs, and temporary files will fail until space is freed.',
    steps: ['Check disk usage with `df -h` and find large files with `du -sh *`.', 'Clean up old logs, temp files, and unused Docker images.', 'Consider increasing the disk size or adding log rotation.'],
    confidence: 'High',
  },
  {
    test: /killed.*signal|signal.*(?:sigterm|sigkill)|process.*killed/i,
    title: () => 'Process was killed by a signal (SIGTERM/SIGKILL)',
    cause: 'The operating system or a process manager sent a kill signal. This can be from an OOM killer, a deployment, or a manual stop.',
    steps: ['Check system logs (`dmesg`, journalctl) for OOM killer activity.', 'If during deployment, ensure graceful shutdown is handled.', 'If manual, verify who or what initiated the kill.'],
    confidence: 'Medium',
  },

  // ═══════════════════════════ EXPRESS / NODE FRAMEWORK ═══════════════════════════
  {
    test: /cannot (get|post|put|patch|delete) \/([^\s]*)/i,
    title: m => `Express route not found — ${m[1].toUpperCase()} /${m[2]}`,
    cause: 'No route handler is registered for this HTTP method and path. The endpoint may not be defined, the router may not be mounted at the right base path, or there is a typo in the path.',
    steps: [
      'Verify the route is defined in your router/controller with the correct HTTP method and exact path.',
      'Check that the router is mounted at the correct base path (e.g., app.use(\'/api\', router)).',
      'Ensure the server was restarted after adding the route.',
      'Log `app._router.stack` or use a route-listing package to inspect all registered routes.',
    ],
    confidence: 'High',
  },
  {
    test: /process\.env\.[A-Z_]+.*(?:undefined|is not defined)|(?:missing|undefined).*env(?:ironment)?[\s_-]?var|env.*(?:not set|not configured|required)/i,
    title: () => 'Required environment variable is missing or undefined',
    cause: 'The application tried to read an environment variable that has not been set. This is common when deploying without a complete .env file or forgetting to add the variable to the hosting platform config.',
    steps: [
      'Check your .env (or .env.local) file and add the missing variable.',
      'If deploying to a hosting platform (Render, Railway, Heroku, Vercel), add the variable in their environment/config settings.',
      'Variable names are case-sensitive — ensure the name matches exactly between code and config.',
      'Never commit secrets to source control; use a secrets manager or vault for production.',
    ],
    confidence: 'High',
  },
  {
    test: /axios.*(?:network error|econnrefused|etimedout|enotfound)|network error.*axios/i,
    title: () => 'Axios network request failed',
    cause: 'Axios could not reach the target server. The host may be down, unreachable, or the request timed out.',
    steps: [
      'Verify the target URL is correct and the server is running.',
      'If connecting to a local service, ensure it is started and listening on the expected port.',
      'Add a timeout to your Axios config (e.g., `axios.create({ timeout: 5000 })`) and handle errors gracefully.',
      'Check for proxy or firewall rules blocking the outbound request.',
    ],
    confidence: 'Medium',
  },

  // ═══════════════════════════ PRISMA ORM ═══════════════════════════
  {
    test: /PrismaClientKnownRequestError|prisma.*\bP(2002|2003|2011|2025)\b/i,
    title: m => {
      const code = (m.input || '').match(/\bP(\d{4})\b/)?.[0];
      const labels = { P2002: 'unique constraint violation', P2025: 'record not found', P2003: 'foreign key constraint failed', P2011: 'null constraint violation' };
      return code ? `Prisma ${code} — ${labels[code] || 'request error'}` : 'Prisma client request error';
    },
    cause: m => {
      const code = (m.input || '').match(/\bP(\d{4})\b/)?.[0];
      if (code === 'P2002') return 'A unique constraint was violated — a record with that value already exists in the database.';
      if (code === 'P2025') return 'Prisma could not find the record matching the given filter or ID.';
      if (code === 'P2003') return 'A foreign key constraint failed — the referenced record does not exist.';
      if (code === 'P2011') return 'A required (non-nullable) field received a null value.';
      return 'Prisma encountered a known request error. Check the error code in the message for details.';
    },
    steps: [
      'For P2002 (unique constraint): use upsert, or check for an existing record before inserting.',
      'For P2025 (not found): verify the ID or filter values actually exist in the database.',
      'For P2003 (foreign key): ensure the related record exists before creating the referencing one.',
      'Run `npx prisma studio` to inspect the database state visually.',
    ],
    confidence: 'High',
  },
  {
    test: /PrismaClientInitializationError|prisma.*can.t reach database server/i,
    title: () => 'Prisma cannot connect to the database',
    cause: 'The Prisma client failed to establish a database connection. The DATABASE_URL may be wrong, the database may be unreachable, or Prisma migrations have not been run.',
    steps: [
      'Verify the DATABASE_URL environment variable is correctly set (host, port, credentials, database name).',
      'Check that the database server is running and accepting connections.',
      'Run `npx prisma generate` after changing your schema.',
      'Run `npx prisma migrate deploy` to apply pending migrations.',
    ],
    confidence: 'High',
  },
  {
    test: /PrismaClientValidationError/i,
    title: () => 'Prisma validation error — invalid query arguments',
    cause: 'The Prisma query was called with arguments of the wrong type or shape. A required field may be missing or a value may not match the schema type.',
    steps: [
      'Check the field types in your Prisma schema against the data you are passing to the query.',
      'Ensure required fields are not omitted in create() or update() operations.',
      'Re-run `npx prisma generate` if you recently changed the schema.',
    ],
    confidence: 'High',
  },

  // ═══════════════════════════ MONGOOSE / MONGODB ═══════════════════════════
  {
    test: /MongooseError|mongoose.*validation failed|ValidationError:.*path ['"]?\w/i,
    title: () => 'Mongoose schema validation error',
    cause: 'A Mongoose document failed schema validation before being saved. A required field may be missing, a value may be the wrong type, or a custom validator returned false.',
    steps: [
      'Check the error.errors object for the specific field(s) that failed validation.',
      'Ensure all required fields are populated before calling save() or create().',
      'Verify that the data types match your Mongoose schema (e.g., String vs Number vs ObjectId).',
      'Check any custom validators defined in the schema for the failing field.',
    ],
    confidence: 'High',
  },
  {
    test: /MongoNetworkError|MongoServerSelectionError/i,
    title: () => 'MongoDB cannot connect — server selection or network error',
    cause: 'Mongoose/MongoDB could not reach the database server. The MONGODB_URI may be wrong, the server may be down, or a firewall is blocking the connection.',
    steps: [
      'Verify MONGODB_URI is correctly set, including username, password, host, and database name.',
      'Check that MongoDB is running: `mongosh --eval \'db.runCommand({ connectionStatus: 1 })\'` should succeed.',
      'If using MongoDB Atlas, verify your server IP is in the Network Access allowlist.',
      'Check for a trailing slash or missing database name at the end of the connection string.',
    ],
    confidence: 'High',
  },
  {
    test: /E11000 duplicate key error.*index/i,
    title: () => 'MongoDB E11000 duplicate key error',
    cause: 'An insert or update tried to create a duplicate value for a field covered by a unique index.',
    steps: [
      'Check which index is mentioned in the error message to identify the conflicting field.',
      'Use findOneAndUpdate with upsert:true, or check for an existing document before inserting.',
      'If caused by a race condition, add a short delay and retry with exponential backoff.',
    ],
    confidence: 'High',
  },

  // ═══════════════════════════ SEQUELIZE / TYPEORM ═══════════════════════════
  {
    test: /SequelizeUniqueConstraintError/i,
    title: () => 'Sequelize unique constraint violation',
    cause: 'Sequelize tried to insert or update a record that would create a duplicate value in a unique field.',
    steps: [
      'Check the error.fields object to identify which field(s) triggered the constraint.',
      'Use findOrCreate() or upsert() instead of create() when a duplicate may already exist.',
      'Add a uniqueness check in your service/controller before calling create().',
    ],
    confidence: 'High',
  },
  {
    test: /SequelizeValidationError/i,
    title: () => 'Sequelize model validation error',
    cause: 'One or more model validations failed before the database was reached. A field may be missing, out of range, or the wrong type.',
    steps: [
      'Check error.errors array for the specific field(s) and validation rule(s) that failed.',
      'Verify the data being passed to create() or build() matches the model validations.',
      'Check for required fields (allowNull: false) that may be missing from the input.',
    ],
    confidence: 'High',
  },
  {
    test: /SequelizeConnectionError|SequelizeConnectionRefusedError/i,
    title: () => 'Sequelize cannot connect to the database',
    cause: 'Sequelize could not establish a connection. The host, port, credentials, or database name may be wrong.',
    steps: [
      'Check DB_HOST, DB_PORT, DB_USER, DB_PASS, and DB_NAME environment variables.',
      'Ensure the database server is running and reachable from this host.',
      'Verify the database user has the necessary connection privileges.',
    ],
    confidence: 'High',
  },
  {
    test: /QueryFailedError|TypeORMError/i,
    title: () => 'TypeORM query failed',
    cause: 'A TypeORM database query failed. This can be due to a constraint violation, a missing table, or a syntax error in a raw query.',
    steps: [
      'Check the full error message for the underlying SQL error code and context.',
      'Run pending migrations: `npm run migration:run` or `typeorm migration:run`.',
      'If using raw queries, validate the SQL syntax directly against the database.',
    ],
    confidence: 'Medium',
  },

  // ═══════════════════════════ JWT — PRECISE ═══════════════════════════
  {
    test: /JsonWebTokenError: invalid signature/i,
    title: () => 'JWT invalid signature — token tampered or wrong secret used',
    cause: 'The JWT signature does not match. The token was signed with a different secret than the one being used for verification, or the token payload was modified after signing.',
    steps: [
      'Ensure the JWT_SECRET (or equivalent) is identical on the signing and verifying side.',
      'Check that the token has not been truncated or corrupted in transit (e.g., stripped by a proxy).',
      'If you recently rotated the JWT secret, tokens signed with the old secret will fail verification.',
      'Inspect the token at jwt.io to confirm its header and payload are structurally intact.',
    ],
    confidence: 'High',
  },
  {
    test: /TokenExpiredError: jwt expired/i,
    title: () => 'JWT expired — token past its expiry time',
    cause: 'The JSON Web Token has passed its exp (expiry) claim. The client must obtain a new token.',
    steps: [
      'Implement a token refresh flow: exchange a valid refresh token for a new access token before expiry.',
      'On the client, check the token expiry proactively (decode and compare exp with Date.now()) before API calls.',
      'If no refresh flow exists, redirect the user to log in again.',
      'Consider increasing the token TTL if the current lifetime is too short for your use case.',
    ],
    confidence: 'High',
  },
  {
    test: /NotBeforeError: jwt not active/i,
    title: () => 'JWT not yet active — nbf (not-before) claim is in the future',
    cause: 'The token\'s nbf (not-before) claim is set to a time that has not yet been reached. This usually indicates clock skew between the token-issuing and token-verifying servers.',
    steps: [
      'Sync system clocks on both servers using NTP (`timedatectl status` on Linux).',
      'Add a clock skew tolerance when verifying tokens (most JWT libraries support a `clockTolerance` option).',
    ],
    confidence: 'High',
  },

  // ═══════════════════════════ AWS / CLOUD ═══════════════════════════
  {
    test: /NoCredentialsError|Unable to locate credentials|InvalidClientTokenId/i,
    title: () => 'AWS credentials missing or invalid',
    cause: 'The AWS SDK could not find valid credentials. They may not be configured, may have expired, or an IAM role is not attached to the compute resource.',
    steps: [
      'Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables, or configure ~/.aws/credentials.',
      'If running on EC2/ECS/Lambda, ensure an IAM role with the required permissions is attached to the instance/task.',
      'Run `aws sts get-caller-identity` to verify the active credentials are valid.',
      'Temporary credentials from STS/AssumeRole have a TTL — check if they have expired.',
    ],
    confidence: 'High',
  },
  {
    test: /AccessDenied.*Amazon|aws.*access denied|s3.*AccessDenied/i,
    title: () => 'AWS access denied — insufficient IAM permissions',
    cause: 'The AWS principal (user or role) does not have the required permission to perform this action on this resource.',
    steps: [
      'Check the IAM policy attached to the user or role for the required action and resource ARN.',
      'Use the IAM Policy Simulator in the AWS console to test permissions without making real calls.',
      'Check resource-based policies (S3 bucket policy, KMS key policy, SQS queue policy) — they can also deny access.',
      'Look for explicit Deny statements in any SCP or permission boundary that may override Allow rules.',
    ],
    confidence: 'High',
  },
  {
    test: /ThrottlingException|RequestLimitExceeded|TooManyRequestsException.*aws/i,
    title: () => 'AWS API throttled — request rate exceeded',
    cause: 'Your application is calling the AWS API faster than the per-account or per-region rate limit for this service.',
    steps: [
      'Implement exponential backoff with jitter on AWS API calls.',
      'Configure the AWS SDK retry mode to \'adaptive\' and set an appropriate maxAttempts.',
      'Check AWS Service Quotas and request a limit increase if you legitimately need higher throughput.',
      'Batch operations where available (e.g., SQS batch send, DynamoDB batch write).',
    ],
    confidence: 'High',
  },

  // ═══════════════════════════ STRIPE / PAYMENTS ═══════════════════════════
  {
    test: /StripeInvalidRequestError|stripe.*no such (customer|payment|subscription|price|invoice)/i,
    title: () => 'Stripe resource not found — invalid request',
    cause: 'Stripe could not find the specified resource. The ID may be from the wrong environment (test vs live), or the resource may have been deleted.',
    steps: [
      'Confirm you are using the correct Stripe API key for the environment (test vs live).',
      'Verify the resource ID exists in the Stripe Dashboard under the correct account and mode.',
      'Test-mode resource IDs (e.g., cus_test_...) cannot be used with a live-mode API key.',
    ],
    confidence: 'High',
  },
  {
    test: /StripeCardError|card.*was declined|card_declined|insufficient_funds/i,
    title: () => 'Stripe card declined',
    cause: 'The payment card was declined by the card network or issuing bank. This is a normal business outcome that must be handled gracefully.',
    steps: [
      'Read the decline_code from the StripeCardError object and show the user a specific, friendly message.',
      'For test mode, use Stripe test cards (e.g., 4000000000000002 for a generic decline).',
      'Do not auto-retry a declined charge — collect a new payment method from the user instead.',
    ],
    confidence: 'High',
  },
  {
    test: /StripeAuthenticationError|No API key provided|stripe.*invalid api key/i,
    title: () => 'Stripe authentication error — invalid or missing API key',
    cause: 'The Stripe secret key is missing, incorrect, or has been revoked.',
    steps: [
      'Check that STRIPE_SECRET_KEY is set correctly in your environment variables.',
      'Verify the key in the Stripe Dashboard under Developers → API keys.',
      'Never expose the secret key in client-side code — only use it server-side.',
    ],
    confidence: 'High',
  },

  // ═══════════════════════════ NEXT.JS / REACT ═══════════════════════════
  {
    test: /hydration.*mismatch|did not match.*server|text content does not match server/i,
    title: () => 'React/Next.js hydration mismatch — server and client HTML differ',
    cause: 'The HTML rendered on the server does not match what React renders on the client. Common causes: browser-only APIs (window, localStorage) used during SSR, non-deterministic content (Math.random, Date.now), or conditional rendering based on session/cookies.',
    steps: [
      'Guard browser-only code with `if (typeof window !== \'undefined\')` or move it into `useEffect`.',
      'Use Next.js `dynamic()` import with `{ ssr: false }` for components that rely on browser APIs.',
      'Ensure timestamps and random values are pre-computed and passed consistently to both server and client.',
      'Use `suppressHydrationWarning` only as a last resort on elements where differences are expected and harmless.',
    ],
    confidence: 'High',
  },
  {
    test: /Module not found.*Can.t resolve ['"]/i,
    title: m => {
      const mod = (m.input || '').match(/Can.t resolve ['"](.*?)['"]/);
      return mod ? `Build error — cannot resolve "${mod[1]}"` : 'Build error — module could not be resolved';
    },
    cause: 'The bundler (webpack/Vite) could not find the imported module. The import path may be wrong, the package may not be installed, or a path alias is not configured.',
    steps: [
      'Run `npm install` to ensure all dependencies are installed.',
      'Check the import path for typos — paths are case-sensitive on Linux/macOS.',
      'If using a path alias (e.g., @/components), verify it is defined in tsconfig.json/jsconfig.json and in your bundler config.',
      'Ensure the file has the correct extension and that the extension is in your resolve.extensions config.',
    ],
    confidence: 'High',
  },

  // ═══════════════════════════ PYTHON — DJANGO / FLASK / SQLALCHEMY ═══════════════════════════
  {
    test: /ImproperlyConfigured|DJANGO_SETTINGS_MODULE|settings.*not configured/i,
    title: () => 'Django settings not configured (ImproperlyConfigured)',
    cause: 'Django could not find its settings module. DJANGO_SETTINGS_MODULE environment variable may not be set or points to an incorrect module path.',
    steps: [
      'Set DJANGO_SETTINGS_MODULE to your settings module path (e.g., export DJANGO_SETTINGS_MODULE=myproject.settings).',
      'Ensure `os.environ.setdefault(\'DJANGO_SETTINGS_MODULE\', ...)` is called in manage.py and wsgi.py.',
      'If using multiple settings files, confirm the correct file is being referenced.',
    ],
    confidence: 'High',
  },
  {
    test: /django\.db\.utils\.OperationalError.*no such table|django.*relation.*does not exist/i,
    title: () => 'Django database error — table missing, migration not applied',
    cause: 'Django tried to query a table that does not exist. Migrations have likely not been applied to this database.',
    steps: [
      'Run `python manage.py migrate` to apply all pending migrations.',
      'Run `python manage.py showmigrations` to see which migrations are unapplied.',
      'Verify you are connected to the correct database (check DATABASES in settings.py).',
    ],
    confidence: 'High',
  },
  {
    test: /IntegrityError.*UNIQUE constraint.*failed|django.*IntegrityError/i,
    title: () => 'Django/SQLite unique constraint violation (IntegrityError)',
    cause: 'A database INSERT or UPDATE violated a unique constraint. A record with that value already exists.',
    steps: [
      'Use `get_or_create()` or `update_or_create()` instead of `create()` when a duplicate may already exist.',
      'Add uniqueness validation in the form or serializer before hitting the database.',
      'Check the model field for `unique=True` or `UniqueConstraint` in Meta to identify which field conflicts.',
    ],
    confidence: 'High',
  },
  {
    test: /sqlalchemy.*IntegrityError|sqlalchemy.*OperationalError/i,
    title: () => 'SQLAlchemy database integrity or operational error',
    cause: 'A SQLAlchemy database operation failed due to a constraint violation or operational issue.',
    steps: [
      'Read the wrapped database error message for the specific SQL error code and table/column context.',
      'Call `session.rollback()` after catching IntegrityError to keep the session usable.',
      'Run Alembic migrations (`alembic upgrade head`) to ensure the schema matches your models.',
    ],
    confidence: 'Medium',
  },

  // ═══════════════════════════ QUEUE / BACKGROUND JOBS ═══════════════════════════
  {
    test: /job.*failed.*attempt|bull.*job.*failed|bullmq.*failed|worker.*job.*error/i,
    title: () => 'Background job failed (Bull/BullMQ)',
    cause: 'A Bull or BullMQ job exhausted its retry attempts and was moved to the failed state. The processor may have thrown an unhandled error or timed out.',
    steps: [
      'Inspect the job\'s stacktrace via the Bull dashboard or `queue.getFailed()` to find the root error.',
      'Wrap the job processor body in try/catch and distinguish transient errors (retry) from permanent ones (discard).',
      'Increase `attempts` and configure `backoff` in the job options for transient network errors.',
      'Check for missing environment variables or circular dependencies in the worker process.',
    ],
    confidence: 'Medium',
  },
];

function known(message, level) {
  // Collect ALL matching patterns and pick the most specific one.
  // Scoring: dynamic title/cause (captures real values from the log) = +10,
  // High confidence = +5, Medium = +2, longer regex = tiebreaker.
  // This prevents a broad generic pattern (e.g. /timeout/i) from
  // shadowing a specific one (e.g. /TokenExpiredError: jwt expired/i).
  const m = message.toLowerCase();
  let best = null;
  let bestScore = -1;
  for (const pattern of PATTERNS) {
    const match = message.match(pattern.test) || m.match(pattern.test);
    if (!match) continue;
    const score =
      (typeof pattern.title === 'function' ? 10 : 0) +
      (typeof pattern.cause === 'function' ? 5 : 0) +
      (pattern.confidence === 'High' ? 5 : pattern.confidence === 'Medium' ? 2 : 0) +
      pattern.test.source.length / 100;
    if (score > bestScore) {
      bestScore = score;
      best = { pattern, match };
    }
  }
  if (!best) return null;
  const { pattern, match } = best;
  return {
    title: typeof pattern.title === 'function' ? pattern.title(match) : pattern.title,
    cause: typeof pattern.cause === 'function' ? pattern.cause(match) : pattern.cause,
    steps: pattern.steps,
    confidence: pattern.confidence,
  };
}

function signature(text) {
  return crypto
    .createHash('sha256')
    .update(
      text
        .toLowerCase()
        .replace(/\b\d+\b/g, '#')
        .replace(/[\w.+-]+@[\w.-]+/g, '[email]')
    )
    .digest('hex');
}

// Extracts structured context from raw log/error text to give the AI model
// a head-start instead of re-parsing the flat string from scratch.
function preProcess(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

  // Detect runtime/language from stack frame style
  let language = 'unknown';
  if (/Traceback \(most recent call last\)/i.test(text) || /^\s+File ".*\.py"/m.test(text)) {
    language = 'python';
  } else if (/^\s+at [a-zA-Z].+\.java:\d+\)/m.test(text)) {
    language = 'java';
  } else if (/goroutine \d+ \[running\]/.test(text)) {
    language = 'go';
  } else if (/thread '.*' panicked at/.test(text)) {
    language = 'rust';
  } else if (/^\s+in \/.*\.rb:\d+/m.test(text)) {
    language = 'ruby';
  } else if (/^\s+at /.test(text)) {
    // Node.js / browser JS stack frames
    language = 'javascript';
  }

  // First meaningful line that isn't a stack frame or blank
  const isFrame = /^\s*(?:at |File "|Caused by:|  File |\tat |\.{3}\d+ more)/;
  const firstLine = lines.find(l => !isFrame.test(l) && l.trim().length > 5) || '';

  // First application stack frame — skip node_modules, runtime internals, and stdlib
  const skipFrame = /node_modules|node:internal|node:|<anonymous>|site-packages|<frozen/;
  const firstAppFrame = lines.find(l =>
    (/^\s+at /.test(l) || /^\s+File "/.test(l)) && !skipFrame.test(l)
  ) || '';

  return {
    language,
    firstLine: firstLine.trim().slice(0, 300),
    firstAppFrame: firstAppFrame.trim().slice(0, 200),
  };
}

async function explain(text, level, pool) {
  // Include severity and the explainer generation in the cache key. Reusing a
  // result across levels can incorrectly turn an INFO message into an error.
  const sig = signature(`explainer-v2\0${level}\0${text}`);

  // Check cache first — use a versioned key so old brief explanations
  // are not served after this detailed-explanation upgrade.
  const cached = await pool.query(
    'SELECT explanation FROM explanation_cache WHERE signature=$1',
    [sig]
  );
  if (cached.rowCount) return cached.rows[0].explanation;

  // Pattern matching gives us a classification hint — we pass this to the AI
  // as context so it can be more precise, but the AI always generates the final
  // detailed explanation rather than the brief hardcoded pattern text.
  const hint = known(text, level);
  let value = null;

  // Pre-process raw text to extract structured context.
  const pre = preProcess(text);

  // Always use Groq / OpenAI for the full detailed explanation.
  // The pattern hint anchors the AI to the right error class.
  const groqKey = process.env.GROQ_API_KEY;
  const providerKey = groqKey || process.env.OPENAI_API_KEY;
  const provider = groqKey ? 'groq' : 'openai';
  if (providerKey) {
    try {
      const endpoint = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/responses'
        : 'https://api.openai.com/v1/responses';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${providerKey}`,
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: provider === 'groq'
            ? process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
            : process.env.OPENAI_MODEL || 'gpt-4.1-mini',
          store: false,
          input: [
            {
              role: 'system',
              content: `You are a patient, friendly senior developer explaining a production error to a junior developer who is just learning. Your goal is to make them truly understand what went wrong and how to fix it step by step — like a great teacher, not a documentation page.

TONE & STYLE:
- Write in plain, friendly English. Avoid unexplained jargon.
- If you must use a technical term (e.g. "connection pool"), briefly say what it means in parentheses.
- Be specific — use the actual values visible in the log (port number, file name, table name, URL, error code). Never say "check the port" when you can say "check port 5432".
- Be encouraging — treat every error as a learning opportunity.

FIELD RULES:

title (max 150 chars):
- Start with the exact exception class or error code from the log (e.g. "ECONNREFUSED 127.0.0.1:5432 — Database connection refused").

cause (max 2000 chars):
- Open with a plain-English analogy or explanation of WHAT this error means (imagine explaining it to someone who just started coding).
- Then explain WHY it most likely happened in this specific case, referencing the actual values from the log.
- If a first_app_frame is provided, mention the file and line number — that is the exact place in YOUR code where the problem surfaced.
- End with a one-sentence summary of the most likely root cause.

steps (5 to 8 steps, each max 800 chars):
- Each step must be a self-contained mini-lesson: what to do, the EXACT command to run (if any), what output to look for, and a one-sentence explanation of WHY this step helps.
- Use specific values from the log (e.g. "run: pg_isready -h 127.0.0.1 -p 5432" not "check if the database is running").
- Order steps from quickest-to-check to more involved fixes.
- Do not make things up — only reference facts present in the log.

confidence:
- "High" only if the log contains a specific exception name, error code, or app stack frame that clearly identifies the failure.
- "Medium" if the error type is clear but some context is missing.
- "Low" if the log is vague or truncated.

Return JSON only — no markdown, no extra text outside the JSON object.`,
            },
            {
              role: 'user',
              content: [
                `level=${level}`,
                pre.language !== 'unknown' ? `language=${pre.language}` : '',
                pre.firstLine ? `error_summary=${pre.firstLine}` : '',
                pre.firstAppFrame ? `first_app_frame=${pre.firstAppFrame}` : '',
                hint ? `pattern_hint=${hint.title}` : '',
                `log=${text.slice(0, 5200)}`,
              ].filter(Boolean).join('\n'),
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'log_explanation',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  cause: { type: 'string' },
                  steps: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  confidence: {
                    type: 'string',
                    enum: ['Low', 'Medium', 'High'],
                  },
                },
                required: ['title', 'cause', 'steps', 'confidence'],
                additionalProperties: false,
              },
            },
          },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const output = data.output
          ?.flatMap(x => x.content || [])
          .find(x => x.type === 'output_text')?.text;
        const parsed = JSON.parse(output || '{}');
        // Increased limits: cause 2000 chars, each step 800 chars, up to 8 steps.
        const clean = (value, max) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
        const steps = Array.isArray(parsed.steps)
          ? parsed.steps.filter(step => typeof step === 'string').map(step => clean(step, 800)).filter(Boolean).slice(0, 8)
          : [];
        const title = typeof parsed.title === 'string' ? clean(parsed.title, 150) : '';
        const cause = typeof parsed.cause === 'string' ? clean(parsed.cause, 2000) : '';
        if (title && cause && steps.length >= 3) {
          value = {
            title,
            cause,
            steps,
            confidence: ['Low', 'Medium', 'High'].includes(parsed.confidence)
              ? parsed.confidence
              : 'Low',
            source: 'ai',
          };
        }
      }
    } catch {
      // AI call failed — fall back to the pattern hint if available.
      if (hint) value = { ...hint, source: 'rule' };
    }
  }

  // If no AI key is configured, use the pattern hint directly.
  if (!value && hint) value = { ...hint, source: 'rule' };

  // Ultimate fallback
  value ||= {
    title: 'A log signal needs a closer look',
    cause: 'More surrounding context is needed to identify a likely cause.',
    steps: [
      'Compare nearby events and recent deploys.',
      'Look for repeated messages or rising duration.',
      'Add service context if this signal matters.',
    ],
    confidence: 'Low',
    source: 'fallback',
  };

  // Cache specific rule/AI results only. A transient AI outage must not cache
  // a generic fallback and keep returning it after the provider recovers.
  if (value.source !== 'fallback') {
    await pool.query(
      'INSERT INTO explanation_cache(signature,explanation) VALUES($1,$2) ON CONFLICT(signature) DO NOTHING',
      [sig, JSON.stringify(value)]
    );
  }
  return value;
}

module.exports = { explain, known, signature };
