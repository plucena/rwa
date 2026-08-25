// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MpcCore.sol";

/**
 * @title DecryptionCaller — COTI Native shim
 * @dev Port-experiment stand-in for the upstream async decryption oracle, which is not
 *      published. COTI decrypts synchronously via `MpcCore.decrypt`, so a request is
 *      opened, resolved and delivered to its callback inside a single transaction.
 *      This is the B4 "drop the async apparatus" collapse, expressed as the smallest
 *      shim that satisfies the call sites in PrivateToken.
 */
abstract contract DecryptionCaller {
    uint256 internal decryptCounter;

    mapping(uint256 => bool) internal _decryptPending;

    function beginDecryptRequest(uint256[] memory) internal returns (uint256 decryptID) {
        decryptID = decryptCounter++;
        _decryptPending[decryptID] = true;
    }

    function commitDecryptRequest(
        uint256 decryptID,
        uint256[] memory handles,
        bytes4 selector
    ) internal {
        bytes[] memory output = new bytes[](handles.length);
        for (uint256 i = 0; i < handles.length; i++) {
            output[i] = abi.encode(MpcCore.decrypt(gtUint256.wrap(handles[i])));
        }
        bytes[] memory signatures = new bytes[](0);
        (bool ok, ) = address(this).call(
            abi.encodeWithSelector(selector, decryptID, output, signatures)
        );
        require(ok, "decrypt callback failed");
    }

    modifier verifyCallback(
        uint256 decryptID,
        bytes[] calldata,
        bytes[] calldata
    ) {
        require(msg.sender == address(this), "callback: bad sender");
        require(_decryptPending[decryptID], "callback: unknown request");
        _decryptPending[decryptID] = false;
        _;
    }
}
