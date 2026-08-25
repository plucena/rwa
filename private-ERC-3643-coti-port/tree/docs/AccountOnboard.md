# AccountOnboard



> AccountOnboard



*Verbatim from coti-io/coti-contracts (`contracts/onboard/AccountOnboard.sol`), with the      import repointed at this tree&#39;s vendored MpcCore. Deployed by the test fixture so each      signer can obtain its own AES key.      Why it is needed: an encrypted input must be encrypted under the *sender&#39;s* key.      `setAccountEncryptionAddress` redirects outputs only, so multi-party tests cannot be      driven from a single key without silently passing for the wrong reason.*

## Methods

### onboardAccount

```solidity
function onboardAccount(bytes publicKey, bytes signedEK) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| publicKey | bytes | undefined |
| signedEK | bytes | undefined |



## Events

### AccountOnboarded

```solidity
event AccountOnboarded(address indexed _from, bytes userKey1, bytes userKey2)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _from `indexed` | address | undefined |
| userKey1  | bytes | undefined |
| userKey2  | bytes | undefined |



