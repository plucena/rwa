// SPDX-License-Identifier: GPL-3.0
//
//                                             :+#####%%%%%%%%%%%%%%+
//                                         .-*@@@%+.:+%@@@@@%%#***%@@%=
//                                     :=*%@@@#=.      :#@@%       *@@@%=
//                       .-+*%@%*-.:+%@@@@@@+.     -*+:  .=#.       :%@@@%-
//                   :=*@@@@%%@@@@@@@@@%@@@-   .=#@@@%@%=             =@@@@#.
//             -=+#%@@%#*=:.  :%@@@@%.   -*@@#*@@@@@@@#=:-              *@@@@+
//            =@@%=:.     :=:   *@@@@@%#-   =%*%@@@@#+-.        =+       :%@@@%-
//           -@@%.     .+@@@     =+=-.         @@#-           +@@@%-       =@@@@%:
//          :@@@.    .+@@#%:                   :    .=*=-::.-%@@@+*@@=       +@@@@#.
//          %@@:    +@%%*                         =%@@@@@@@@@@@#.  .*@%-       +@@@@*.
//         #@@=                                .+@@@@%:=*@@@@@-      :%@%:      .*@@@@+
//        *@@*                                +@@@#-@@%-:%@@*          +@@#.      :%@@@@-
//       -@@%           .:-=++*##%%%@@@@@@@@@@@@*. :@+.@@@%:            .#@@+       =@@@@#:
//      .@@@*-+*#%%%@@@@@@@@@@@@@@@@%%#**@@%@@@.   *@=*@@#                :#@%=      .#@@@@#-
//      -%@@@@@@@@@@@@@@@*+==-:-@@@=    *@# .#@*-=*@@@@%=                 -%@@@*       =@@@@@%-
//         -+%@@@#.   %@%%=   -@@:+@: -@@*    *@@*-::                   -%@@%=.         .*@@@@@#
//            *@@@*  +@* *@@##@@-  #@*@@+    -@@=          .         :+@@@#:           .-+@@@%+-
//             +@@@%*@@:..=@@@@*   .@@@*   .#@#.       .=+-       .=%@@@*.         :+#@@@@*=:
//              =@@@@%@@@@@@@@@@@@@@@@@@@@@@%-      :+#*.       :*@@@%=.       .=#@@@@%+:
//               .%@@=                 .....    .=#@@+.       .#@@@*:       -*%@@@@%+.
//                 +@@#+===---:::...         .=%@@*-         +@@@+.      -*@@@@@%+.
//                  -@@@@@@@@@@@@@@@@@@@@@@%@@@@=          -@@@+      -#@@@@@#=.
//                    ..:::---===+++***###%%%@@@#-       .#@@+     -*@@@@@#=.
//                                           @@@@@@+.   +@@*.   .+@@@@@%=.
//                                          -@@@@@=   =@@%:   -#@@@@%+.
//                                          +@@@@@. =@@@=  .+@@@@@*:
//                                          #@@@@#:%@@#. :*@@@@#-
//                                          @@@@@%@@@= :#@@@@+.
//                                         :@@@@@@@#.:#@@@%-
//                                         +@@@@@@-.*@@@*:
//                                         #@@@@#.=@@@+.
//                                         @@@@+-%@%=
//                                        :@@@#%@%=
//                                        +@@@@%-
//                                        :#%%=
//

/**
 *     NOTICE
 *
 *     The T-REX software is licensed under a proprietary license or the GPL v.3.
 *     If you choose to receive it under the GPL v.3 license, the following applies:
 *     T-REX is a suite of smart contracts implementing the ERC-3643 standard and
 *     developed by Tokeny to manage and transfer financial assets on EVM blockchains
 *
 *     Copyright (C) 2023, Tokeny sàrl.
 *
 *     This program is free software: you can redistribute it and/or modify
 *     it under the terms of the GNU General Public License as published by
 *     the Free Software Foundation, either version 3 of the License, or
 *     (at your option) any later version.
 *
 *     This program is distributed in the hope that it will be useful,
 *     but WITHOUT ANY WARRANTY; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *     GNU General Public License for more details.
 *
 *     You should have received a copy of the GNU General Public License
 *     along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

pragma solidity ^0.8.24;
import "../compliance/modular/IPrivateModularCompliance.sol";
import "../registry/interface/IPrivateIdentityRegistry.sol";
import "../bubble/MpcCore.sol";

contract PrivateTokenStorage {
    /**
     * @dev Three-ciphertext allowance, mirroring `IPrivateERC20.Allowance`.
     *      COTI ciphertexts have exactly one reader each, so a value both parties must read
     *      is stored once per party plus a contract copy. Written eagerly in `_approve`.
     */
    struct PrivateAllowance {
        ctUint256 ciphertext; // contract copy — the source of truth
        ctUint256 ownerCiphertext;
        ctUint256 spenderCiphertext;
    }

    /**
     * @dev ERC20 basic variables.
     *      Balances are `utUint256` = { contract copy, holder copy }, written eagerly via
     *      `MpcCore.offBoardCombined`. The contract copy is authoritative and is what
     *      `_balanceGt` onboards; the holder copy is what the holder decrypts off-chain.
     */
    mapping(address => utUint256) internal _balances;
    mapping(address => mapping(address => PrivateAllowance)) internal _allowances;
    uint256 internal _totalSupply;

    /// @dev Token information
    string internal _tokenName;
    string internal _tokenSymbol;
    uint8 internal _tokenDecimals;
    address internal _tokenOnchainID;
    string internal constant _TOKEN_VERSION = "0.0.1";

    /// @dev Variables of freeze and pause functions
    mapping(address => bool) internal _frozen;

    /**
     * @dev Partially-frozen balance: eager for the holder, on-demand for agents.
     *      The agent set is a role and therefore unbounded, so agents cannot have an eager
     *      slot; they call `reencryptFrozenTokens` and read their copy from
     *      `_frozenTokensForReader`. See the B2 design note in the workplan.
     */
    mapping(address => utUint256) internal _frozenTokens;

    /// @dev reader => holder => that reader's copy of the holder's frozen amount.
    mapping(address => mapping(address => ctUint256)) internal _frozenTokensForReader;

    /// @dev Where a party's ciphertexts are encrypted to. Zero means "no AES key" (contracts).
    mapping(address => address) internal _accountEncryptionAddress;

    bool internal _tokenPaused = false;

    /// @dev Identity Registry contract used by the onchain validator system
    IPrivateIdentityRegistry internal _tokenIdentityRegistry;

    /// @dev Compliance contract linked to the onchain validator system
    IPrivateModularCompliance internal _tokenCompliance;

    /**
     * @dev Canonical encrypted zero.
     *      Under the upstream model this was a long-lived `gtUint256` handle held in storage. COTI
     *      `gt` values are transient within a transaction, so it is minted per call by
     *      `_zero()` instead. The slot is retained to preserve the storage layout.
     */
    uint256 internal _mpcZeroBalanceHandleDeprecated;

    /// @dev Pending burn finalization requests (decryptID => user).
    mapping(uint256 => address) internal _burnRequests;
    /// @dev Pending mint finalization requests (decryptID => user).
    mapping(uint256 => address) internal _mintRequests;

    /// @dev Pending batch burn: users for a single decrypt request (multi-handle callback).
    mapping(uint256 => address[]) internal _batchBurnUsers;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     */
    /// @dev Reduced from 45: `_frozenTokensForReader` and `_accountEncryptionAddress` took two slots.
    uint256[43] private __gap;
}
