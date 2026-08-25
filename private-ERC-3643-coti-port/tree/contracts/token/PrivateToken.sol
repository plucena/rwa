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

import "./IPrivateToken.sol";
import "./PrivateTokenStorage.sol";
import "../registry/interface/IPrivateIdentity.sol";
import "../roles/private/AgentRoleUpgradeable.sol";
import "../bubble/DecryptionCaller.sol";

contract PrivateToken is IPrivateToken, AgentRoleUpgradeable, PrivateTokenStorage, DecryptionCaller {

    /// @notice Hard cap on `batchBurn` row count (gas / MPC). Exposed on the ABI as `MAX_BATCH_BURN_SIZE`.
    uint256 public constant MAX_BATCH_BURN_SIZE = 100;
    /// @notice Generic hard cap for non-burn batch operations.
    uint256 public constant MAX_BATCH_OPERATION_SIZE = 100;

    event BurnRequested(address indexed user, uint256 requestedAmount, uint256 decryptID, gtUint256 burnedAmountHandle);
    event BurnFinalized(address indexed user, uint256 burnedAmount, uint256 decryptID);
    event MintRequested(address indexed user, uint256 requestedAmount, uint256 decryptID, gtUint256 mintedAmountHandle);
    event MintFinalized(address indexed user, uint256 mintedAmount, uint256 decryptID);
    /// @dev B2: emitted when an entitled reader mints its own copy of a frozen amount.
    event FrozenTokensReencrypted(address indexed reader, address indexed userAddress);
    event AccountEncryptionAddressSet(address indexed account, address indexed offBoardAddress);

    /// modifiers

    /// @dev Modifier to make a function callable only when the contract is not paused.
    modifier whenNotPaused() {
        require(!_tokenPaused, "Pausable: paused");
        _;
    }

    /// @dev Modifier to make a function callable only when the contract is paused.
    modifier whenPaused() {
        require(_tokenPaused, "Pausable: not paused");
        _;
    }

    /**
     *  @dev the initializer initiates the token contract
     *  msg.sender is set automatically as the owner of the smart contract
     *  @param _identityRegistry the address of the Identity registry linked to the token
     *  @param _compliance the address of the compliance contract linked to the token
     *  @param _name the name of the token
     *  @param _symbol the symbol of the token
     *  @param _decimals the decimals of the token
     *  @param _onchainID the address of the onchainID of the token
     *  emits an `UpdatedTokenInformation` event
     *  emits an `IdentityRegistryAdded` event
     *  emits a `ComplianceAdded` event
     */
    function init(
        address _identityRegistry,
        address _compliance,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        // _onchainID can be zero address if not set, can be set later by owner
        address _onchainID
    ) external initializer {
        // that require is protecting legacy versions of TokenProxy contracts
        // as there was a bug with the initializer modifier on these proxies
        // that check is preventing attackers to call the init functions on those
        // legacy contracts.
        require(owner() == address(0), "already initialized");
        require(
            _identityRegistry != address(0)
            && _compliance != address(0)
        , "invalid argument - zero address");
        require(
            bytes(_name).length != 0
            && bytes(_symbol).length != 0
        , "invalid argument - empty string");
        require(_decimals <= 18, "decimals between 0 and 18");
        __Ownable_init();
        _tokenName = _name;
        _tokenSymbol = _symbol;
        _tokenDecimals = _decimals;
        _tokenOnchainID = _onchainID;
        _tokenPaused = true;
        setIdentityRegistry(_identityRegistry);
        setCompliance(_compliance);
        emit UpdatedTokenInformation(_tokenName, _tokenSymbol, _tokenDecimals, _TOKEN_VERSION, _tokenOnchainID);
    }

    // ------------------------------------------------------------------
    //  B2: ciphertext storage helpers — the replacement for the upstream permit ACL
    //
    //  Upstream held `gtUint256` handles in storage and granted read access afterwards with
    //  `permit`. COTI `gt` values are transient within a transaction and a ciphertext has
    //  exactly one reader, fixed at write time. So every value is onboarded on read and
    //  offboarded on write, and "who may read it" is decided here rather than granted later.
    // ------------------------------------------------------------------

    /// @dev A fresh encrypted zero. Cheaper than a storage slot and always valid this transaction.
    function _zero() internal returns (gtUint256) {
        return MpcCore.setPublic256(uint256(0));
    }

    /// @dev An unset `ctUint256`, for slots that carry no reader copy.
    function _emptyCt() internal pure returns (ctUint256 memory) {
        return ctUint256({ciphertextHigh: ctUint128.wrap(0), ciphertextLow: ctUint128.wrap(0)});
    }

    /// @dev True when a ciphertext slot has never been written.
    function _isUnset(ctUint256 memory ct) internal pure returns (bool) {
        return ctUint128.unwrap(ct.ciphertextHigh) == 0 && ctUint128.unwrap(ct.ciphertextLow) == 0;
    }

    /// @dev Onboard a stored ciphertext, treating an unwritten slot as zero.
    function _onBoardOrZero(ctUint256 memory ct) internal returns (gtUint256) {
        if (_isUnset(ct)) {
            return _zero();
        }
        return MpcCore.onBoard(ct);
    }

    /**
     * @dev Where `account`'s ciphertexts are encrypted to. Defaults to the account itself.
     *      Returns zero for contracts, which hold no AES key — the signal `offBoardToUser`
     *      uses to skip user encryption, matching `PrivateERC20._getAccountEncryptionAddress`.
     */
    function _encryptionAddressOf(address account) internal view returns (address) {
        if (account == address(0)) return address(0);
        address configured = _accountEncryptionAddress[account];
        if (configured != address(0)) return configured;
        if (account.code.length > 0) return address(0);
        return account;
    }

    /// @dev Offboard to a party, or an empty ciphertext when that party holds no key.
    function _offBoardTo(gtUint256 value, address account) internal returns (ctUint256 memory) {
        address key = _encryptionAddressOf(account);
        if (key == address(0)) return _emptyCt();
        return MpcCore.offBoardToUser(value, key);
    }

    /// @dev Read the authoritative balance.
    function _balanceGt(address account) internal returns (gtUint256) {
        return _onBoardOrZero(_balances[account].ciphertext);
    }

    /// @dev Write a balance eagerly: contract copy plus the holder's copy. Replaces 2 permits.
    function _writeBalance(address account, gtUint256 value) internal {
        _balances[account].ciphertext = MpcCore.offBoard(value);
        _balances[account].userCiphertext = _offBoardTo(value, account);
    }

    /// @dev Read the authoritative allowance.
    function _allowanceGt(address owner, address spender) internal returns (gtUint256) {
        return _onBoardOrZero(_allowances[owner][spender].ciphertext);
    }

    /// @dev Write an allowance eagerly for both parties. Replaces 3 permits.
    function _writeAllowance(address owner, address spender, gtUint256 value) internal {
        PrivateAllowance storage slot = _allowances[owner][spender];
        slot.ciphertext = MpcCore.offBoard(value);
        slot.ownerCiphertext = _offBoardTo(value, owner);
        slot.spenderCiphertext = _offBoardTo(value, spender);
    }

    /**
     * @notice Re-encrypt a holder's frozen amount to the caller's key.
     * @dev The on-demand half of the B2 design. Agents are a role and therefore an unbounded
     *      reader set, so they get no eager slot; an entitled caller mints its own copy here.
     *      Entitlement is enforced in Solidity — this `require` is the access control that
     *      the upstream MPC-layer `permit` used to provide.
     *
     *      Note the trade this makes: calling it is a transaction, so it records on-chain that
     *      the caller read this holder's record. That metadata cost is why the holder, sender,
     *      receiver, owner and spender copies are written eagerly instead.
     */
    function reencryptFrozenTokens(address _userAddress) external returns (ctUint256 memory) {
        require(msg.sender == _userAddress || isAgent(msg.sender), "not entitled to this value");
        require(_userAddress != address(0), "invalid argument - zero address");

        gtUint256 value = _frozenGt(_userAddress);
        ctUint256 memory reader = _offBoardTo(value, msg.sender);
        _frozenTokensForReader[msg.sender][_userAddress] = reader;
        emit FrozenTokensReencrypted(msg.sender, _userAddress);
        return reader;
    }

    /// @notice The caller's copy of a holder's frozen amount, as last re-encrypted.
    function frozenTokensFor(address _reader, address _userAddress) external view returns (ctUint256 memory) {
        return _frozenTokensForReader[_reader][_userAddress];
    }

    /**
     * @notice Point the caller's ciphertexts at a different key.
     * @dev The repair path, mirroring `PrivateERC20.setAccountEncryptionAddress`: rotating a key
     *      would otherwise strand every copy already written to the old one. Balance and frozen
     *      copies are rebuilt here; allowances are rebuilt by the counterparty-specific flow.
     */
    function setAccountEncryptionAddress(address _offBoardAddress) external returns (bool) {
        require(_offBoardAddress != address(0), "invalid argument - zero address");

        // Compute first, then write, so a precompile failure cannot leave the recorded key and
        // the stored ciphertexts disagreeing.
        ctUint256 memory newBalance = MpcCore.offBoardToUser(_balanceGt(msg.sender), _offBoardAddress);
        ctUint256 memory newFrozen = MpcCore.offBoardToUser(_frozenGt(msg.sender), _offBoardAddress);

        _accountEncryptionAddress[msg.sender] = _offBoardAddress;
        _balances[msg.sender].userCiphertext = newBalance;
        _frozenTokens[msg.sender].userCiphertext = newFrozen;

        emit AccountEncryptionAddressSet(msg.sender, _offBoardAddress);
        return true;
    }

    /// @dev Read the authoritative frozen amount.
    function _frozenGt(address account) internal returns (gtUint256) {
        return _onBoardOrZero(_frozenTokens[account].ciphertext);
    }

    /**
     * @dev Write a frozen amount: eager for the holder, on-demand for agents.
     *      Agents are a role rather than a fixed party, so they cannot have an eager slot;
     *      they call {reencryptFrozenTokens}. Replaces 3 permits.
     */
    function _writeFrozen(address account, gtUint256 value) internal {
        _frozenTokens[account].ciphertext = MpcCore.offBoard(value);
        _frozenTokens[account].userCiphertext = _offBoardTo(value, account);
    }

    /**
     *  @dev See {IERC20-approve}.
     */
    function approve(address _spender, itUint256 calldata _it) external virtual returns (bool) {
        gtUint256 _amount = MpcCore.validateCiphertext(_it);
        _approve(msg.sender, _spender, _amount);
        return true;
    }

    /**
     *  @dev See {ERC20-increaseAllowance}.
     */
    function increaseAllowance(address _spender, itUint256 calldata _it) external virtual returns (bool) {
        gtUint256 _addedValue = MpcCore.validateCiphertext(_it);
        _approve(msg.sender, _spender, MpcCore.add(_allowanceGt(msg.sender, _spender), _addedValue));
        return true;
    }

    /**
     *  @dev See {ERC20-decreaseAllowance}.
     */
    function decreaseAllowance(address _spender, itUint256 calldata _it) external virtual returns (bool) {
        gtUint256 _subtractedValue = MpcCore.validateCiphertext(_it);
        _approve(msg.sender, _spender, MpcCore.sub(_allowanceGt(msg.sender, _spender), _subtractedValue));
        return true;
    }

    /**
     *  @dev See {IToken-setName}.
     */
    function setName(string calldata _name) external override onlyOwner {
        require(bytes(_name).length != 0, "invalid argument - empty string");
        _tokenName = _name;
        emit UpdatedTokenInformation(_tokenName, _tokenSymbol, _tokenDecimals, _TOKEN_VERSION, _tokenOnchainID);
    }

    /**
     *  @dev See {IToken-setSymbol}.
     */
    function setSymbol(string calldata _symbol) external override onlyOwner {
        require(bytes(_symbol).length != 0, "invalid argument - empty string");
        _tokenSymbol = _symbol;
        emit UpdatedTokenInformation(_tokenName, _tokenSymbol, _tokenDecimals, _TOKEN_VERSION, _tokenOnchainID);
    }

    /**
     *  @dev See {IToken-setOnchainID}.
     *  if _onchainID is set at zero address it means no ONCHAINID is bound to this token
     */
    function setOnchainID(address _onchainID) external override onlyOwner {
        _tokenOnchainID = _onchainID;
        emit UpdatedTokenInformation(_tokenName, _tokenSymbol, _tokenDecimals, _TOKEN_VERSION, _tokenOnchainID);
    }

    /**
     *  @dev See {IToken-pause}.
     */
    function pause() external override onlyAgent whenNotPaused {
        _tokenPaused = true;
        emit Paused(msg.sender);
    }

    /**
     *  @dev See {IToken-unpause}.
     */
    function unpause() external override onlyAgent whenPaused {
        _tokenPaused = false;
        emit Unpaused(msg.sender);
    }

    /**
     *  @dev See {IToken-batchTransfer}.
     */
    function batchTransfer(address[] calldata _toList, itUint256[] calldata _its) external override whenNotPaused {
        require(_toList.length == _its.length, "invalid batch");
        require(_toList.length <= MAX_BATCH_OPERATION_SIZE, "batch exceeds MAX_BATCH_OPERATION_SIZE");
        require(!_frozen[msg.sender], "wallet is frozen");

        for (uint256 i = 0; i < _toList.length; i++) {
            require(!_frozen[_toList[i]], "wallet is frozen");
            gtUint256 amount = MpcCore.validateCiphertext(_its[i]);
            gtBool transferAllowed = _evaluateTransferPolicy(msg.sender, _toList[i], amount);
            (gtUint256 transferredAmount, ) = _transfer(msg.sender, _toList[i], amount, transferAllowed);
            _tokenCompliance.transferred(msg.sender, _toList[i], transferredAmount);
        }
    }

    /**
     *  @notice ERC-20 overridden function that include logic to check for trade validity.
     *  Require that the from and to addresses are not frozen.
     *  Require that the value should not exceed available balance .
     *  Require that the to address is a verified address
     *  @param _from The address of the sender
     *  @param _to The address of the receiver
     *  @param _it Ciphertext payload for amount to transfer
     *  @return `true` if successful and revert if unsuccessful
     */
    function transferFrom(
        address _from,
        address _to,
        itUint256 calldata _it
    ) external whenNotPaused returns (gtBool) {
        require(!_frozen[_to] && !_frozen[_from], "wallet is frozen");

        gtUint256 privateAmount = MpcCore.validateCiphertext(_it);
        gtUint256 currentAllowance = _allowanceGt(_from, msg.sender);
        (gtBool allowanceOverflowBit, gtUint256 newAllowanceCandidate) = MpcCore.checkedSubWithOverflowBit(currentAllowance, privateAmount);
        gtUint256 newAllowance;

        gtBool transferPolicyAllowed = _evaluateTransferPolicy(_from, _to, privateAmount);
        // `checkedSubWithOverflowBit` returns true on underflow, so invert it into an explicit
        // "allowance sufficient" flag for the non-reverting transfer flow.
        gtBool allowanceSufficient = MpcCore.mux(allowanceOverflowBit, MpcCore.setPublic(true), MpcCore.setPublic(false));
        gtBool transferAllowed = MpcCore.and(transferPolicyAllowed, allowanceSufficient);
        // Non-reverting privacy behavior:
        // - if policy/allowance blocks the transfer, effective transfer amount becomes 0 (no revert),
        // - allowance is kept unchanged for blocked attempts,
        // - successful attempts consume allowance via `newAllowanceCandidate`.
        newAllowance = MpcCore.mux(transferAllowed, currentAllowance, newAllowanceCandidate);
        _writeAllowance(_from, msg.sender, newAllowance);

        (gtUint256 transferredAmount, gtBool transferResult) = _transfer(_from, _to, privateAmount, transferAllowed);
        _tokenCompliance.transferred(_from, _to, transferredAmount);
        emit Approval(
            _from,
            msg.sender,
            _allowances[_from][msg.sender].ownerCiphertext,
            _allowances[_from][msg.sender].spenderCiphertext
        );

        return MpcCore.and(transferAllowed, transferResult);
    }

    /**
     *  @dev See {IToken-batchForcedTransfer}.
     */
    function batchForcedTransfer(
        address[] calldata _fromList,
        address[] calldata _toList,
        gtUint256[] calldata _amounts
    ) external override {
        require(_fromList.length == _toList.length, "invalid batch");
        require(_fromList.length == _amounts.length, "invalid batch");
        require(_fromList.length <= MAX_BATCH_OPERATION_SIZE, "batch exceeds MAX_BATCH_OPERATION_SIZE");
        for (uint256 i = 0; i < _fromList.length; i++) {
            forcedTransfer(_fromList[i], _toList[i], _amounts[i]);
        }
    }

    /**
     *  @dev See {IToken-batchMint}.
     */
    function batchMint(address[] calldata _toList, uint256[] calldata _amounts) external override {
        require(_toList.length == _amounts.length, "invalid batch");
        require(_toList.length <= MAX_BATCH_OPERATION_SIZE, "batch exceeds MAX_BATCH_OPERATION_SIZE");
        for (uint256 i = 0; i < _toList.length; i++) {
            mint(_toList[i], _amounts[i]);
        }
    }

    /**
     *  @notice Batch burn with one MPC decrypt request and one `callbackBurn` (N handles → N plaintext outputs).
     *  @dev See `docs/BatchBurnOperations.md` for caps, requested vs effective amounts, duplicate rows, and stuck ids.
     *  @dev Sum of `_amounts` must not exceed `totalSupply` (clear); per-row effective burn follows `_burn` (may be zero).
     */
    function batchBurn(address[] calldata _userAddresses, uint256[] calldata _amounts) external override onlyAgent {
        uint256 n = _userAddresses.length;
        require(n == _amounts.length, "invalid batch");
        require(n > 0, "invalid batch");
        require(n <= MAX_BATCH_BURN_SIZE, "batch burn exceeds MAX_BATCH_BURN_SIZE");

        uint256 sumAmounts = 0;
        for (uint256 i = 0; i < n; i++) {
            sumAmounts += _amounts[i];
        }
        require(_totalSupply >= sumAmounts, "ERC20: burn amount exceeds total supply");

        uint256[] memory handles = new uint256[](n);
        gtUint256[] memory burnedAmounts = new gtUint256[](n);
        for (uint256 i = 0; i < n; i++) {
            require(_userAddresses[i] != address(0), "ERC20: burn from the zero address");
            _prepareBurnUnfreeze(_userAddresses[i], _amounts[i]);
            gtUint256 burnedAmount = _burn(_userAddresses[i], _amounts[i]);
            // DecryptionCaller expects raw handle IDs (uint256), not plaintext amounts.
            handles[i] = gtUint256.unwrap(burnedAmount);
            burnedAmounts[i] = burnedAmount;
        }

        uint256 decryptID = beginDecryptRequest(handles);
        for (uint256 i = 0; i < n; i++) {
            _batchBurnUsers[decryptID].push(_userAddresses[i]);
        }
        commitDecryptRequest(decryptID, handles, this.callbackBurn.selector);

        for (uint256 i = 0; i < n; i++) {
            emit BurnRequested(_userAddresses[i], _amounts[i], decryptID, burnedAmounts[i]);
        }
    }

    /**
     *  @dev See {IToken-batchSetAddressFrozen}.
     */
    function batchSetAddressFrozen(address[] calldata _userAddresses, bool[] calldata _freeze) external override {
        require(_userAddresses.length == _freeze.length, "invalid batch");
        require(_userAddresses.length <= MAX_BATCH_OPERATION_SIZE, "batch exceeds MAX_BATCH_OPERATION_SIZE");
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            setAddressFrozen(_userAddresses[i], _freeze[i]);
        }
    }

    /**
     *  @dev See {IToken-batchFreezePartialTokens}.
     */
    function batchFreezePartialTokens(address[] calldata _userAddresses, gtUint256[] calldata _amounts)
        external
        override
        onlyAgent
    {
        require(_userAddresses.length == _amounts.length, "invalid batch");
        require(_userAddresses.length <= MAX_BATCH_OPERATION_SIZE, "batch exceeds MAX_BATCH_OPERATION_SIZE");
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            _freezePartialTokensGt(_userAddresses[i], _amounts[i]);
        }
    }

    /**
     *  @dev See {IToken-batchUnfreezePartialTokens}.
     */
    function batchUnfreezePartialTokens(address[] calldata _userAddresses, gtUint256[] calldata _amounts)
        external
        override
        onlyAgent
    {
        require(_userAddresses.length == _amounts.length, "invalid batch");
        require(_userAddresses.length <= MAX_BATCH_OPERATION_SIZE, "batch exceeds MAX_BATCH_OPERATION_SIZE");
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            _unfreezePartialTokensGt(_userAddresses[i], _amounts[i]);
        }
    }

    /**
     *  @dev See {IToken-recoveryAddress}.
     */
    function recoveryAddress(
        address _lostWallet,
        address _newWallet,
        address _investorOnchainID
    ) external override onlyAgent returns (bool) {
        // B2: upstream compared the stored handle against its canonical zero handle — a pointer
        // comparison that only worked because that handle was a stable storage value. COTI `gt`
        // values are transient, so two fresh handles are always unequal and that test would
        // always pass. The equivalent check is whether the slot was ever written; a true
        // "balance is non-zero" test is not available without decrypting.
        require(!_isUnset(_balances[_lostWallet].ciphertext), "no tokens to recover");

        IPrivateIdentity _onchainID = IPrivateIdentity(_investorOnchainID);
        bytes32 _key = keccak256(abi.encode(_newWallet));
        if (_onchainID.keyHasPurpose(_key, 1)) {
            gtUint256 investorTokens = _balanceGt(_lostWallet);
            gtUint256 frozenTokens = _frozenGt(_lostWallet);

            _tokenIdentityRegistry.registerIdentity(
                _newWallet,
                _onchainID,
                _tokenIdentityRegistry.investorCountry(_lostWallet)
            );

            forcedTransfer(_lostWallet, _newWallet, investorTokens);
            _freezePartialTokensGt(_newWallet, frozenTokens);

            if (_frozen[_lostWallet]) {
                setAddressFrozen(_newWallet, true);
            }

            _tokenIdentityRegistry.deleteIdentity(_lostWallet);
            emit RecoverySuccess(_lostWallet, _newWallet, _investorOnchainID);
            return true;
        }
        revert("Recovery not possible");
    }

    /**
     *  @dev See {IERC20-totalSupply}.
     */
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    /**
     *  @dev See {IERC20-allowance}.
     */
    function allowance(address _owner, address _spender) external view virtual returns (ctUint256 memory) {
        // B2: one ciphertext, one reader — hand back the copy belonging to the caller.
        if (msg.sender == _spender) return _allowances[_owner][_spender].spenderCiphertext;
        return _allowances[_owner][_spender].ownerCiphertext;
    }

    /**
     *  @dev See {IToken-identityRegistry}.
     */
    function identityRegistry() external view override returns (IPrivateIdentityRegistry) {
        return _tokenIdentityRegistry;
    }

    /**
     *  @dev See {IToken-compliance}.
     */
    function compliance() external view override returns (IPrivateModularCompliance) {
        return _tokenCompliance;
    }

    /**
     *  @dev See {IToken-paused}.
     */
    function paused() external view override returns (bool) {
        return _tokenPaused;
    }

    /**
     *  @dev See {IToken-isFrozen}.
     */
    function isFrozen(address _userAddress) external view override returns (bool) {
        return _frozen[_userAddress];
    }

    /**
     *  @dev See {IToken-getFrozenTokens}.
     */
    function getFrozenTokens(address _userAddress) external view returns (ctUint256 memory) {
        // Holders read their eager copy; agents call {reencryptFrozenTokens} then {frozenTokensFor}.
        return _frozenTokens[_userAddress].userCiphertext;
    }

    /**
     *  @dev See {IToken-decimals}.
     */
    function decimals() external view override returns (uint8) {
        return _tokenDecimals;
    }

    /**
     *  @dev See {IToken-name}.
     */
    function name() external view override returns (string memory) {
        return _tokenName;
    }

    /**
     *  @dev See {IToken-onchainID}.
     */
    function onchainID() external view override returns (address) {
        return _tokenOnchainID;
    }

    /**
     *  @dev See {IToken-symbol}.
     */
    function symbol() external view override returns (string memory) {
        return _tokenSymbol;
    }

    /**
     *  @dev See {IToken-version}.
     */
    function version() external pure override returns (string memory) {
        return _TOKEN_VERSION;
    }

    /**
     *  @notice Private transfer using ciphertext input.
     *  If policy checks fail, the transfer resolves to 0 amount instead of reverting.
     *  @param _to The address of the receiver
     *  @param _it Ciphertext payload for transfer amount
     *  @return encrypted transfer result, combined with policy checks
     */
    function transfer(address _to, itUint256 calldata _it) external whenNotPaused returns (gtBool) {
        gtUint256 _amount = MpcCore.validateCiphertext(_it);
        // The onboarded amount handle is initially permitted to this token contract.
        // Grant transient access to the caller so sender-side permission checks pass.
        require(!_frozen[_to] && !_frozen[msg.sender], "wallet is frozen");
        gtBool transferAllowed = _evaluateTransferPolicy(msg.sender, _to, _amount);

        (gtUint256 transferredAmount, gtBool transferResult) = _transfer(msg.sender, _to, _amount, transferAllowed);
        _tokenCompliance.transferred(msg.sender, _to, transferredAmount);

        return MpcCore.and(transferAllowed, transferResult);
    }

    /**
     *  @dev See {IToken-forcedTransfer}.
     */
    function forcedTransfer(
        address _from,
        address _to,
        gtUint256 _amount
    ) public override onlyAgent returns (bool) {
        require(_tokenIdentityRegistry.isVerified(_to), "Transfer not possible");

        (gtUint256 tokensToUnfreeze, gtUint256 newFrozen) = _forcedTransferUnfreeze(_from, _amount);

        _writeFrozen(_from, newFrozen);

        emit TokensUnfrozen(_from, _offBoardTo(tokensToUnfreeze, _from));

        _transfer(_from, _to, _amount, MpcCore.setPublic(true));
        _tokenCompliance.transferred(_from, _to, _amount);
        return true;
    }

    function _forcedTransferUnfreeze(address from, gtUint256 amount) internal returns (gtUint256, gtUint256) {
        gtUint256 currentFrozen = _frozenGt(from);
        (gtBool freeBalanceOverflowBit, gtUint256 freeBalanceCandidate) = MpcCore.checkedSubWithOverflowBit(_balanceGt(from), currentFrozen);
        gtUint256 freeBalance = MpcCore.mux(freeBalanceOverflowBit, freeBalanceCandidate, _zero());

        // `amount - freeBalance` overflows when no unfreeze is needed; otherwise the candidate is the delta to unfreeze.
        (gtBool noUnfreezeNeededBit, gtUint256 tokensToUnfreezeCandidate) = MpcCore.checkedSubWithOverflowBit(amount, freeBalance);
        gtUint256 tokensToUnfreeze = MpcCore.mux(noUnfreezeNeededBit, tokensToUnfreezeCandidate, _zero());
        (gtBool newFrozenOverflowBit, gtUint256 newFrozenCandidate) = MpcCore.checkedSubWithOverflowBit(currentFrozen, tokensToUnfreeze);
        gtUint256 newFrozen = MpcCore.mux(newFrozenOverflowBit, newFrozenCandidate, currentFrozen);
        return (tokensToUnfreeze, newFrozen);
    }

    function _prepareBurnUnfreeze(address user, uint256 amount) internal {
        gtUint256 privateAmount = MpcCore.setPublic256(amount);
        (gtBool burnOverflowBit, ) = MpcCore.checkedSubWithOverflowBit(_balanceGt(user), privateAmount);
        gtUint256 effectiveBurn = MpcCore.mux(burnOverflowBit, privateAmount, _zero());
        (gtUint256 tokensToUnfreeze, gtUint256 newFrozen) = _forcedTransferUnfreeze(user, effectiveBurn);

        _writeFrozen(user, newFrozen);
        emit TokensUnfrozen(user, _offBoardTo(tokensToUnfreeze, user));
    }

    /**
     *  @dev See {IToken-mint}.
     */
    function mint(address _to, uint256 _amount) public override onlyAgent {
        require(_tokenIdentityRegistry.isVerified(_to), "Identity is not verified.");
        gtUint256 privateAmount = MpcCore.setPublic256(_amount);
        gtBool transferAllowed = _tokenCompliance.canTransfer(address(0), _to, privateAmount);
        gtUint256 minted = MpcCore.mux(transferAllowed, _zero(), privateAmount);
        _beforeTokenTransfer(address(0), _to, minted);
        _writeBalance(_to, MpcCore.add(_balanceGt(_to), minted));
        emit Transfer(address(0), _to, _emptyCt(), _offBoardTo(minted, _to));

        uint256[] memory handles = new uint256[](1);
        // DecryptionCaller expects raw handle IDs (uint256), not plaintext amounts.
        handles[0] = gtUint256.unwrap(minted);

        uint256 decryptID = beginDecryptRequest(handles);
        _mintRequests[decryptID] = _to;
        commitDecryptRequest(decryptID, handles, this.callbackMint.selector);

        emit MintRequested(_to, _amount, decryptID, minted);
    }

    /**
     *  @notice Request a burn: private balance is updated immediately; `totalSupply` and compliance `destroyed` run in `callbackBurn`.
     *  @dev The clear `_amount` is the requested burn. The encrypted burn applied in `_burn` may be zero if the holder’s
     *  private balance is insufficient (same semantics as batch rows). See `docs/BatchBurnOperations.md`.
     */
    function burn(address _userAddress, uint256 _amount) public override onlyAgent {
        require(_userAddress != address(0), "ERC20: burn from the zero address");
        require(_totalSupply >= _amount, "ERC20: burn amount exceeds total supply");

        _prepareBurnUnfreeze(_userAddress, _amount);
        gtUint256 burnedAmount = _burn(_userAddress, _amount);

        uint256[] memory handles = new uint256[](1);
        // DecryptionCaller expects raw handle IDs (uint256), not plaintext amounts.
        handles[0] = gtUint256.unwrap(burnedAmount);

        uint256 decryptID = beginDecryptRequest(handles);
        _burnRequests[decryptID] = _userAddress;
        commitDecryptRequest(decryptID, handles, this.callbackBurn.selector);

        emit BurnRequested(_userAddress, _amount, decryptID, burnedAmount);
    }

    /// @notice Last created decrypt request id (for off-chain relayers/tests).
    function getLastDecryptRequestId() external view returns (uint256) {
        return decryptCounter > 0 ? decryptCounter - 1 : 0;
    }

    /// @inheritdoc IPrivateToken
    function isBurnDecryptPending(uint256 decryptID) external view override returns (bool) {
        if (_burnRequests[decryptID] != address(0)) {
            return true;
        }
        return _batchBurnUsers[decryptID].length > 0;
    }

    /// @notice Returns whether a single-mint decrypt callback is still pending for `decryptID`.
    function isMintDecryptPending(uint256 decryptID) external view returns (bool) {
        return _mintRequests[decryptID] != address(0);
    }

    /// @inheritdoc IPrivateToken
    function getPendingBatchBurnUsers(uint256 decryptID) external view override returns (address[] memory users) {
        address[] storage stored = _batchBurnUsers[decryptID];
        uint256 len = stored.length;
        users = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            users[i] = stored[i];
        }
    }

    /// @inheritdoc IPrivateToken
    function getPendingSingleBurnUser(uint256 decryptID) external view override returns (address) {
        return _burnRequests[decryptID];
    }

    /**
     *  @notice MPC callback: finalizes clear `totalSupply` and compliance from verified decrypted mint amounts.
     */
    function callbackMint(
        uint256 decryptID,
        bytes[] calldata output,
        bytes[] calldata signatures
    ) external verifyCallback(decryptID, output, signatures) {
        address requestUser = _mintRequests[decryptID];
        require(requestUser != address(0), "Invalid request ID");

        uint256 mintedAmount = abi.decode(output[0], (uint256));
        if (mintedAmount > 0) {
            _totalSupply += mintedAmount;
            _tokenCompliance.created(requestUser, mintedAmount);
        }

        delete _mintRequests[decryptID];
        emit MintFinalized(requestUser, mintedAmount, decryptID);
    }

    /**
     *  @notice MPC callback: finalizes clear `totalSupply` and compliance from verified decrypted burn amounts.
     *  @dev Dispatches on pending metadata at `decryptID` (single `_burnRequests` vs batch `_batchBurnUsers`).
     */
    function callbackBurn(
        uint256 decryptID,
        bytes[] calldata output,
        bytes[] calldata signatures
    ) external verifyCallback(decryptID, output, signatures) {
        address requestUser = _burnRequests[decryptID];
        if (requestUser != address(0)) {
            uint256 burnedAmount = abi.decode(output[0], (uint256));
            if (burnedAmount > 0) {
                require(_totalSupply >= burnedAmount, "ERC20: burn amount exceeds total supply");
                _totalSupply -= burnedAmount;
                _tokenCompliance.destroyed(requestUser, burnedAmount);
            }
            delete _burnRequests[decryptID];
            emit BurnFinalized(requestUser, burnedAmount, decryptID);
            return;
        }

        address[] storage batchUsers = _batchBurnUsers[decryptID];
        require(batchUsers.length > 0, "Invalid request ID");
        require(batchUsers.length == output.length, "Invalid batch burn output");
        for (uint256 i = 0; i < batchUsers.length; i++) {
            uint256 amt = abi.decode(output[i], (uint256));
            if (amt > 0) {
                require(_totalSupply >= amt, "ERC20: burn amount exceeds total supply");
                _totalSupply -= amt;
                _tokenCompliance.destroyed(batchUsers[i], amt);
            }
            emit BurnFinalized(batchUsers[i], amt, decryptID);
        }
        delete _batchBurnUsers[decryptID];
    }

    /**
     *  @dev See {IToken-setAddressFrozen}.
     */
    function setAddressFrozen(address _userAddress, bool _freeze) public override onlyAgent {
        _frozen[_userAddress] = _freeze;

        emit AddressFrozen(_userAddress, _freeze, msg.sender);
    }

    /**
     *  @dev See {IToken-freezePartialTokens}.
     */
    function freezePartialTokens(address _userAddress, itUint256 calldata _it) public override onlyAgent {
        require(_userAddress != address(0), "ERC20: freeze from the zero address");
        gtUint256 _amount = MpcCore.validateCiphertext(_it);
        _freezePartialTokensGt(_userAddress, _amount);
    }

    /// @dev Shared freeze logic for {freezePartialTokens} and {batchFreezePartialTokens} (`_amount` is already a gt handle).
    function _freezePartialTokensGt(address _userAddress, gtUint256 _amount) internal {
        require(_userAddress != address(0), "ERC20: freeze from the zero address");
        // Best-effort (non-reverting) freeze: if requested freeze exceeds available balance,
        // freeze 0 and keep frozen amount unchanged (private condition cannot drive a Solidity revert).
        gtUint256 currentFrozen = _frozenGt(_userAddress);

        gtUint256 newFrozenCandidate = MpcCore.add(currentFrozen, _amount);
        (gtBool freezeOverflowBit, ) = MpcCore.checkedSubWithOverflowBit(_balanceGt(_userAddress), newFrozenCandidate);

        gtUint256 actualFrozen = MpcCore.mux(freezeOverflowBit, _amount, _zero());
        gtUint256 newFrozen = MpcCore.mux(freezeOverflowBit, newFrozenCandidate, currentFrozen);

        _writeFrozen(_userAddress, newFrozen);
        // The acting agent keeps a copy of the running total; other agents call
        // {reencryptFrozenTokens}. The agent set is a role, so it cannot be an eager slot.
        _frozenTokensForReader[msg.sender][_userAddress] = _offBoardTo(newFrozen, msg.sender);

        emit TokensFrozen(_userAddress, _offBoardTo(actualFrozen, _userAddress));
    }

    /**
     *  @dev See {IToken-unfreezePartialTokens}.
     */
    function unfreezePartialTokens(address _userAddress, itUint256 calldata _it) public override onlyAgent {
        require(_userAddress != address(0), "ERC20: unfreeze from the zero address");
        gtUint256 _amount = MpcCore.validateCiphertext(_it);
        _unfreezePartialTokensGt(_userAddress, _amount);
    }

    /// @dev Shared unfreeze logic for {unfreezePartialTokens} and {batchUnfreezePartialTokens} (`_amount` is already a gt handle).
    function _unfreezePartialTokensGt(address _userAddress, gtUint256 _amount) internal {
        require(_userAddress != address(0), "ERC20: unfreeze from the zero address");

        gtUint256 currentFrozen = _frozenGt(_userAddress);

        // Best-effort (non-reverting) unfreeze: if requested unfreeze exceeds frozen amount,
        // unfreeze 0 and keep frozen amount unchanged.
        (gtBool unfreezeOverflowBit, gtUint256 newFrozenCandidate) = MpcCore.checkedSubWithOverflowBit(currentFrozen, _amount);
        gtUint256 actualUnfrozen = MpcCore.mux(unfreezeOverflowBit, _amount, _zero());
        gtUint256 newFrozen = MpcCore.mux(unfreezeOverflowBit, newFrozenCandidate, currentFrozen);

        _writeFrozen(_userAddress, newFrozen);
        _frozenTokensForReader[msg.sender][_userAddress] = _offBoardTo(newFrozen, msg.sender);

        emit TokensUnfrozen(_userAddress, _offBoardTo(actualUnfrozen, _userAddress));
    }

    /**
     *  @dev See {IToken-setIdentityRegistry}.
     */
    function setIdentityRegistry(address _identityRegistry) public override onlyOwner {
        _tokenIdentityRegistry = IPrivateIdentityRegistry(_identityRegistry);
        emit IdentityRegistryAdded(_identityRegistry);
    }

    /**
     *  @dev See {IToken-setCompliance}.
     */
    function setCompliance(address _compliance) public override onlyOwner {
        require(_compliance != address(0), "invalid argument - zero address");

        IPrivateModularCompliance previousCompliance = _tokenCompliance;
        address previousComplianceAddress = address(previousCompliance);
        if (previousComplianceAddress == _compliance) {
            return;
        }

        // Guarded update pattern:
        // 1) switch the stored pointer,
        // 2) bind the new compliance,
        // 3) unbind the previous one.
        // If any external call reverts, the whole tx reverts and state rolls back.
        _tokenCompliance = IPrivateModularCompliance(_compliance);
        _tokenCompliance.bindToken(address(this));
        if (previousComplianceAddress != address(0)) {
            previousCompliance.unbindToken(address(this));
        }
        emit ComplianceAdded(_compliance);
    }

    /**
     *  @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address _userAddress) public view returns (ctUint256 memory) {
        return _balances[_userAddress].userCiphertext;
    }

    /**
     *  @dev See {ERC20-_transfer}.
     */

    function _transfer(
        address _from,
        address _to,
        gtUint256 _amount,
        gtBool _canTransfer
    ) internal virtual returns (gtUint256, gtBool) {
        require(_from != address(0), "ERC20: transfer from the zero address");
        require(_to != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(_from, _to, _amount);

        // `MpcCore.mux(bit, a, b)` selects `b` when `bit` is true in this stack.
        // `_canTransfer=true` therefore maps to `_amount`, while false maps to encrypted zero.
        gtUint256 transferredAmount = MpcCore.mux(_canTransfer, _zero(), _amount);
        (gtUint256 newFromBalance, gtUint256 newToBalance, gtBool transferResult) =
            MpcCore.transfer(_balanceGt(_from), _balanceGt(_to), transferredAmount);
        _writeBalance(_from, newFromBalance);
        _writeBalance(_to, newToBalance);
        // The moved amount has two readers, so it is emitted as two ciphertexts.
        emit Transfer(_from, _to, _offBoardTo(transferredAmount, _from), _offBoardTo(transferredAmount, _to));
        return (transferredAmount, transferResult);
    }

    /**
     *  @dev See {ERC20-_mint}.
     */
    function _mint(address _userAddress, uint256 _amount) internal virtual {
        require(_userAddress != address(0), "ERC20: mint to the zero address");

        gtUint256 privateAmount = MpcCore.setPublic256(_amount);

        _beforeTokenTransfer(address(0), _userAddress, privateAmount);

        _totalSupply = _totalSupply + _amount;
        gtUint256 newBalance = MpcCore.add(_balanceGt(_userAddress), privateAmount);
        _writeBalance(_userAddress, newBalance);
        emit Transfer(address(0), _userAddress, _emptyCt(), _offBoardTo(privateAmount, _userAddress));
    }

    /**
     *  @dev See {ERC20-_burn}.
     */
    /**
     *  @dev Applies the encrypted burn for a clear `_amount`. If the private balance is insufficient, the effective
     *  burn is zero (handle still emitted for decryption flow). Requested clear amounts in `burn` / `batchBurn` can
     *  therefore exceed the sum of effective burns; `callbackBurn` aligns `totalSupply` with decrypted values.
     */
    function _burn(address _userAddress, uint256 _amount) internal virtual returns (gtUint256 burnedAmount) {
        require(_userAddress != address(0), "ERC20: burn from the zero address");
        gtUint256 privateAmount = MpcCore.setPublic256(_amount);
        _beforeTokenTransfer(_userAddress, address(0), privateAmount);

        // Avoid underflow: if requested burn exceeds private balance, burn 0 and keep balance unchanged.
        (gtBool burnOverflowBit, gtUint256 newBalanceCandidate) = MpcCore.checkedSubWithOverflowBit(_balanceGt(_userAddress), privateAmount);
        burnedAmount = MpcCore.mux(burnOverflowBit, privateAmount, _zero());
        gtUint256 newBalance = MpcCore.mux(burnOverflowBit, newBalanceCandidate, _balanceGt(_userAddress));
        _writeBalance(_userAddress, newBalance);

        emit Transfer(_userAddress, address(0), _offBoardTo(burnedAmount, _userAddress), _emptyCt());
    }

    function _isAmountWithinFreeBalance(address account, gtUint256 amount) internal returns (gtBool) {
        (gtBool freeBalanceOverflowBit, gtUint256 freeBalanceCandidate) = MpcCore.checkedSubWithOverflowBit(
            _balanceGt(account),
            _frozenGt(account)
        );
        gtUint256 freeBalance = MpcCore.mux(freeBalanceOverflowBit, freeBalanceCandidate, _zero());
        (gtBool amountOverflowBit, ) = MpcCore.checkedSubWithOverflowBit(freeBalance, amount);
        // Convert the overflow bit to a "within free balance" flag.
        return MpcCore.mux(amountOverflowBit, MpcCore.setPublic(true), MpcCore.setPublic(false));
    }

    /**
     * @dev Evaluates transfer preconditions and returns an "allow transfer" bit consumed by `_transfer`.
     *
     * Result interpretation:
     * - `true`  => transfer is allowed (subject to private arithmetic in `_transfer`).
     * - `false` => transfer is blocked and `_transfer` forces the effective transferred amount to 0.
     *
     * A transfer is allowed only when all of the following hold:
     * - recipient identity is verified,
     * - compliance check allows the transfer (`canTransfer` returns true),
     * - sender has enough free (unfrozen) private balance.
     */
    function _evaluateTransferPolicy(address from, address to, gtUint256 amount) internal returns (gtBool) {
        gtBool isVerified = MpcCore.setPublic(_tokenIdentityRegistry.isVerified(to));
        gtBool complianceAllows = _tokenCompliance.canTransfer(from, to, amount);
        gtBool amountWithinFreeBalance = _isAmountWithinFreeBalance(from, amount);
        gtBool identityAndComplianceOk = MpcCore.and(isVerified, complianceAllows);
        return MpcCore.and(identityAndComplianceOk, amountWithinFreeBalance);
    }


    function _approve(
        address _owner,
        address _spender,
        gtUint256 _amount
    ) internal virtual {
        require(_owner != address(0), "ERC20: approve from the zero address");
        require(_spender != address(0), "ERC20: approve to the zero address");

        _writeAllowance(_owner, _spender, _amount);
        emit Approval(
            _owner,
            _spender,
            _allowances[_owner][_spender].ownerCiphertext,
            _allowances[_owner][_spender].spenderCiphertext
        );
    }

    /**
     *  @dev See {ERC20-_beforeTokenTransfer}.
     */
    // solhint-disable-next-line no-empty-blocks
    function _beforeTokenTransfer(address _from, address _to, gtUint256 _amount) internal virtual {}
}
