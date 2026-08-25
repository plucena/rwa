// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IPrivateIdentity {
    function keyHasPurpose(bytes32 _key, uint256 _purpose) external view returns (bool);
}
