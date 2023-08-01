pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LPtoken is Ownable, ERC20 {

    address public manager;

    modifier onlyManager() {
        require(msg.sender == manager || msg.sender == owner(), "OM");
        _;
    }

    constructor(string memory _name, string memory _symbol, address _manager) ERC20(_name, _symbol) {
        manager = _manager;
    }

    function mint(address _to, uint256 _amount) external onlyManager {
        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) external onlyManager {
        _burn(_from, _amount);
    }
    
    function setManager(address _manager) external onlyOwner {
        manager = _manager;
    }

}