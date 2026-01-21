// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import {Test} from "forge-std/Test.sol";
import {DeployOurToken} from "../script/DeployOurToken.s.sol";
import {OurToken} from "../src/OurToken.sol";

contract OurTokenTest is Test {
    OurToken public ourToken;
    DeployOurToken public deployer;

    address testUser1 = makeAddr("testUser1");
    address testUser2 = makeAddr("testUser2");

    uint256 public constant STARTING_BALANCE = 100 ether;

    function setUp() public {
        deployer = new DeployOurToken();
        ourToken = deployer.run();

        vm.prank(msg.sender);
        ourToken.transfer(testUser1, STARTING_BALANCE);
    }

    function testTestUser1Balance() public view {
        assertEq(STARTING_BALANCE, ourToken.balanceOf(testUser1));
    }

    function testAllowancesWork() public {
        uint256 initialAllowance = 1000;

        // testUser1 approves testUser2 to spend 1000 tokens.
        // testUser1 授权 testUser2 花费 1000 个代币。
        vm.prank(testUser1);
        ourToken.approve(testUser2, initialAllowance);

        uint256 transferAmount = 500;

        vm.prank(testUser2);
        ourToken.transferFrom(testUser1, testUser2, transferAmount);

        assertEq(ourToken.balanceOf(testUser2), transferAmount);
        assertEq(
            ourToken.balanceOf(testUser1),
            STARTING_BALANCE - transferAmount
        );
    }

    function testTransferFailsIfNotEnoughBalance() public {
        vm.prank(testUser1);
        ourToken.transfer(testUser2, STARTING_BALANCE + 1);
    }
}
