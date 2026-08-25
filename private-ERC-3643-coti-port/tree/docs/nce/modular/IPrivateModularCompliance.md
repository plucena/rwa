# IPrivateModularCompliance









## Methods

### addModule

```solidity
function addModule(address _module) external nonpayable
```



*adds a module to the list of compliance modules*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _module | address | address of the module to add  there cannot be more than 25 modules bound to the modular compliance for gas cost reasons  This function can be called ONLY by the owner of the compliance contract  Emits a ModuleAdded event |

### bindToken

```solidity
function bindToken(address _token) external nonpayable
```



*binds a token to the compliance contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _token | address | address of the token to bind  This function can be called ONLY by the owner of the compliance contract  Emits a TokenBound event |

### callModuleFunction

```solidity
function callModuleFunction(bytes callData, address _module) external nonpayable
```



*calls any function on bound modules  can be called only on bound modules*

#### Parameters

| Name | Type | Description |
|---|---|---|
| callData | bytes | the bytecode for interaction with the module, abi encoded |
| _module | address | The address of the module  This function can be called only by the modular compliance owner  emits a `ModuleInteraction` event |

### canTransfer

```solidity
function canTransfer(address _from, address _to, gtUint256 _amount) external nonpayable returns (gtBool)
```



*Returns an encrypted transfer-policy allow bit.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _from | address | The address of the sender |
| _to | address | The address of the receiver |
| _amount | gtUint256 | The amount of tokens involved in the transfer  This function may call module checks and aggregate them into a single encrypted  policy result consumed by `PrivateToken` (legacy name: `PravateToken`).  Return semantics are intentionally &quot;allow-oriented&quot;:  - `gtBool(true)`  =&gt; transfer/mint is allowed by compliance  - `gtBool(false)` =&gt; transfer/mint must be blocked  Not `view`: private / MPC compliance may invoke on-chain handlers (e.g. SetPublic),  which must not be executed via STATICCALL. |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | gtBool | undefined |

### created

```solidity
function created(address _to, uint256 _amount) external nonpayable
```



*function called whenever tokens are created on a wallet  this function can update state variables in the modules bound to the compliance  these state variables being used by the module checks to decide if a transfer  is compliant or not depending on the values stored in these state variables and on  the parameters of the modules  This function can be called ONLY by the token contract bound to the compliance*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _to | address | The address of the receiver |
| _amount | uint256 | The amount of tokens involved in the minting  This function calls moduleMintAction() on each module bound to the compliance contract |

### destroyed

```solidity
function destroyed(address _from, uint256 _amount) external nonpayable
```



*function called whenever tokens are destroyed from a wallet  this function can update state variables in the modules bound to the compliance  these state variables being used by the module checks to decide if a transfer  is compliant or not depending on the values stored in these state variables and on  the parameters of the modules  This function can be called ONLY by the token contract bound to the compliance*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _from | address | The address on which tokens are burnt |
| _amount | uint256 | The amount of tokens involved in the burn  This function calls moduleBurnAction() on each module bound to the compliance contract |

### getModules

```solidity
function getModules() external view returns (address[])
```



*getter for the modules bound to the compliance contract  returns address array of module contracts bound to the compliance*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address[] | undefined |

### getTokenBound

```solidity
function getTokenBound() external view returns (address)
```



*getter for the address of the token bound  returns the address of the token*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### isModuleBound

```solidity
function isModuleBound(address _module) external view returns (bool)
```



*checks if a module is bound to the compliance contract  returns true if module is bound, false otherwise*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _module | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### removeModule

```solidity
function removeModule(address _module) external nonpayable
```



*removes a module from the list of compliance modules*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _module | address | address of the module to remove  This function can be called ONLY by the owner of the compliance contract  Emits a ModuleRemoved event |

### transferred

```solidity
function transferred(address _from, address _to, gtUint256 _amount) external nonpayable
```



*function called whenever tokens are transferred  from one wallet to another  this function can update state variables in the modules bound to the compliance  these state variables being used by the module checks to decide if a transfer  is compliant or not depending on the values stored in these state variables and on  the parameters of the modules  This function can be called ONLY by the token contract bound to the compliance*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _from | address | The address of the sender |
| _to | address | The address of the receiver |
| _amount | gtUint256 | The amount of tokens involved in the transfer  This function calls moduleTransferAction() on each module bound to the compliance contract |

### unbindToken

```solidity
function unbindToken(address _token) external nonpayable
```



*unbinds a token from the compliance contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _token | address | address of the token to unbind  This function can be called ONLY by the owner of the compliance contract  Emits a TokenUnbound event |



## Events

### ModuleAdded

```solidity
event ModuleAdded(address indexed _module)
```

this event is emitted when a module has been added to the list of modules bound to the compliance contract  the event is emitted by the addModule function  `_module` is the address of the compliance module



#### Parameters

| Name | Type | Description |
|---|---|---|
| _module `indexed` | address | undefined |

### ModuleInteraction

```solidity
event ModuleInteraction(address indexed target, bytes4 selector)
```



*Event emitted for each executed interaction with a module contract.  For gas efficiency, only the interaction calldata selector (first 4  bytes) is included in the event. For interactions without calldata or  whose calldata is shorter than 4 bytes, the selector will be `0`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| target `indexed` | address | undefined |
| selector  | bytes4 | undefined |

### ModuleRemoved

```solidity
event ModuleRemoved(address indexed _module)
```

this event is emitted when a module has been removed from the list of modules bound to the compliance contract  the event is emitted by the removeModule function  `_module` is the address of the compliance module



#### Parameters

| Name | Type | Description |
|---|---|---|
| _module `indexed` | address | undefined |

### TokenBound

```solidity
event TokenBound(address _token)
```

this event is emitted when a token has been bound to the compliance contract  the event is emitted by the bindToken function  `_token` is the address of the token to bind



#### Parameters

| Name | Type | Description |
|---|---|---|
| _token  | address | undefined |

### TokenUnbound

```solidity
event TokenUnbound(address _token)
```

this event is emitted when a token has been unbound from the compliance contract  the event is emitted by the unbindToken function  `_token` is the address of the token to unbind



#### Parameters

| Name | Type | Description |
|---|---|---|
| _token  | address | undefined |



