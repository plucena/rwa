// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PrivateBuildImports
 * @dev Build-only import anchor for the private token stack.
 *
 * This file is intentionally not deployed or referenced at runtime.
 * Its purpose is to force the compiler/build pipeline to include private
 * token, compliance, identity, and MPC dependencies in generated artifacts.
 *
 * Keep this file when private build/docs/type generation tasks depend on
 * deterministic compilation coverage, even if some contracts are only
 * referenced indirectly in tests or scripts.
 */

// Private token stack
import "../contracts/token/IPrivateToken.sol";
import "../contracts/token/PrivateTokenStorage.sol";
import "../contracts/token/PrivateToken.sol";

// Private compliance/identity interfaces
import "../contracts/compliance/modular/IPrivateModularCompliance.sol";
import "../contracts/registry/interface/IPrivateIdentity.sol";
import "../contracts/registry/interface/IPrivateIdentityRegistry.sol";

// Bubble MPC stack dependencies
import "../contracts/bubble/MpcInterface.sol";
import "../contracts/bubble/MpcCore.sol";
import "../contracts/bubble/DecryptionCaller.sol";
