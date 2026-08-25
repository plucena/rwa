// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/bubble/MpcCore.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Test-only private compliance that enforces per-user max balance.
contract MaxBalancePrivateCompliance is Ownable {
    address public tokenBound;

    mapping(address => uint256) public maxBalance;
    /// @dev B2: a shadow ledger only this contract reads, so it needs the contract copy alone.
    mapping(address => ctUint256) internal _trackedBalancePrivate;

    event TokenBound(address indexed token);
    event TokenUnbound(address indexed token);

    constructor() {}

    /// @dev A fresh encrypted zero; COTI `gt` values do not survive the transaction.
    function _zero() internal returns (gtUint256) {
        return MpcCore.setPublic256(uint256(0));
    }

    function _writeTracked(address user, gtUint256 value) internal {
        _trackedBalancePrivate[user] = MpcCore.offBoard(value);
    }

    modifier onlyToken() {
        require(msg.sender == tokenBound, "only bound token");
        _;
    }

    function bindToken(address _token) external {
        require(owner() == msg.sender || (tokenBound == address(0) && msg.sender == _token), "only owner or token can call");
        require(_token != address(0), "invalid argument - zero address");
        tokenBound = _token;
        emit TokenBound(_token);
    }

    function unbindToken(address _token) external {
        require(owner() == msg.sender || msg.sender == _token, "only owner or token can call");
        require(_token == tokenBound, "This token is not bound");
        require(_token != address(0), "invalid argument - zero address");
        tokenBound = address(0);
        emit TokenUnbound(_token);
    }

    function setMaxBalance(address _user, uint256 _maxBalance) external onlyOwner {
        maxBalance[_user] = _maxBalance;
    }

    function transferred(address _from, address _to, gtUint256 _amount) external onlyToken {
        (gtBool fromOverflowBit, gtUint256 fromCandidate) = MpcCore.checkedSubWithOverflowBit(_trackedBalanceGt(_from), _amount);
        gtUint256 newFromTracked = MpcCore.mux(fromOverflowBit, fromCandidate, _zero());
        gtUint256 newToTracked = MpcCore.add(_trackedBalanceGt(_to), _amount);

        _writeTracked(_from, newFromTracked);
        _writeTracked(_to, newToTracked);
    }

    function created(address _to, uint256 _amount) external onlyToken {
        gtUint256 current = _trackedBalanceGt(_to);
        gtUint256 amountGt = MpcCore.setPublic256(_amount);
        gtBool exceedsLimit = _exceedsLimit(_to, amountGt);
        gtUint256 candidate = MpcCore.add(current, amountGt);
        // Mint uses clear amount; if max balance is exceeded, keep tracked balance unchanged (effective mint = 0).
        gtUint256 newTracked = MpcCore.mux(exceedsLimit, candidate, current);
        _writeTracked(_to, newTracked);
    }

    function destroyed(address _from, uint256 _amount) external onlyToken {
        (gtBool fromOverflowBit, gtUint256 fromCandidate) =
            MpcCore.checkedSubWithOverflowBit(_trackedBalanceGt(_from), MpcCore.setPublic256(_amount));
        gtUint256 newFromTracked = MpcCore.mux(fromOverflowBit, fromCandidate, _zero());
        _writeTracked(_from, newFromTracked);
    }

    function canTransfer(address, address _to, gtUint256 _amount) external returns (gtBool) {
        // Match ERC-3643 semantics: true means allowed, false means blocked.
        gtBool exceedsLimit = _exceedsLimit(_to, _amount);
        // No permit needed: `gt` values already cross contracts within a transaction.
        return MpcCore.not(exceedsLimit);
    }

    function _exceedsLimit(address _to, gtUint256 _amount) internal returns (gtBool) {
        uint256 limit = maxBalance[_to];
        if (limit == 0) {
            return MpcCore.setPublic(false);
        }

        gtUint256 nextBalance = MpcCore.add(_trackedBalanceGt(_to), _amount);
        // `checkedSubWithOverflowBit(limit, nextBalance)` returns true when `nextBalance > limit`.
        (gtBool exceedsLimit, ) = MpcCore.checkedSubWithOverflowBit(MpcCore.setPublic256(limit), nextBalance);
        return exceedsLimit;
    }

    function _trackedBalanceGt(address _user) internal returns (gtUint256) {
        ctUint256 memory ct = _trackedBalancePrivate[_user];
        if (ctUint128.unwrap(ct.ciphertextHigh) == 0 && ctUint128.unwrap(ct.ciphertextLow) == 0) {
            return _zero();
        }
        return MpcCore.onBoard(ct);
    }

}
