// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/token/IPrivateToken.sol";

interface IERC20Min {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function decimals() external view returns (uint8);
}

interface IIdentityRegistryMin {
    function isVerified(address userAddress) external view returns (bool);
}

/**
 * @title RwaSubscription
 * @notice Primary-market subscription: pay a stablecoin, receive tokenised fund shares.
 *
 * @dev The token's `mint` is agent-only, so this contract must be added as an agent on the
 *      PrivateToken. Shares are minted directly to the subscriber, whose balance is encrypted
 *      from that point on.
 *
 *      PRIVACY NOTE, deliberately not hidden: USDC and USDT on COTI testnet are ordinary
 *      ERC-20s with public amounts. The payment leg of a subscription is therefore visible,
 *      and because the price is public the share count follows from it — so a subscription
 *      discloses its own size even though the resulting balance is encrypted. Confidentiality
 *      begins at the first transfer, not at the purchase. Closing this needs a confidential
 *      payment token or off-chain settlement; see coti_rwa.md.
 */
contract RwaSubscription {
    /// @dev Price is quoted in payment-token units per 1e8 shares (the token uses 8 decimals).
    uint256 private constant SHARE_UNIT = 1e8;

    address public owner;
    address public treasury;
    IPrivateToken public immutable token;

    mapping(address paymentToken => uint256) public priceOf;

    event Subscribed(
        address indexed buyer,
        address indexed paymentToken,
        uint256 paymentAmount,
        uint256 shares
    );
    event PriceSet(address indexed paymentToken, uint256 price);
    event TreasurySet(address indexed treasury);

    error NotOwner();
    error TokenNotAccepted();
    error NotVerified();
    error NothingToBuy();
    error PaymentFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _token, address _treasury) {
        owner = msg.sender;
        token = IPrivateToken(_token);
        treasury = _treasury;
    }

    function setPrice(address paymentToken, uint256 price) external onlyOwner {
        priceOf[paymentToken] = price;
        emit PriceSet(paymentToken, price);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    /// @notice Shares a given payment buys, for quoting in the UI before the user commits.
    function quote(address paymentToken, uint256 paymentAmount) public view returns (uint256) {
        uint256 price = priceOf[paymentToken];
        if (price == 0) return 0;
        return (paymentAmount * SHARE_UNIT) / price;
    }

    /**
     * @notice Subscribe: pull `paymentAmount` of `paymentToken` and mint the matching shares.
     * @dev Requires prior `approve` on the payment token, and that the buyer is verified in
     *      the fund's identity registry — the ERC-3643 eligibility check that makes this a
     *      security token rather than a free-floating one.
     */
    function subscribe(address paymentToken, uint256 paymentAmount) external returns (uint256) {
        uint256 price = priceOf[paymentToken];
        if (price == 0) revert TokenNotAccepted();

        if (!IIdentityRegistryMin(address(token.identityRegistry())).isVerified(msg.sender)) {
            revert NotVerified();
        }

        uint256 shares = (paymentAmount * SHARE_UNIT) / price;
        if (shares == 0) revert NothingToBuy();

        if (!IERC20Min(paymentToken).transferFrom(msg.sender, treasury, paymentAmount)) {
            revert PaymentFailed();
        }

        token.mint(msg.sender, shares);

        emit Subscribed(msg.sender, paymentToken, paymentAmount, shares);
        return shares;
    }
}
