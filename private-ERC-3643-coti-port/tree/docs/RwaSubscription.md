# RwaSubscription



> RwaSubscription

Primary-market subscription: pay a stablecoin, receive tokenised fund shares.

*The token&#39;s `mint` is agent-only, so this contract must be added as an agent on the      PrivateToken. Shares are minted directly to the subscriber, whose balance is encrypted      from that point on.      PRIVACY NOTE, deliberately not hidden: USDC and USDT on COTI testnet are ordinary      ERC-20s with public amounts. The payment leg of a subscription is therefore visible,      and because the price is public the share count follows from it — so a subscription      discloses its own size even though the resulting balance is encrypted. Confidentiality      begins at the first transfer, not at the purchase. Closing this needs a confidential      payment token or off-chain settlement; see coti_rwa.md.*

## Methods

### owner

```solidity
function owner() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### priceOf

```solidity
function priceOf(address paymentToken) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentToken | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### quote

```solidity
function quote(address paymentToken, uint256 paymentAmount) external view returns (uint256)
```

Shares a given payment buys, for quoting in the UI before the user commits.



#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentToken | address | undefined |
| paymentAmount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### setPrice

```solidity
function setPrice(address paymentToken, uint256 price) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentToken | address | undefined |
| price | uint256 | undefined |

### setTreasury

```solidity
function setTreasury(address _treasury) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _treasury | address | undefined |

### subscribe

```solidity
function subscribe(address paymentToken, uint256 paymentAmount) external nonpayable returns (uint256)
```

Subscribe: pull `paymentAmount` of `paymentToken` and mint the matching shares.

*Requires prior `approve` on the payment token, and that the buyer is verified in      the fund&#39;s identity registry — the ERC-3643 eligibility check that makes this a      security token rather than a free-floating one.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentToken | address | undefined |
| paymentAmount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### token

```solidity
function token() external view returns (contract IPrivateToken)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IPrivateToken | undefined |

### treasury

```solidity
function treasury() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |



## Events

### PriceSet

```solidity
event PriceSet(address indexed paymentToken, uint256 price)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentToken `indexed` | address | undefined |
| price  | uint256 | undefined |

### Subscribed

```solidity
event Subscribed(address indexed buyer, address indexed paymentToken, uint256 paymentAmount, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| buyer `indexed` | address | undefined |
| paymentToken `indexed` | address | undefined |
| paymentAmount  | uint256 | undefined |
| shares  | uint256 | undefined |

### TreasurySet

```solidity
event TreasurySet(address indexed treasury)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| treasury `indexed` | address | undefined |



## Errors

### NotOwner

```solidity
error NotOwner()
```






### NotVerified

```solidity
error NotVerified()
```






### NothingToBuy

```solidity
error NothingToBuy()
```






### PaymentFailed

```solidity
error PaymentFailed()
```






### TokenNotAccepted

```solidity
error TokenNotAccepted()
```







