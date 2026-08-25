# DecryptionCaller



> DecryptionCaller — COTI Native shim



*Port-experiment stand-in for the upstream async decryption oracle, which is not      published. COTI decrypts synchronously via `MpcCore.decrypt`, so a request is      opened, resolved and delivered to its callback inside a single transaction.      This is the B4 &quot;drop the async apparatus&quot; collapse, expressed as the smallest      shim that satisfies the call sites in PrivateToken.*



