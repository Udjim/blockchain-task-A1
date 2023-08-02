pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/SignatureCheckerUpgradeable.sol";
import "./TransferHelper.sol";

contract RoleContract is OwnableUpgradeable {
    // =================================
    // Storage
    // =================================

    /// @dev Public key of signer
    address public publicKey;

    address public manager;

    /// @dev Roles struct
    /// @param roleNumber - number of role
    /// @param isExist - is role exist
    struct Roles {
        uint256 roleNumber;
        bool isExist;
        uint256 maxAmount;
        uint256 minAmount;
    }

    /// @dev User role struct
    /// @param role - role of user
    /// @param deadline - deadline of role for this user
    struct userRole {
        uint256 role;
        uint256 deadline;
    }

    /// @dev List of all roles
    mapping(uint256 => Roles) public rolesList;
    /// @dev List users roles
    mapping(address => userRole) private userRoles;

    /// @dev List of individual nonces
    mapping(address => uint256) public individualNonce;

    // =================================
    // Modifier
    // =================================

    modifier isRoleExist(uint256 _role) {
        require(rolesList[_role].isExist, "RNE");
        _;
    }

    modifier onlyManager() {
        require(msg.sender == manager || msg.sender == owner(), "OM");
        _;
    }

    // =================================
    // Internal functions
    // =================================

    function verifySignedAddressForRoles(
        uint256 _role,
        uint256 _days,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) internal view returns (bool) {
        bytes32 prefixedHashMessage = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encodePacked(
                        msg.sender,
                        individualNonce[msg.sender],
                        _role,
                        _days
                    )
                )
            )
        );
        address signer = ecrecover(prefixedHashMessage, _v, _r, _s);
        return signer == publicKey;
    }

    // =================================
    // Get role functions
    // =================================

    /// @dev Get role of user
    function getRole(address _user) public view returns (Roles memory) {
        if (userRoles[_user].deadline < block.timestamp) {
            return rolesList[0];
        } else {
            return rolesList[userRoles[_user].role];
        }
    }

    /// @dev Get role number of user
    function getRoleNumber(address _user) external view returns (uint256) {
        return getRole(_user).roleNumber;
    }

    /// @dev Get deadline of user role
    function getDeadline(address _user) external view returns (uint256) {
        return userRoles[_user].deadline;
    }

    /// @dev Get max and min amounts of user role
    function getAmounts(
        address _user
    ) external view returns (uint256, uint256) {
        return (getRole(_user).minAmount, getRole(_user).maxAmount);
    }

    // =================================
    // Set functions
    // =================================

    /// @dev sets role for user after off chain payment
    function offChainPay(
        uint256 _role,
        uint256 _days,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external isRoleExist(_role) {
        require(verifySignedAddressForRoles(_role, _days, _v, _r, _s), "WS");
        individualNonce[msg.sender]++;

        if (
            userRoles[msg.sender].deadline < block.timestamp &&
            userRoles[msg.sender].role != _role
        ) {
            userRoles[msg.sender] = userRole(
                _role,
                (block.timestamp + (_days * 1 days))
            );
        } else if (userRoles[msg.sender].deadline > block.timestamp) {
            userRoles[msg.sender].deadline += (_days * 1 days);
        } else {
            userRoles[msg.sender].deadline = (block.timestamp +
                (_days * 1 days));
        }
    }

    // =================================
    // Admin functions
    // =================================

    /// @dev sets role for user
    function giveRole(
        address _user,
        uint256 _role,
        uint256 _days
    ) external onlyManager isRoleExist(_role) {
        if (
            userRoles[msg.sender].deadline < block.timestamp &&
            userRoles[_user].role != _role
        ) {
            userRoles[_user] = userRole(
                _role,
                (block.timestamp + (_days * 1 days))
            );
        } else if (userRoles[_user].deadline > block.timestamp) {
            userRoles[_user].deadline += (_days * 1 days);
        } else {
            userRoles[_user].deadline = (block.timestamp + (_days * 1 days));
        }
    }

    /// @dev refund role for user
    function refundRole(address _user) external onlyManager {
        userRoles[_user] = userRole(0, block.timestamp);
    }

    /// @dev sets public key
    function setPublicKey(address _publicKey) external onlyOwner {
        publicKey = _publicKey;
    }

    function setManager(address _manager) external onlyOwner {
        manager = _manager;
    }

    /// @dev makes new role
    function makeNewRole(
        uint256 _role,
        uint256 _maxAmount,
        uint256 _minAmount
    ) external onlyManager {
        require(_maxAmount > _minAmount, "MA");
        rolesList[_role] = Roles(_role, true, _maxAmount, _minAmount);
    }

    /// @dev delete role
    function deleteRole(uint256 _role) external onlyManager {
        rolesList[_role].isExist = false;
    }

    // =================================
    // Constructor
    // =================================

    function initialize(
        address _publicKey,
        address _manager,
        Roles[] calldata rolesInit
    ) public initializer {
        __Ownable_init();

        publicKey = _publicKey;
        manager = _manager;

        for (uint256 i = 0; i < rolesInit.length; i++) {
            rolesList[rolesInit[i].roleNumber] = rolesInit[i];
        }
    }
}
