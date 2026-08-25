# PrivateToken









## Methods

### MAX_BATCH_BURN_SIZE

```solidity
function MAX_BATCH_BURN_SIZE() external view returns (uint256)
```

Hard cap on `batchBurn` row count (gas / MPC). Exposed on the ABI as `MAX_BATCH_BURN_SIZE`.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### MAX_BATCH_OPERATION_SIZE

```solidity
function MAX_BATCH_OPERATION_SIZE() external view returns (uint256)
```

Generic hard cap for non-burn batch operations.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### addAgent

```solidity
function addAgent(address _agent) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _agent | address | undefined |

### allowance

```solidity
function allowance(address _owner, address _spender) external view returns (struct ctUint256)
```



*See {IERC20-allowance}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _owner | address | undefined |
| _spender | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | ctUint256 | undefined |

### approve

```solidity
function approve(address _spender, itUint256 _it) external nonpayable returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _spender | address | undefined |
| _it | itUint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### balanceOf

```solidity
function balanceOf(address _userAddress) external view returns (struct ctUint256)
```



*See {IERC20-balanceOf}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | ctUint256 | undefined |

### batchBurn

```solidity
function batchBurn(address[] _userAddresses, uint256[] _amounts) external nonpayable
```

Batch burn with one MPC decrypt request and one `callbackBurn` (N handles → N plaintext outputs).

*See `docs/BatchBurnOperations.md` for caps, requested vs effective amounts, duplicate rows, and stuck ids.Sum of `_amounts` must not exceed `totalSupply` (clear); per-row effective burn follows `_burn` (may be zero).*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddresses | address[] | undefined |
| _amounts | uint256[] | undefined |

### batchForcedTransfer

```solidity
function batchForcedTransfer(address[] _fromList, address[] _toList, gtUint256[] _amounts) external nonpayable
```



*See {IToken-batchForcedTransfer}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _fromList | address[] | undefined |
| _toList | address[] | undefined |
| _amounts | gtUint256[] | undefined |

### batchFreezePartialTokens

```solidity
function batchFreezePartialTokens(address[] _userAddresses, gtUint256[] _amounts) external nonpayable
```



*See {IToken-batchFreezePartialTokens}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddresses | address[] | undefined |
| _amounts | gtUint256[] | undefined |

### batchMint

```solidity
function batchMint(address[] _toList, uint256[] _amounts) external nonpayable
```



*See {IToken-batchMint}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _toList | address[] | undefined |
| _amounts | uint256[] | undefined |

### batchSetAddressFrozen

```solidity
function batchSetAddressFrozen(address[] _userAddresses, bool[] _freeze) external nonpayable
```



*See {IToken-batchSetAddressFrozen}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddresses | address[] | undefined |
| _freeze | bool[] | undefined |

### batchTransfer

```solidity
function batchTransfer(address[] _toList, itUint256[] _its) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _toList | address[] | undefined |
| _its | itUint256[] | undefined |

### batchUnfreezePartialTokens

```solidity
function batchUnfreezePartialTokens(address[] _userAddresses, gtUint256[] _amounts) external nonpayable
```



*See {IToken-batchUnfreezePartialTokens}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddresses | address[] | undefined |
| _amounts | gtUint256[] | undefined |

### burn

```solidity
function burn(address _userAddress, uint256 _amount) external nonpayable
```

Request a burn: private balance is updated immediately; `totalSupply` and compliance `destroyed` run in `callbackBurn`.

*The clear `_amount` is the requested burn. The encrypted burn applied in `_burn` may be zero if the holder’s  private balance is insufficient (same semantics as batch rows). See `docs/BatchBurnOperations.md`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |
| _amount | uint256 | undefined |

### callbackBurn

```solidity
function callbackBurn(uint256 decryptID, bytes[] output, bytes[] signatures) external nonpayable
```

MPC callback: finalizes clear `totalSupply` and compliance from verified decrypted burn amounts.

*Dispatches on pending metadata at `decryptID` (single `_burnRequests` vs batch `_batchBurnUsers`).*

#### Parameters

| Name | Type | Description |
|---|---|---|
| decryptID | uint256 | undefined |
| output | bytes[] | undefined |
| signatures | bytes[] | undefined |

### callbackMint

```solidity
function callbackMint(uint256 decryptID, bytes[] output, bytes[] signatures) external nonpayable
```

MPC callback: finalizes clear `totalSupply` and compliance from verified decrypted mint amounts.



#### Parameters

| Name | Type | Description |
|---|---|---|
| decryptID | uint256 | undefined |
| output | bytes[] | undefined |
| signatures | bytes[] | undefined |

### compliance

```solidity
function compliance() external view returns (contract IPrivateModularCompliance)
```



*See {IToken-compliance}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IPrivateModularCompliance | undefined |

### decimals

```solidity
function decimals() external view returns (uint8)
```



*See {IToken-decimals}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined |

### decreaseAllowance

```solidity
function decreaseAllowance(address _spender, itUint256 _it) external nonpayable returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _spender | address | undefined |
| _it | itUint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### forcedTransfer

```solidity
function forcedTransfer(address _from, address _to, gtUint256 _amount) external nonpayable returns (bool)
```



*See {IToken-forcedTransfer}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _from | address | undefined |
| _to | address | undefined |
| _amount | gtUint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### freezePartialTokens

```solidity
function freezePartialTokens(address _userAddress, itUint256 _it) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |
| _it | itUint256 | undefined |

### frozenTokensFor

```solidity
function frozenTokensFor(address _reader, address _userAddress) external view returns (struct ctUint256)
```

The caller&#39;s copy of a holder&#39;s frozen amount, as last re-encrypted.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _reader | address | undefined |
| _userAddress | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | ctUint256 | undefined |

### getFrozenTokens

```solidity
function getFrozenTokens(address _userAddress) external view returns (struct ctUint256)
```



*See {IToken-getFrozenTokens}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | ctUint256 | undefined |

### getLastDecryptRequestId

```solidity
function getLastDecryptRequestId() external view returns (uint256)
```

Last created decrypt request id (for off-chain relayers/tests).




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getPendingBatchBurnUsers

```solidity
function getPendingBatchBurnUsers(uint256 decryptID) external view returns (address[] users)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| decryptID | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| users | address[] | Users registered for a pending batch burn at `decryptID`, or empty if none / not a batch row. |

### getPendingSingleBurnUser

```solidity
function getPendingSingleBurnUser(uint256 decryptID) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| decryptID | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | User registered for a pending single burn at `decryptID`, or zero if none. |

### identityRegistry

```solidity
function identityRegistry() external view returns (contract IPrivateIdentityRegistry)
```



*See {IToken-identityRegistry}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IPrivateIdentityRegistry | undefined |

### increaseAllowance

```solidity
function increaseAllowance(address _spender, itUint256 _it) external nonpayable returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _spender | address | undefined |
| _it | itUint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### init

```solidity
function init(address _identityRegistry, address _compliance, string _name, string _symbol, uint8 _decimals, address _onchainID) external nonpayable
```



*the initializer initiates the token contract  msg.sender is set automatically as the owner of the smart contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _identityRegistry | address | the address of the Identity registry linked to the token |
| _compliance | address | the address of the compliance contract linked to the token |
| _name | string | the name of the token |
| _symbol | string | the symbol of the token |
| _decimals | uint8 | the decimals of the token |
| _onchainID | address | the address of the onchainID of the token  emits an `UpdatedTokenInformation` event  emits an `IdentityRegistryAdded` event  emits a `ComplianceAdded` event |

### isAgent

```solidity
function isAgent(address _agent) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _agent | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### isBurnDecryptPending

```solidity
function isBurnDecryptPending(uint256 decryptID) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| decryptID | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | True if a `callbackBurn` is still expected for this id (single or batch metadata present). |

### isFrozen

```solidity
function isFrozen(address _userAddress) external view returns (bool)
```



*See {IToken-isFrozen}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### isMintDecryptPending

```solidity
function isMintDecryptPending(uint256 decryptID) external view returns (bool)
```

Returns whether a single-mint decrypt callback is still pending for `decryptID`.



#### Parameters

| Name | Type | Description |
|---|---|---|
| decryptID | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### mint

```solidity
function mint(address _to, uint256 _amount) external nonpayable
```



*See {IToken-mint}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _to | address | undefined |
| _amount | uint256 | undefined |

### name

```solidity
function name() external view returns (string)
```



*See {IToken-name}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### onchainID

```solidity
function onchainID() external view returns (address)
```



*See {IToken-onchainID}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### pause

```solidity
function pause() external nonpayable
```



*See {IToken-pause}.*


### paused

```solidity
function paused() external view returns (bool)
```



*See {IToken-paused}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### recoveryAddress

```solidity
function recoveryAddress(address _lostWallet, address _newWallet, address _investorOnchainID) external nonpayable returns (bool)
```



*See {IToken-recoveryAddress}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _lostWallet | address | undefined |
| _newWallet | address | undefined |
| _investorOnchainID | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### reencryptFrozenTokens

```solidity
function reencryptFrozenTokens(address _userAddress) external nonpayable returns (struct ctUint256)
```

Re-encrypt a holder&#39;s frozen amount to the caller&#39;s key.

*The on-demand half of the B2 design. Agents are a role and therefore an unbounded      reader set, so they get no eager slot; an entitled caller mints its own copy here.      Entitlement is enforced in Solidity — this `require` is the access control that      the upstream MPC-layer `permit` used to provide.      Note the trade this makes: calling it is a transaction, so it records on-chain that      the caller read this holder&#39;s record. That metadata cost is why the holder, sender,      receiver, owner and spender copies are written eagerly instead.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | ctUint256 | undefined |

### removeAgent

```solidity
function removeAgent(address _agent) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _agent | address | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.*


### setAccountEncryptionAddress

```solidity
function setAccountEncryptionAddress(address _offBoardAddress) external nonpayable returns (bool)
```

Point the caller&#39;s ciphertexts at a different key.

*The repair path, mirroring `PrivateERC20.setAccountEncryptionAddress`: rotating a key      would otherwise strand every copy already written to the old one. Balance and frozen      copies are rebuilt here; allowances are rebuilt by the counterparty-specific flow.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _offBoardAddress | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### setAddressFrozen

```solidity
function setAddressFrozen(address _userAddress, bool _freeze) external nonpayable
```



*See {IToken-setAddressFrozen}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |
| _freeze | bool | undefined |

### setCompliance

```solidity
function setCompliance(address _compliance) external nonpayable
```



*See {IToken-setCompliance}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _compliance | address | undefined |

### setIdentityRegistry

```solidity
function setIdentityRegistry(address _identityRegistry) external nonpayable
```



*See {IToken-setIdentityRegistry}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _identityRegistry | address | undefined |

### setName

```solidity
function setName(string _name) external nonpayable
```



*See {IToken-setName}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _name | string | undefined |

### setOnchainID

```solidity
function setOnchainID(address _onchainID) external nonpayable
```



*See {IToken-setOnchainID}.  if _onchainID is set at zero address it means no ONCHAINID is bound to this token*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _onchainID | address | undefined |

### setSymbol

```solidity
function setSymbol(string _symbol) external nonpayable
```



*See {IToken-setSymbol}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _symbol | string | undefined |

### symbol

```solidity
function symbol() external view returns (string)
```



*See {IToken-symbol}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```



*See {IERC20-totalSupply}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### transfer

```solidity
function transfer(address _to, itUint256 _it) external nonpayable returns (gtBool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _to | address | undefined |
| _it | itUint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | gtBool | undefined |

### transferFrom

```solidity
function transferFrom(address _from, address _to, itUint256 _it) external nonpayable returns (gtBool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _from | address | undefined |
| _to | address | undefined |
| _it | itUint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | gtBool | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### unfreezePartialTokens

```solidity
function unfreezePartialTokens(address _userAddress, itUint256 _it) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |
| _it | itUint256 | undefined |

### unpause

```solidity
function unpause() external nonpayable
```



*See {IToken-unpause}.*


### version

```solidity
function version() external pure returns (string)
```



*See {IToken-version}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |



## Events

### AccountEncryptionAddressSet

```solidity
event AccountEncryptionAddressSet(address indexed account, address indexed offBoardAddress)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| offBoardAddress `indexed` | address | undefined |

### AddressFrozen

```solidity
event AddressFrozen(address indexed _userAddress, bool indexed _isFrozen, address indexed _owner)
```

this event is emitted when the wallet of an investor is frozen or unfrozen  the event is emitted by setAddressFrozen and batchSetAddressFrozen functions  `_userAddress` is the wallet of the investor that is concerned by the freezing status  `_isFrozen` is the freezing status of the wallet  if `_isFrozen` equals `true` the wallet is frozen after emission of the event  if `_isFrozen` equals `false` the wallet is unfrozen after emission of the event  `_owner` is the address of the agent who called the function to freeze the wallet



#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress `indexed` | address | undefined |
| _isFrozen `indexed` | bool | undefined |
| _owner `indexed` | address | undefined |

### AgentAdded

```solidity
event AgentAdded(address indexed _agent)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _agent `indexed` | address | undefined |

### AgentRemoved

```solidity
event AgentRemoved(address indexed _agent)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _agent `indexed` | address | undefined |

### Approval

```solidity
event Approval(address indexed _owner, address indexed _spender, ctUint256 _ownerValue, ctUint256 _spenderValue)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _owner `indexed` | address | undefined |
| _spender `indexed` | address | undefined |
| _ownerValue  | ctUint256 | undefined |
| _spenderValue  | ctUint256 | undefined |

### BurnFinalized

```solidity
event BurnFinalized(address indexed user, uint256 burnedAmount, uint256 decryptID)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| burnedAmount  | uint256 | undefined |
| decryptID  | uint256 | undefined |

### BurnRequested

```solidity
event BurnRequested(address indexed user, uint256 requestedAmount, uint256 decryptID, gtUint256 burnedAmountHandle)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| requestedAmount  | uint256 | undefined |
| decryptID  | uint256 | undefined |
| burnedAmountHandle  | gtUint256 | undefined |

### ComplianceAdded

```solidity
event ComplianceAdded(address indexed _compliance)
```

this event is emitted when the Compliance has been set for the token  the event is emitted by the token constructor and by the setCompliance function  `_compliance` is the address of the Compliance contract of the token



#### Parameters

| Name | Type | Description |
|---|---|---|
| _compliance `indexed` | address | undefined |

### FrozenTokensReencrypted

```solidity
event FrozenTokensReencrypted(address indexed reader, address indexed userAddress)
```



*B2: emitted when an entitled reader mints its own copy of a frozen amount.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| reader `indexed` | address | undefined |
| userAddress `indexed` | address | undefined |

### IdentityRegistryAdded

```solidity
event IdentityRegistryAdded(address indexed _identityRegistry)
```

this event is emitted when the IdentityRegistry has been set for the token  the event is emitted by the token constructor and by the setIdentityRegistry function  `_identityRegistry` is the address of the Identity Registry of the token



#### Parameters

| Name | Type | Description |
|---|---|---|
| _identityRegistry `indexed` | address | undefined |

### Initialized

```solidity
event Initialized(uint8 version)
```



*Triggered when the contract has been initialized or reinitialized.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |

### MintFinalized

```solidity
event MintFinalized(address indexed user, uint256 mintedAmount, uint256 decryptID)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| mintedAmount  | uint256 | undefined |
| decryptID  | uint256 | undefined |

### MintRequested

```solidity
event MintRequested(address indexed user, uint256 requestedAmount, uint256 decryptID, gtUint256 mintedAmountHandle)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| requestedAmount  | uint256 | undefined |
| decryptID  | uint256 | undefined |
| mintedAmountHandle  | gtUint256 | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### Paused

```solidity
event Paused(address _userAddress)
```

this event is emitted when the token is paused  the event is emitted by the pause function  `_userAddress` is the address of the wallet that called the pause function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress  | address | undefined |

### RecoverySuccess

```solidity
event RecoverySuccess(address indexed _lostWallet, address indexed _newWallet, address indexed _investorOnchainID)
```

this event is emitted when an investor successfully recovers his tokens  the event is emitted by the recoveryAddress function  `_lostWallet` is the address of the wallet that the investor lost access to  `_newWallet` is the address of the wallet that the investor provided for the recovery  `_investorOnchainID` is the address of the onchainID of the investor who asked for a recovery



#### Parameters

| Name | Type | Description |
|---|---|---|
| _lostWallet `indexed` | address | undefined |
| _newWallet `indexed` | address | undefined |
| _investorOnchainID `indexed` | address | undefined |

### TokensFrozen

```solidity
event TokensFrozen(address indexed _userAddress, ctUint256 _amount)
```

this event is emitted when a certain amount of tokens is frozen on a wallet  the event is emitted by freezePartialTokens and batchFreezePartialTokens functions  `_userAddress` is the wallet of the investor that is concerned by the freezing status  `_amount` is the amount of tokens that are frozen



#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress `indexed` | address | undefined |
| _amount  | ctUint256 | undefined |

### TokensUnfrozen

```solidity
event TokensUnfrozen(address indexed _userAddress, ctUint256 _amount)
```

this event is emitted when a certain amount of tokens is unfrozen on a wallet  the event is emitted by unfreezePartialTokens and batchUnfreezePartialTokens functions  `_userAddress` is the wallet of the investor that is concerned by the freezing status  `_amount` is the amount of tokens that are unfrozen



#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress `indexed` | address | undefined |
| _amount  | ctUint256 | undefined |

### Transfer

```solidity
event Transfer(address indexed _from, address indexed _to, ctUint256 _fromValue, ctUint256 _toValue)
```

events



#### Parameters

| Name | Type | Description |
|---|---|---|
| _from `indexed` | address | undefined |
| _to `indexed` | address | undefined |
| _fromValue  | ctUint256 | undefined |
| _toValue  | ctUint256 | undefined |

### Unpaused

```solidity
event Unpaused(address _userAddress)
```

this event is emitted when the token is unpaused  the event is emitted by the unpause function  `_userAddress` is the address of the wallet that called the unpause function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress  | address | undefined |

### UpdatedTokenInformation

```solidity
event UpdatedTokenInformation(string indexed _newName, string indexed _newSymbol, uint8 _newDecimals, string _newVersion, address indexed _newOnchainID)
```

this event is emitted when the token information is updated.  the event is emitted by the token init function and by the setTokenInformation function  `_newName` is the name of the token  `_newSymbol` is the symbol of the token  `_newDecimals` is the decimals of the token  `_newVersion` is the version of the token, current version is 3.0  `_newOnchainID` is the address of the onchainID of the token



#### Parameters

| Name | Type | Description |
|---|---|---|
| _newName `indexed` | string | undefined |
| _newSymbol `indexed` | string | undefined |
| _newDecimals  | uint8 | undefined |
| _newVersion  | string | undefined |
| _newOnchainID `indexed` | address | undefined |



