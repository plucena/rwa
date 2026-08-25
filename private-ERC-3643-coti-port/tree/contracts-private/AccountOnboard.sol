// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/bubble/MpcCore.sol";

/**
 * @title AccountOnboard
 * @dev Verbatim from coti-io/coti-contracts (`contracts/onboard/AccountOnboard.sol`), with the
 *      import repointed at this tree's vendored MpcCore. Deployed by the test fixture so each
 *      signer can obtain its own AES key.
 *
 *      Why it is needed: an encrypted input must be encrypted under the *sender's* key.
 *      `setAccountEncryptionAddress` redirects outputs only, so multi-party tests cannot be
 *      driven from a single key without silently passing for the wrong reason.
 */
contract AccountOnboard {
    event AccountOnboarded(address indexed _from, bytes userKey1, bytes userKey2);

    function onboardAccount(bytes calldata publicKey, bytes calldata signedEK) public {
        (bytes memory accountKey1, bytes memory accountKey2) = MpcCore.getUserKey(publicKey, signedEK);
        emit AccountOnboarded(msg.sender, accountKey1, accountKey2);
    }
}
