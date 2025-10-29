// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {MyToken} from "../contracts/MyToken.sol"; // ← adjust if needed

contract MyTokenTest is Test {
    MyToken private myToken;
    address private owner;
    address private addr1;

    function setUp() public {
        owner = makeAddr("owner");
        addr1 = makeAddr("addr1");

        // Your contract takes the owner in the constructor
        myToken = new MyToken(owner);
    }

    // --- READ-ONLY TESTS MARKED AS `view` (option 2) ---

    function test_NameAndSymbol() public view {
        // Use `require` to keep the function pure/view and avoid logs from forge-std assertions
        require(
            keccak256(bytes(myToken.name())) == keccak256(bytes("MyToken")),
            "name mismatch"
        );
        require(
            keccak256(bytes(myToken.symbol())) == keccak256(bytes("MTK")),
            "symbol mismatch"
        );
    }

    function test_SetRightOwner() public view {
        require(myToken.owner() == owner, "owner mismatch");
    }

    // --- STATE-MUTATING TESTS ---

    function test_OwnerCanMint() public {
        vm.prank(owner);
        myToken.mint(addr1, 1000);
        assertEq(myToken.balanceOf(addr1), 1000);
    }

    function test_NonOwnerCannotMint() public {
        // OZ v5 Ownable custom error: OwnableUnauthorizedAccount(address)
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", addr1)
        );
        vm.prank(addr1);
        myToken.mint(addr1, 1000);
    }

    function test_TotalSupplyIncreasesOnMint() public {
        uint256 initialSupply = myToken.totalSupply();

        vm.prank(owner);
        myToken.mint(addr1, 500);

        uint256 finalSupply = myToken.totalSupply();
        assertEq(finalSupply - initialSupply, 500);
    }
}
