// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "../openzeppelin-solidity/contracts/ERC1155/ERC1155.sol";

contract TestTokenERC1155 is ERC1155 {
    constructor() ERC1155()
    {
        _mint(msg.sender, 1, 1000, "");
        _mint(msg.sender, 2, 1000, "");
        _mint(msg.sender, 3, 1000, "");
        _mint(msg.sender, 4, 1000, "");
    }
}