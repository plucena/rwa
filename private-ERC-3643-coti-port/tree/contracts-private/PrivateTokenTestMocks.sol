// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/bubble/MpcCore.sol";
import "../contracts/registry/interface/IPrivateIdentity.sol";

contract MockPrivateIdentityRegistry {
    mapping(address => bool) public verified;
    mapping(address => IPrivateIdentity) public identities;
    mapping(address => uint16) public countries;

    function isVerified(address _userAddress) external view returns (bool) {
        return verified[_userAddress];
    }

    function registerIdentity(address _userAddress, IPrivateIdentity _identity, uint16 _country) external {
        identities[_userAddress] = _identity;
        countries[_userAddress] = _country;
        verified[_userAddress] = true;
    }

    function deleteIdentity(address _userAddress) external {
        delete identities[_userAddress];
        delete countries[_userAddress];
        verified[_userAddress] = false;
    }

    function investorCountry(address _userAddress) external view returns (uint16) {
        return countries[_userAddress];
    }

    function setInvestorCountry(address _userAddress, uint16 _country) external {
        countries[_userAddress] = _country;
    }

    function setVerified(address _userAddress, bool _isVerified) external {
        verified[_userAddress] = _isVerified;
    }
}

contract MockPrivateIdentity is IPrivateIdentity {
    mapping(bytes32 => mapping(uint256 => bool)) public keyPurposes;

    function setKeyPurpose(bytes32 _key, uint256 _purpose, bool _allowed) external {
        keyPurposes[_key][_purpose] = _allowed;
    }

    function keyHasPurpose(bytes32 _key, uint256 _purpose) external view override returns (bool) {
        return keyPurposes[_key][_purpose];
    }
}

contract MockPrivateCompliance {
    function bindToken(address) external pure {}

    function unbindToken(address) external pure {}

    function canTransfer(address, address, gtUint256) external returns (gtBool) {
        // Match ERC-3643 semantics: true means allowed.
        gtBool ok = MpcCore.setPublic(true);
        // GCHandler permits this handle to the compliance contract; the token (msg.sender) must use it in Mux on the same tx.
        return ok;
    }

    function transferred(address, address, gtUint256) external {}

    function created(address, uint256) external {}

    function destroyed(address, uint256) external {}
}

contract MockPrivateComplianceFalse {
    function bindToken(address) external pure {}

    function unbindToken(address) external pure {}

    function canTransfer(address, address, gtUint256) external returns (gtBool) {
        // Match ERC-3643 semantics: false means blocked.
        gtBool ok = MpcCore.setPublic(false);
        return ok;
    }

    function transferred(address, address, gtUint256) external {}

    function created(address, uint256) external {}

    function destroyed(address, uint256) external {}
}
