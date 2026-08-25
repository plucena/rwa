# IPrivateIdentityRegistry









## Methods

### deleteIdentity

```solidity
function deleteIdentity(address _userAddress) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |

### investorCountry

```solidity
function investorCountry(address _userAddress) external view returns (uint16)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | undefined |

### isVerified

```solidity
function isVerified(address _userAddress) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### registerIdentity

```solidity
function registerIdentity(address _userAddress, contract IPrivateIdentity _identity, uint16 _country) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _userAddress | address | undefined |
| _identity | contract IPrivateIdentity | undefined |
| _country | uint16 | undefined |




