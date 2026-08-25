// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IPrivateIdentity.sol";

interface IPrivateIdentityRegistry {
    function isVerified(address _userAddress) external view returns (bool);
    function registerIdentity(address _userAddress, IPrivateIdentity _identity, uint16 _country) external;
    function deleteIdentity(address _userAddress) external;
    function investorCountry(address _userAddress) external view returns (uint16);
}
